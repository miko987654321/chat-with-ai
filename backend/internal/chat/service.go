package chat

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/meirkhan/chat-with-ai/backend/internal/db"
	"github.com/meirkhan/chat-with-ai/backend/internal/models"
	"github.com/meirkhan/chat-with-ai/backend/internal/openrouter"
)

type Service struct {
	repo             *db.Repo
	llm              *openrouter.Client
	defaultModel     string
	contextThreshold int
	keepRecent       int
	log              *slog.Logger
}

type Options struct {
	DefaultModel     string
	ContextThreshold int
	KeepRecent       int
	Logger           *slog.Logger
}

func NewService(repo *db.Repo, llm *openrouter.Client, opts Options) *Service {
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	if opts.KeepRecent <= 0 {
		opts.KeepRecent = 8
	}
	if opts.ContextThreshold <= 0 {
		opts.ContextThreshold = 6000
	}
	return &Service{
		repo:             repo,
		llm:              llm,
		defaultModel:     opts.DefaultModel,
		contextThreshold: opts.ContextThreshold,
		keepRecent:       opts.KeepRecent,
		log:              opts.Logger,
	}
}

func (s *Service) CreateChat(ctx context.Context, model string) (*models.Chat, error) {
	if model == "" {
		model = s.defaultModel
	}
	c := &models.Chat{
		ID:    uuid.NewString(),
		Title: "Новый чат",
		Model: model,
	}
	if err := s.repo.CreateChat(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) ListChats(ctx context.Context) ([]models.Chat, error) {
	return s.repo.ListChats(ctx)
}

func (s *Service) GetChat(ctx context.Context, id string) (*models.ChatWithMessages, error) {
	c, err := s.repo.GetChat(ctx, id)
	if err != nil {
		return nil, err
	}
	msgs, err := s.repo.ListMessages(ctx, id)
	if err != nil {
		return nil, err
	}
	return &models.ChatWithMessages{Chat: *c, Messages: msgs}, nil
}

func (s *Service) RenameChat(ctx context.Context, id, title string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return errors.New("title is empty")
	}
	if len(title) > 200 {
		title = title[:200]
	}
	return s.repo.UpdateChatTitle(ctx, id, title)
}

func (s *Service) DeleteChat(ctx context.Context, id string) error {
	return s.repo.DeleteChat(ctx, id)
}

// SendMessage stores the user's message, streams the assistant reply, persists it, and
// triggers post-turn maintenance (auto-title, summarisation). The onDelta callback is invoked
// with each chunk of streamed text. On error the user message is still kept so the UI can retry.
func (s *Service) SendMessage(ctx context.Context, chatID, userText string, onDelta func(string) error) (*models.Message, *models.Message, error) {
	userText = strings.TrimSpace(userText)
	if userText == "" {
		return nil, nil, errors.New("empty message")
	}

	chat, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		return nil, nil, err
	}

	history, err := s.repo.ListMessages(ctx, chatID)
	if err != nil {
		return nil, nil, err
	}

	userMsg := &models.Message{
		ID:      uuid.NewString(),
		ChatID:  chatID,
		Role:    "user",
		Content: userText,
	}
	if err := s.repo.AddMessage(ctx, userMsg); err != nil {
		return nil, nil, err
	}
	history = append(history, *userMsg)

	prompt := buildPrompt(chat, history, s.keepRecent)

	var sb strings.Builder
	err = s.llm.Stream(ctx, openrouter.ChatRequest{
		Model:    chat.Model,
		Messages: prompt,
	}, func(delta string) error {
		sb.WriteString(delta)
		return onDelta(delta)
	})
	if err != nil {
		return userMsg, nil, fmt.Errorf("stream: %w", err)
	}

	assistantText := strings.TrimSpace(sb.String())
	if assistantText == "" {
		return userMsg, nil, errors.New("empty assistant response")
	}

	assistantMsg := &models.Message{
		ID:      uuid.NewString(),
		ChatID:  chatID,
		Role:    "assistant",
		Content: assistantText,
	}
	if err := s.repo.AddMessage(ctx, assistantMsg); err != nil {
		return userMsg, nil, err
	}
	if err := s.repo.TouchChat(ctx, chatID); err != nil {
		s.log.Warn("touch chat failed", "err", err)
	}

	return userMsg, assistantMsg, nil
}

// MaybeAutoTitle generates a short topic title from the first user message. It is a no-op when
// the chat already has a non-default title or fewer than 2 messages.
func (s *Service) MaybeAutoTitle(ctx context.Context, chatID string) {
	chat, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		return
	}
	if chat.Title != "" && chat.Title != "Новый чат" {
		return
	}
	msgs, err := s.repo.ListMessages(ctx, chatID)
	if err != nil || len(msgs) < 2 {
		return
	}

	var first string
	for _, m := range msgs {
		if m.Role == "user" {
			first = m.Content
			break
		}
	}
	if first == "" {
		return
	}

	req := openrouter.ChatRequest{
		Model: chat.Model,
		Messages: []openrouter.ChatMessage{
			{
				Role: "system",
				Content: "Ты придумываешь короткие заголовки для чатов. Ответь ровно одним заголовком в 3–6 слов, " +
					"без кавычек, без точки в конце, на языке сообщения пользователя.",
			},
			{Role: "user", Content: first},
		},
		MaxTokens: 30,
	}
	title, err := s.llm.Complete(ctx, req)
	if err != nil {
		s.log.Warn("auto title failed", "chat", chatID, "err", err)
		return
	}
	title = sanitizeTitle(title)
	if title == "" {
		return
	}
	if err := s.repo.UpdateChatTitle(ctx, chatID, title); err != nil {
		s.log.Warn("save auto title failed", "chat", chatID, "err", err)
	}
}

// MaybeSummarize keeps the chat under the configured context budget. It folds older messages
// into chat.summary, while leaving the last KeepRecent messages untouched. Newly summarised
// messages are NOT deleted from storage — the UI still shows full history; only the LLM prompt
// is compressed via buildPrompt's combination of summary + recent messages.
//
// Note: because we persist every message and rebuild the prompt fresh every turn, the summary
// only matters once the chat grows past the threshold. For brand-new chats it is empty.
func (s *Service) MaybeSummarize(ctx context.Context, chatID string) {
	chat, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		return
	}
	msgs, err := s.repo.ListMessages(ctx, chatID)
	if err != nil {
		return
	}
	if len(msgs) <= s.keepRecent {
		return
	}
	if !shouldSummarize(msgs, chat.Summary, s.contextThreshold) {
		return
	}
	older := msgs[:len(msgs)-s.keepRecent]
	newSummary, err := summarize(ctx, s.llm, chat.Model, chat.Summary, older)
	if err != nil {
		s.log.Warn("summarize failed", "chat", chatID, "err", err)
		return
	}
	if err := s.repo.UpdateChatSummary(ctx, chatID, newSummary); err != nil {
		s.log.Warn("save summary failed", "chat", chatID, "err", err)
	}
}

func sanitizeTitle(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "\"'«»`")
	s = strings.TrimRight(s, ".!?…")
	if i := strings.IndexAny(s, "\n\r"); i >= 0 {
		s = s[:i]
	}
	if len(s) > 80 {
		s = strings.TrimSpace(s[:80])
	}
	return s
}
