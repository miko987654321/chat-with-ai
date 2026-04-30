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
// the task. The list is restricted to models that actually serve traffic on the free tier as of
// this build — OpenRouter rotates these often, so probe with a "hi" request before adding.
// Context sizes are approximate and only used for the model-picker hint.
var freeModels = []models.LLMModel{
	{ID: "z-ai/glm-4.5-air:free", Name: "GLM 4.5 Air", Description: "Универсальная модель Zhipu, хороша в диалогах и рассуждениях", ContextSize: 131072},
	{ID: "openai/gpt-oss-120b:free", Name: "GPT-OSS 120B", Description: "Открытые веса OpenAI, большая модель для сложных задач", ContextSize: 131072},
	{ID: "openai/gpt-oss-20b:free", Name: "GPT-OSS 20B", Description: "Лёгкая модель OpenAI, быстрая и общедоступная", ContextSize: 131072},
	{ID: "minimax/minimax-m2.5:free", Name: "MiniMax M2.5", Description: "Сильная модель MiniMax для длинных диалогов", ContextSize: 196608},
	{ID: "nvidia/nemotron-3-super-120b-a12b:free", Name: "Nemotron 3 Super 120B", Description: "Большая instruct-модель Nvidia с очень длинным контекстом", ContextSize: 262144},
	{ID: "tencent/hy3-preview:free", Name: "Hunyuan 3 Preview", Description: "Мультиязычная модель Tencent Hunyuan", ContextSize: 262144},
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
