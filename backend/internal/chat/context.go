package chat

import (
	"context"
	"fmt"
	"strings"

	"github.com/meirkhan/chat-with-ai/backend/internal/models"
	"github.com/meirkhan/chat-with-ai/backend/internal/openrouter"
)

// estimateTokens is a cheap heuristic. Real tokenisation is model-specific and we don't ship
// per-model tokenisers in this service — but ~4 chars per token is a stable rule of thumb that
// keeps us well under any free-tier context window.
func estimateTokens(s string) int {
	if s == "" {
		return 0
	}
	return (len(s) + 3) / 4
}

func messagesTokens(msgs []openrouter.ChatMessage) int {
	total := 0
	for _, m := range msgs {
		total += estimateTokens(m.Content) + 4
	}
	return total
}

// buildPrompt prepares the message list for the LLM.
//
// Context-window strategy:
//   - With no summary, send the full history (small chats stay lossless).
//   - Once a summary exists, send only [summary] + the last keepRecent messages. The summary
//     itself is rolled forward by MaybeSummarize after each turn, so older context is preserved
//     in compressed form rather than being dropped.
func buildPrompt(chat *models.Chat, history []models.Message, keepRecent int) []openrouter.ChatMessage {
	out := make([]openrouter.ChatMessage, 0, len(history)+2)
	out = append(out, openrouter.ChatMessage{
		Role:    "system",
		Content: "Ты — полезный ассистент. Отвечай ясно и по делу. Используй markdown для форматирования кода и списков.",
	})

	summary := strings.TrimSpace(chat.Summary)
	if summary != "" {
		out = append(out, openrouter.ChatMessage{
			Role:    "system",
			Content: "Краткое содержание предыдущей части диалога:\n" + summary,
		})
		if keepRecent > 0 && len(history) > keepRecent {
			history = history[len(history)-keepRecent:]
		}
	}
	for _, m := range history {
		out = append(out, openrouter.ChatMessage{Role: m.Role, Content: m.Content})
	}
	return out
}

// shouldSummarize returns true when the conversation has grown large enough that we should fold
// older messages into a running summary, freeing context for new turns.
func shouldSummarize(history []models.Message, summary string, threshold int) bool {
	tokens := estimateTokens(summary)
	for _, m := range history {
		tokens += estimateTokens(m.Content) + 4
	}
	return tokens > threshold
}

// summarize asks the LLM to produce a running summary of the older portion of the conversation.
// It returns the new summary text. On error the previous summary is preserved by the caller.
func summarize(ctx context.Context, llm *openrouter.Client, model, prevSummary string, older []models.Message) (string, error) {
	if len(older) == 0 {
		return prevSummary, nil
	}

	var b strings.Builder
	if prevSummary != "" {
		b.WriteString("Предыдущее краткое содержание:\n")
		b.WriteString(prevSummary)
		b.WriteString("\n\n")
	}
	b.WriteString("Новые сообщения, которые нужно добавить в краткое содержание:\n")
	for _, m := range older {
		b.WriteString(fmt.Sprintf("[%s] %s\n", m.Role, m.Content))
	}

	req := openrouter.ChatRequest{
		Model: model,
		Messages: []openrouter.ChatMessage{
			{
				Role: "system",
				Content: "Ты — ассистент, который ведёт компактное краткое содержание диалога между пользователем и ассистентом. " +
					"Сохраняй ключевые факты, решения, имена, числа, цели и контекст, который нужен для продолжения диалога. " +
					"Не пиши вступлений и заключений. Объём — не более 8 предложений.",
			},
			{Role: "user", Content: b.String()},
		},
		MaxTokens: 600,
	}
	out, err := llm.Complete(ctx, req)
	if err != nil {
		return prevSummary, err
	}
	return strings.TrimSpace(out), nil
}
