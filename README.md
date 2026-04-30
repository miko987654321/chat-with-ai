# Chat with AI

Веб-приложение для общения с нейросетью с историей диалогов. Работает поверх **бесплатных моделей OpenRouter**, без авторизации, с управлением длинным контекстом и автоматическим определением темы чата.

> Реализовано как два отдельных сервиса (фронтенд + бэкенд), упаковано в Docker, с готовым CI/CD на GitHub Actions для деплоя на сервер.

---

## Содержание

- [Демо-функциональность](#демо-функциональность)
- [Архитектура](#архитектура)
- [Стек и обоснование выбора](#стек-и-обоснование-выбора)
- [Решение проблемы переполнения контекста](#решение-проблемы-переполнения-контекста)
- [API](#api)
- [Локальный запуск](#локальный-запуск)
- [Запуск в Docker](#запуск-в-docker)
- [Деплой на сервер через GitHub Actions](#деплой-на-сервер-через-github-actions)
- [Структура репозитория](#структура-репозитория)
- [Тесты и проверки](#тесты-и-проверки)
- [Использованные ИИ-инструменты](#использованные-ии-инструменты)

---

## Демо-функциональность

- **Список диалогов** с группировкой по дате (Сегодня / Вчера / Эта неделя / …), переименованием и удалением.
- **Авто-определение темы** — после первого ответа ассистента отдельным запросом к LLM генерируется короткий заголовок 3–6 слов на языке пользователя.
- **Чат с нейросетью со стримингом** через Server-Sent Events: ответ появляется по мере генерации, можно прервать кнопкой «Stop».
- **Управление контекстным окном**: длинные диалоги автоматически сворачиваются в running summary, а LLM получает summary + последние N сообщений.
- **Markdown-рендеринг** ответов, подсветка кода, GFM-таблицы.
- **Skeleton-лоадеры** на загрузке списка чатов и сообщений, корректные `disabled`/`loading` состояния всех кнопок и полей ввода.
- **Тёмная тема** через `prefers-color-scheme`.
- **SQLite WAL** для конкурентного чтения, каскадное удаление сообщений при удалении чата.

## Архитектура

```
┌──────────────────┐        HTTP/JSON + SSE        ┌──────────────────┐         HTTPS         ┌────────────┐
│   Next.js (App   │ ───────────────────────────▶  │   Go (chi)       │ ───────────────────▶  │ OpenRouter │
│   Router, RSC)   │ ◀───────  delta/done/error ── │   service        │ ◀────────  stream ─── │   API      │
└──────────────────┘                               └────────┬─────────┘                       └────────────┘
                                                            │
                                                       SQLite (WAL)
                                                       chats, messages
```

Бэкенд хранит чаты и сообщения, проксирует запросы в OpenRouter, стримит ответы во фронтенд через SSE и в фоне выполняет «обслуживание» чата (авто-заголовок, обновление summary).

## Стек и обоснование выбора

### Backend — Go 1.26 + chi + SQLite (`modernc.org/sqlite`)

- **Go**: один статически слинкованный бинарь, нативная поддержка стриминга и graceful shutdown, отличный CPU-профиль для долгих SSE-соединений. Идеален для прокси-сервиса между UI и LLM.
- **chi** — минималистичный роутер с middleware-стеком в стиле `net/http`, без магии. Логирование, recover, CORS, request-id берутся из коробки.
- **SQLite** — одной файловой БД достаточно для задачи: нет авторизации и юзеров, нагрузка низкая. WAL даёт безопасные конкурентные чтения. Используется **`modernc.org/sqlite`** — pure-Go драйвер, **CGO не нужен**, что упрощает Dockerfile (alpine + статический бинарь, образ ~25 МБ).
- **slog** (stdlib) — структурированное JSON-логирование без сторонних зависимостей.
- **OpenRouter** — собственный HTTP-клиент, поддерживает обычный `Complete` и потоковый `Stream` (парсер SSE через `bufio.Reader`). Отдельных SDK не подключал — формат запроса/ответа OpenAI-совместим, проще держать всё в 150 строк.

### Frontend — Next.js 15 (App Router) + React 19 + Tailwind

- **Next.js (App Router)** — задание разрешало Next.js или Nuxt; выбран Next, т.к. SSE-стриминг и React Server Components на App Router работают предсказуемо. `output: "standalone"` собирает минимальный рантайм для Docker.
- **Tailwind v3** + CSS-переменные для темизации — нет лишних зависимостей вроде UI-библиотек, контролируем каждый пиксель. Свой набор иконок без `lucide`/`react-icons`, чтобы не раздувать бандл.
- **react-markdown + remark-gfm + rehype-highlight** — рендеринг ответов LLM с поддержкой таблиц, чек-листов и подсветки кода.
- **Стриминг** на клиенте читается напрямую из `Response.body` (`ReadableStream` + `TextDecoder`) — без EventSource (он не поддерживает POST с телом запроса).

### База данных — SQLite

- Простая, файловая, не требует отдельного контейнера. Один volume в Docker — `chat-data` — переживает redeploy.
- Если в будущем потребуется горизонтальное масштабирование — переход на Postgres сводится к замене драйвера и тривиальной правке схемы (мы уже используем `database/sql`).

## Решение проблемы переполнения контекста

ТЗ явно требовало решить проблему «как не переполнить контекстное окно при длительном общении в одном чате». Реализовано так:

1. **Каждое сообщение хранится в БД полностью** — пользователь всегда видит весь диалог.
2. **Грубая оценка токенов** делается через `len(content) / 4` — стабильная эвристика без model-specific токенайзера. Мы не претендуем на точность, нам нужно понимать «много / мало».
3. **Поле `chats.summary`** хранит running-summary — компактное краткое содержание уже произошедшего разговора.
4. **Логика построения промпта** (`internal/chat/context.go::buildPrompt`):
   - Пока summary пустой — отправляем всю историю в LLM (короткие чаты остаются без потерь).
   - Как только summary появился — в LLM уходит `[system: summary] + последние N сообщений` (по умолчанию `KEEP_RECENT_MESSAGES=8`). Старые сообщения остаются в БД и в UI, но НЕ передаются модели — они уже сжаты в summary.
5. **Триггер обновления summary** запускается в фоне после каждого ответа ассистента (`MaybeSummarize`):
   - Если суммарная оценка токенов истории > `CONTEXT_THRESHOLD_TOKENS` (по умолчанию 6000) и сообщений больше `KEEP_RECENT`, мы берём «старую» часть истории и **просим LLM** обновить summary, передав предыдущий summary + новые сообщения.
6. **Авто-заголовок** — отдельный фоновый запрос к LLM после первого обмена сообщениями (`MaybeAutoTitle`), с просьбой выдать строго 3–6 слов на языке пользователя.

Этот подход (sliding-window + rolling summary) — компромисс между «дешёвым truncation» и «дорогим map-reduce summarisation»: дополнительно платим **один** короткий вызов LLM на N ходов вместо постоянной полной суммаризации, а контекст всегда укладывается в окно бесплатной модели.

Все параметры (порог токенов, число «свежих» сообщений) конфигурируются через переменные окружения — см. `backend/.env.example`.

## API

| Метод | Путь | Назначение |
|---|---|---|
| `GET`  | `/health` | Healthcheck |
| `GET`  | `/api/models` | Список доступных бесплатных моделей |
| `GET`  | `/api/chats` | Список чатов (последний обновлённый сверху) |
| `POST` | `/api/chats` | Создать новый чат `{ "model": "..." }` |
| `GET`  | `/api/chats/{id}` | Чат с сообщениями |
| `PATCH`| `/api/chats/{id}` | Переименовать `{ "title": "..." }` |
| `DELETE`| `/api/chats/{id}` | Удалить (каскадно сообщения) |
| `POST` | `/api/chats/{id}/messages` | Отправить сообщение, **SSE-стрим ответа** |

SSE-события стриминга:

```
event: delta
data: {"content":"кусочек "}

event: done
data: {"user_message": {...}, "assistant_message": {...}}

event: error
data: {"message": "..."}
```

## Локальный запуск

### Требования

- Go 1.26+
- Node 22+ / npm 11+
- API-ключ OpenRouter (бесплатная регистрация на <https://openrouter.ai>)

### Бэкенд

```bash
cd backend
cp .env.example .env       # вставьте OPENROUTER_API_KEY
go run ./cmd/server
# слушает http://localhost:8080
```

### Фронтенд

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
# открывайте http://localhost:3000
```

## Запуск в Docker

В корне проекта:

```bash
cp .env.example .env       # OPENROUTER_API_KEY обязательно
docker compose up --build -d
# фронтенд: http://localhost:3000
# бэкенд:   http://localhost:8080
```

`chat-data` — именованный volume с SQLite-файлом, переживает `docker compose down`.

## Деплой на сервер через GitHub Actions

Репозиторий содержит два workflow:

- `.github/workflows/ci.yml` — лента CI на каждый push/PR: `go vet`/`go test -race`, `tsc --noEmit`, `next lint`, `next build`.
- `.github/workflows/release.yml` — на push в `main` или git-тег `v*.*.*`:
  1. Билдит мульти-стейдж образы `backend` и `frontend`.
  2. Публикует их в **GitHub Container Registry** под именами `ghcr.io/<owner>/<repo>-backend` и `…-frontend` с тегами `latest`, `sha-…`, и semver при тегах.
  3. По SSH копирует `docker-compose.prod.yml` на сервер и выполняет `docker compose pull && up -d`.

### Что нужно настроить

В **Settings → Secrets and variables → Actions** репозитория добавьте:

| Тип | Имя | Значение |
|---|---|---|
| Secret | `OPENROUTER_API_KEY` | Ваш ключ OpenRouter (читается на сервере, см. ниже) |
| Secret | `DEPLOY_HOST` | IP/домен сервера |
| Secret | `DEPLOY_USER` | SSH-пользователь |
| Secret | `DEPLOY_SSH_KEY` | Приватный SSH-ключ (содержимое файла) |
| Secret | `DEPLOY_PORT` | Порт SSH (опционально, по умолчанию 22) |
| Secret | `DEPLOY_PATH` | Путь на сервере, по умолчанию `/opt/chat-with-ai` |
| Variable | `NEXT_PUBLIC_BACKEND_URL` | Публичный URL вашего бэкенда (например, `https://api.example.com`) |

Также создайте окружение **`production`** (Settings → Environments) — оно используется в `release.yml` и позволяет требовать ручное подтверждение деплоя.

### Подготовка сервера (один раз)

```bash
# на сервере
sudo mkdir -p /opt/chat-with-ai
sudo chown $USER:$USER /opt/chat-with-ai
cd /opt/chat-with-ai

# создаём .env, который будет читаться docker compose
cat > .env <<'EOF'
OPENROUTER_API_KEY=sk-or-v1-...
ALLOWED_ORIGINS=https://chat.example.com
APP_URL=https://chat.example.com
NEXT_PUBLIC_BACKEND_URL=https://api.example.com
GITHUB_REPOSITORY=<owner>/chat-with-ai
EOF

# Docker должен быть установлен заранее: https://docs.docker.com/engine/install/
```

После этого любой `git push` в `main` соберёт образы, опубликует их в GHCR и обновит сервис на сервере. Откатиться можно вручную — `IMAGE_TAG=sha-<short> docker compose -f docker-compose.prod.yml up -d`.

> **TLS / реверс-прокси.** В этом репо не включён nginx/traefik — в зависимости от инфраструктуры удобнее ставить его отдельно (например, Caddy с авто-Let's Encrypt). Пробрасывайте `chat.example.com → frontend:3000`, `api.example.com → backend:8080`.

## Структура репозитория

```
chat-with-ai/
├─ backend/              # Go + chi + SQLite
│  ├─ cmd/server/        # точка входа (main.go)
│  └─ internal/
│     ├─ api/            # HTTP-роутер и handlers
│     ├─ chat/           # бизнес-логика, контекст-менеджмент
│     ├─ config/
│     ├─ db/             # репозиторий + миграции
│     ├─ models/
│     └─ openrouter/     # клиент OpenRouter (Complete + Stream)
├─ frontend/             # Next.js 15 App Router
│  ├─ app/               # layout, page, globals.css
│  ├─ components/        # Sidebar, ChatView, MessageInput, и т.д.
│  └─ lib/               # api-клиент, типы, форматирование
├─ .github/workflows/    # CI и Release/Deploy
├─ docker-compose.yml         # локальная сборка
├─ docker-compose.prod.yml    # прод (тянет образы из GHCR)
└─ .env.example
```

## Тесты и проверки

- **Бэкенд**: `cd backend && go test -race ./...` — покрыты конструирование промпта (с/без summary), эвристика токенов, репозиторий SQLite (CRUD + каскадное удаление), санитизация авто-заголовков.
- **Фронтенд**: `cd frontend && npm run typecheck && npm run lint && npm run build`.
- В CI оба прогона запускаются на каждый push/PR.

## Использованные ИИ-инструменты

- **Claude Code** (Anthropic CLI, Opus 4.7) — основной инструмент: проектирование архитектуры, реализация бэкенда и фронтенда, написание тестов, Dockerfile-ов, GitHub Actions и этой документации. Использовался в одном сеансе, итеративно.
- **OpenRouter** — рантайм-провайдер LLM для самого приложения (бесплатные модели, суффикс `:free`).

---

Если что-то отвалилось — сначала проверьте `docker compose logs -f backend`, потом `frontend`. На бесплатных моделях OpenRouter иногда отвечают медленно или возвращают `429`; для теста переключите модель в `DEFAULT_MODEL` (см. список в `backend/cmd/server/main.go`).
