"use client";

import { useCallback, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { api } from "@/lib/api";
import { SparkleIcon } from "@/components/Icons";

export default function HomePage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshChats = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleCreate = useCallback(async () => {
    const chat = await api.createChat();
    setActiveId(chat.id);
    refreshChats();
  }, [refreshChats]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id || null);
  }, []);

  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        activeId={activeId}
        onSelect={handleSelect}
        onCreate={handleCreate}
        refreshKey={refreshKey}
      />
      <section className="flex-1 overflow-hidden">
        {activeId ? (
          <ChatView
            key={activeId}
            chatId={activeId}
            onTurnComplete={refreshChats}
          />
        ) : (
          <EmptyState onCreate={handleCreate} />
        )}
      </section>
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => Promise<void> | void }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <SparkleIcon width={26} height={26} />
        </div>
        <h1 className="text-2xl font-semibold">Чат с нейросетью</h1>
        <p className="text-sm text-fg-muted">
          Бесплатные модели OpenRouter, история диалогов, авто-определение темы и плавная работа
          с длинным контекстом.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          Начать новый чат
        </button>
      </div>
    </div>
  );
}
