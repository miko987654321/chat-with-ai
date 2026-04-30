package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port              string
	DBPath            string
	OpenRouterAPIKey  string
	OpenRouterBaseURL string
	DefaultModel      string
	AllowedOrigins    []string
	AppURL            string
	AppName           string
	ContextThreshold  int
	KeepRecent        int
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		DBPath:            getEnv("DB_PATH", "./data/chat.db"),
		OpenRouterAPIKey:  os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterBaseURL: getEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
		DefaultModel:      getEnv("DEFAULT_MODEL", "deepseek/deepseek-chat-v3-0324:free"),
		AllowedOrigins:    splitCSV(getEnv("ALLOWED_ORIGINS", "http://localhost:3000")),
		AppURL:            getEnv("APP_URL", "http://localhost:3000"),
		AppName:           getEnv("APP_NAME", "Chat with AI"),
		ContextThreshold:  getEnvInt("CONTEXT_THRESHOLD_TOKENS", 6000),
		KeepRecent:        getEnvInt("KEEP_RECENT_MESSAGES", 8),
	}

	if cfg.OpenRouterAPIKey == "" {
		return nil, errors.New("OPENROUTER_API_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
