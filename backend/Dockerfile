# syntax=docker/dockerfile:1.7

FROM golang:1.26-alpine AS builder
WORKDIR /src
ENV CGO_ENABLED=0 GOFLAGS=-mod=readonly

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server


FROM alpine:3.20
RUN apk add --no-cache ca-certificates tini && \
    addgroup -S app && adduser -S -G app app && \
    mkdir -p /data && chown -R app:app /data
WORKDIR /app
COPY --from=builder /out/server /app/server

USER app
ENV PORT=8080 DB_PATH=/data/chat.db
EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/app/server"]
