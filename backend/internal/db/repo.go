package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/meirkhan/chat-with-ai/backend/internal/models"
)

var ErrNotFound = errors.New("not found")

type Repo struct {
	db *sql.DB
}

func NewRepo(db *sql.DB) *Repo { return &Repo{db: db} }

func (r *Repo) CreateChat(ctx context.Context, c *models.Chat) error {
	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chats (id, title, model, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		c.ID, c.Title, c.Model, c.Summary, c.CreatedAt, c.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert chat: %w", err)
	}
	return nil
}

func (r *Repo) ListChats(ctx context.Context) ([]models.Chat, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, title, model, summary, created_at, updated_at FROM chats ORDER BY updated_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("query chats: %w", err)
	}
	defer rows.Close()

	chats := []models.Chat{}
	for rows.Next() {
		var c models.Chat
		if err := rows.Scan(&c.ID, &c.Title, &c.Model, &c.Summary, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan chat: %w", err)
		}
		chats = append(chats, c)
	}
	return chats, rows.Err()
}

func (r *Repo) GetChat(ctx context.Context, id string) (*models.Chat, error) {
	var c models.Chat
	err := r.db.QueryRowContext(ctx,
		`SELECT id, title, model, summary, created_at, updated_at FROM chats WHERE id = ?`,
		id,
	).Scan(&c.ID, &c.Title, &c.Model, &c.Summary, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get chat: %w", err)
	}
	return &c, nil
}

func (r *Repo) UpdateChatTitle(ctx context.Context, id, title string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`,
		title, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("update title: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) UpdateChatModel(ctx context.Context, id, model string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE chats SET model = ?, updated_at = ? WHERE id = ?`,
		model, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("update model: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) UpdateChatSummary(ctx context.Context, id, summary string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chats SET summary = ?, updated_at = ? WHERE id = ?`,
		summary, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("update summary: %w", err)
	}
	return nil
}

func (r *Repo) TouchChat(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chats SET updated_at = ? WHERE id = ?`,
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("touch chat: %w", err)
	}
	return nil
}

func (r *Repo) DeleteChat(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM chats WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete chat: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) AddMessage(ctx context.Context, m *models.Message) error {
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now().UTC()
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
		m.ID, m.ChatID, m.Role, m.Content, m.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert message: %w", err)
	}
	return nil
}

func (r *Repo) ListMessages(ctx context.Context, chatID string) ([]models.Message, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC`,
		chatID,
	)
	if err != nil {
		return nil, fmt.Errorf("query messages: %w", err)
	}
	defer rows.Close()

	out := []models.Message{}
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.ChatID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repo) CountMessages(ctx context.Context, chatID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM messages WHERE chat_id = ?`, chatID,
	).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count messages: %w", err)
	}
	return n, nil
}
