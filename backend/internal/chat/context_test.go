package chat

import (
	"strings"
	"testing"

	"github.com/meirkhan/chat-with-ai/backend/internal/models"
)

func TestEstimateTokens(t *testing.T) {
	cases := map[string]int{
		"":      0,
		"hi":    1,
		"abcd":  1,
		"abcde": 2,
	}
	for in, want := range cases {
		if got := estimateTokens(in); got != want {
			t.Errorf("estimateTokens(%q) = %d, want %d", in, got, want)
		}
	}
}

func TestBuildPromptWithoutSummaryIncludesAll(t *testing.T) {
	chat := &models.Chat{}
	hist := []models.Message{
		{Role: "user", Content: "first"},
		{Role: "assistant", Content: "first reply"},
		{Role: "user", Content: "second"},
	}
	out := buildPrompt(chat, hist, 2)
	// system + 3 history
	if len(out) != 4 {
		t.Fatalf("want 4 messages, got %d", len(out))
	}
	if out[0].Role != "system" {
		t.Errorf("first must be system, got %q", out[0].Role)
	}
	if out[3].Content != "second" {
		t.Errorf("last must be the latest user msg, got %q", out[3].Content)
	}
}

func TestBuildPromptWithSummaryClampsHistory(t *testing.T) {
	chat := &models.Chat{Summary: "что-то про Go"}
	hist := []models.Message{
		{Role: "user", Content: "old1"},
		{Role: "assistant", Content: "old2"},
		{Role: "user", Content: "old3"},
		{Role: "assistant", Content: "recent1"},
		{Role: "user", Content: "recent2"},
	}
	out := buildPrompt(chat, hist, 2)
	// system + summary system + 2 recent
	if len(out) != 4 {
		t.Fatalf("want 4 messages, got %d", len(out))
	}
	if !strings.Contains(out[1].Content, "что-то про Go") {
		t.Errorf("summary not injected: %q", out[1].Content)
	}
	if out[2].Content != "recent1" || out[3].Content != "recent2" {
		t.Errorf("history not clamped to recent: %+v", out[2:])
	}
}

func TestShouldSummarize(t *testing.T) {
	hist := make([]models.Message, 20)
	for i := range hist {
		hist[i] = models.Message{Role: "user", Content: strings.Repeat("a", 400)}
	}
	if !shouldSummarize(hist, "", 1000) {
		t.Error("expected summarize=true for long history")
	}
	if shouldSummarize(hist[:1], "", 1000) {
		t.Error("expected summarize=false for short history")
	}
}

func TestSanitizeTitle(t *testing.T) {
	cases := map[string]string{
		"  Hello world.  ": "Hello world",
		"\"Заголовок\"":    "Заголовок",
		"line1\nline2":     "line1",
		"":                 "",
	}
	for in, want := range cases {
		if got := sanitizeTitle(in); got != want {
			t.Errorf("sanitizeTitle(%q) = %q, want %q", in, got, want)
		}
	}
}
