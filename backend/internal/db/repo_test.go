package db

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/meirkhan/chat-with-ai/backend/internal/models"
)

func newTestRepo(t *testing.T) *Repo {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	conn, err := Open(path)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return NewRepo(conn)
}

func TestChatLifecycle(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	c := &models.Chat{ID: uuid.NewString(), Title: "Новый чат", Model: "test/model:free"}
	if err := repo.CreateChat(ctx, c); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := repo.GetChat(ctx, c.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Model != "test/model:free" {
		t.Errorf("model: %q", got.Model)
	}

	if err := repo.UpdateChatTitle(ctx, c.ID, "Renamed"); err != nil {
		t.Fatalf("rename: %v", err)
	}
	got, _ = repo.GetChat(ctx, c.ID)
	if got.Title != "Renamed" {
		t.Errorf("title: %q", got.Title)
	}

	if err := repo.UpdateChatSummary(ctx, c.ID, "summary text"); err != nil {
		t.Fatalf("summary: %v", err)
	}

	chats, err := repo.ListChats(ctx)
	if err != nil || len(chats) != 1 {
		t.Fatalf("list: %v %d", err, len(chats))
	}

	if err := repo.DeleteChat(ctx, c.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := repo.GetChat(ctx, c.ID); err != ErrNotFound {
		t.Errorf("expected not found after delete, got %v", err)
	}
}

func TestMessagesCascadeDelete(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()

	c := &models.Chat{ID: uuid.NewString(), Title: "x", Model: "m:free"}
	if err := repo.CreateChat(ctx, c); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 3; i++ {
		if err := repo.AddMessage(ctx, &models.Message{
			ID: uuid.NewString(), ChatID: c.ID, Role: "user", Content: "hi",
		}); err != nil {
			t.Fatal(err)
		}
	}
	n, err := repo.CountMessages(ctx, c.ID)
	if err != nil || n != 3 {
		t.Fatalf("count: %v %d", err, n)
	}
	if err := repo.DeleteChat(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	n, _ = repo.CountMessages(ctx, c.ID)
	if n != 0 {
		t.Errorf("messages not cascaded: %d", n)
	}
}
