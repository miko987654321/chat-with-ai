"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ChatWithMessages, Message } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { MessageInput, type MessageInputHandle } from "./MessageInput";
import { MessagesSkeleton } from "./Skeletons";
import { ModelPicker } from "./ModelPicker";
import { SparkleIcon } from "./Icons";

interface Props {
  chatId: string;
  onTurnComplete: () => void;
}

export function ChatView({ chatId, onTurnComplete }: Props) {
  const [chat, setChat] = useState<ChatWithMessages | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");

  const inputRef = useRef<MessageInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chat + messages whenever chatId changes.
  useEffect(() => {
    const ctrl = new AbortController();
    setChat(null);
    setMessages([]);
    setError(null);
    setStreamBuffer("");
    api
      .getChat(chatId, ctrl.signal)
      .then((data) => {
        setChat(data);
        setMessages(data.messages ?? []);
        requestAnimationFrame(() => inputRef.current?.focus());
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err.message);
      });
    return () => {
      ctrl.abort();
      abortRef.current?.abort();
    };
  }, [chatId]);

  // Auto-scroll to bottom when messages or stream buffer change.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamBuffer, streaming]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!chat) return;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStreaming(true);
      setError(null);
      setStreamBuffer("");

      // Optimistic user bubble — replaced with the real one when `done` arrives.
      const optimisticUser: Message = {
        id: `pending-user-${Date.now()}`,
        chat_id: chat.id,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const stream = api.streamMessage(chat.id, text, ctrl.signal);
        let buf = "";
        let finalised = false;
        for await (const ev of stream) {
          if (ev.type === "delta") {
            buf += ev.content;
            setStreamBuffer(buf);
          } else if (ev.type === "done") {
            finalised = true;
            setMessages((prev) => {
              const withoutOptimistic = prev.filter((m) => m.id !== optimisticUser.id);
              return [...withoutOptimistic, ev.userMessage, ev.assistantMessage];
            });
            setStreamBuffer("");
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
        if (!finalised && buf) {
          // Stream ended without an explicit `done` (e.g., aborted) — keep what we got.
          setMessages((prev) => [
            ...prev,
            {
              id: `partial-${Date.now()}`,
              chat_id: chat.id,
              role: "assistant",
              content: buf,
              created_at: new Date().toISOString(),
            },
          ]);
          setStreamBuffer("");
        }
      } catch (err) {
        if (ctrl.signal.aborted) {
          // User stopped generation — keep partial buffer as a final assistant message.
          if (streamBuffer) {
            setMessages((prev) => [
              ...prev,
              {
                id: `partial-${Date.now()}`,
                chat_id: chat.id,
                role: "assistant",
                content: streamBuffer,
                created_at: new Date().toISOString(),
              },
            ]);
          }
          setStreamBuffer("");
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          // Remove the optimistic user bubble if the request failed before any reply.
          setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        onTurnComplete();
      }
    },
    [chat, onTurnComplete, streamBuffer],
  );

  if (error && !chat) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-red-500">
        Не удалось загрузить чат: {error}
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border p-3">
          <div className="skeleton h-6 w-1/3 rounded" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <MessagesSkeleton />
        </div>
        <div className="border-t border-border p-4">
          <div className="skeleton mx-auto h-12 w-full max-w-3xl rounded-2xl" />
        </div>
      </div>
    );
  }

  const showEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-bg-panel/60 px-4 py-3 backdrop-blur">
        <h1 className="truncate text-sm font-semibold">{chat.title || "Без названия"}</h1>
        <ModelPicker value={chat.model} disabled={streaming} />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
          {showEmpty && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <SparkleIcon width={22} height={22} />
              </div>
              <h2 className="text-xl font-semibold">Начните диалог</h2>
              <p className="max-w-md text-sm text-fg-muted">
                Спросите что угодно. Тема чата определится автоматически по первому сообщению.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {streaming && (
            <MessageBubble
              key="streaming"
              message={{ role: "assistant", content: streamBuffer }}
              pending
            />
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
              Ошибка: {error}
            </div>
          )}
        </div>
      </div>

      <MessageInput
        ref={inputRef}
        onSubmit={handleSubmit}
        onStop={handleStop}
        isStreaming={streaming}
      />
    </div>
  );
}
