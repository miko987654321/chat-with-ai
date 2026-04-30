package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/meirkhan/chat-with-ai/backend/internal/api"
	"github.com/meirkhan/chat-with-ai/backend/internal/chat"
	"github.com/meirkhan/chat-with-ai/backend/internal/config"
	"github.com/meirkhan/chat-with-ai/backend/internal/db"
	"github.com/meirkhan/chat-with-ai/backend/internal/models"
	"github.com/meirkhan/chat-with-ai/backend/internal/openrouter"
)

// Curated list of OpenRouter free-tier models surfaced to the UI. Suffix `:free` is required by
// the task. Context sizes are approximate and only used for the model-picker hint.
var freeModels = []models.LLMModel{
	{ID: "deepseek/deepseek-chat-v3-0324:free", Name: "DeepSeek Chat v3", Description: "Универсальная модель, хороша в коде и рассуждениях", ContextSize: 64000},
	{ID: "z-ai/glm-4.5-air:free", Name: "GLM 4.5 Air", Description: "Лёгкая модель Zhipu, хороша в диалогах и рассуждениях", ContextSize: 128000},
	{ID: "google/gemma-3-27b-it:free", Name: "Gemma 3 27B", Description: "Открытая модель Google, сильна в текстовых задачах", ContextSize: 96000},
	{ID: "meta-llama/llama-4-scout:free", Name: "Llama 4 Scout", Description: "Быстрая модель Meta для повседневных задач", ContextSize: 128000},
	{ID: "mistralai/mistral-7b-instruct:free", Name: "Mistral 7B Instruct", Description: "Лёгкая и быстрая модель Mistral", ContextSize: 32000},
}

// resolveModels ensures the configured DEFAULT_MODEL is always in the picker, even if the
// operator pointed at something outside the curated list. Without this the validator below
// would reject the operator's own default and existing chats would fail.
func resolveModels(curated []models.LLMModel, defaultID string) []models.LLMModel {
	for _, m := range curated {
		if m.ID == defaultID {
			return curated
		}
	}
	if defaultID == "" {
		return curated
	}
	extra := models.LLMModel{
		ID:          defaultID,
		Name:        defaultID,
		Description: "Кастомная модель по умолчанию",
	}
	return append([]models.LLMModel{extra}, curated...)
}

func main() {
	_ = godotenv.Load()

	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	cfg, err := config.Load()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}

	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Error("db open", "err", err)
		os.Exit(1)
	}
	defer conn.Close()

	repo := db.NewRepo(conn)
	llm := openrouter.New(cfg.OpenRouterAPIKey, cfg.OpenRouterBaseURL, cfg.AppURL, cfg.AppName)

	visibleModels := resolveModels(freeModels, cfg.DefaultModel)
	allowed := make([]string, len(visibleModels))
	for i, m := range visibleModels {
		allowed[i] = m.ID
	}
	svc := chat.NewService(repo, llm, chat.Options{
		DefaultModel:     cfg.DefaultModel,
		AllowedModels:    allowed,
		ContextThreshold: cfg.ContextThreshold,
		KeepRecent:       cfg.KeepRecent,
		Logger:           log,
	})

	handler := api.NewHandler(svc, log, cfg.DefaultModel, visibleModels)
	router := api.NewRouter(handler, log, cfg.AllowedOrigins)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Info("listening", "addr", srv.Addr, "model", cfg.DefaultModel)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("listen", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown", "err", err)
	}
}
