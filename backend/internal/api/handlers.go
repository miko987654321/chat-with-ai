package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/meirkhan/chat-with-ai/backend/internal/chat"
	"github.com/meirkhan/chat-with-ai/backend/internal/db"
	"github.com/meirkhan/chat-with-ai/backend/internal/models"
)

type Handler struct {
	svc          *chat.Service
	log          *slog.Logger
	defaultModel string
	models       []models.LLMModel
}

func NewHandler(svc *chat.Service, log *slog.Logger, defaultModel string, ms []models.LLMModel) *Handler {
	return &Handler{svc: svc, log: log, defaultModel: defaultModel, models: ms}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "time": time.Now().UTC()})
}

func (h *Handler) ListModels(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"default": h.defaultModel,
		"models":  h.models,
	})
}

func (h *Handler) ListChats(w http.ResponseWriter, r *http.Request) {
	chats, err := h.svc.ListChats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, chats)
}

type createChatBody struct {
	Model string `json:"model"`
}

func (h *Handler) CreateChat(w http.ResponseWriter, r *http.Request) {
	var body createChatBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	c, err := h.svc.CreateChat(r.Context(), body.Model)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *Handler) GetChat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	c, err := h.svc.GetChat(r.Context(), id)
	if errors.Is(err, db.ErrNotFound) {
		writeError(w, http.StatusNotFound, err)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

type renameChatBody struct {
	Title string `json:"title"`
}

func (h *Handler) RenameChat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body renameChatBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if err := h.svc.RenameChat(r.Context(), id, body.Title); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeError(w, http.StatusNotFound, err)
			return
		}
		writeError(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteChat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.DeleteChat(r.Context(), id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeError(w, http.StatusNotFound, err)
			return
		}
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type sendMessageBody struct {
	Content string `json:"content"`
}

// SendMessage streams the assistant reply over SSE. The frontend listens for events:
//
//	event: delta  — chunk of streamed text
//	event: done   — final payload with full user/assistant message records
//	event: error  — terminal error message
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body sendMessageBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, errors.New("streaming unsupported"))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ctx := r.Context()

	send := func(event string, payload any) error {
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	userMsg, assistantMsg, err := h.svc.SendMessage(ctx, id, body.Content, func(delta string) error {
		return send("delta", map[string]string{"content": delta})
	})
	if err != nil {
		h.log.Warn("send message failed", "chat", id, "err", err)
		_ = send("error", map[string]string{"message": humanizeErr(err)})
		return
	}

	_ = send("done", map[string]any{
		"user_message":      userMsg,
		"assistant_message": assistantMsg,
	})

	// Background maintenance — auto-title and summary refresh. We use a fresh context so a
	// disconnect by the SSE client doesn't cancel the housekeeping LLM call.
	go func(chatID string) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		h.svc.MaybeAutoTitle(bgCtx, chatID)
		h.svc.MaybeSummarize(bgCtx, chatID)
	}(id)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": humanizeErr(err)})
}

func humanizeErr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
