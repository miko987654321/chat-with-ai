"use client";

import { useCallback, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { api } from "@/lib/api";
import { SparkleIcon, MenuIcon } from "@/components/Icons";

export default function HomePage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshChats = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleCreate = useCallback(async () => {
    const chat = await api.createChat();
    setActiveId(chat.id);
    setSidebarOpen(false);
    refreshChats();
  }, [refreshChats]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id || null);
    setSidebarOpen(false);
  }, []);

  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        activeId={activeId}
        onSelect={handleSelect}
        onCreate={handleCreate}
        refreshKey={refreshKey}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeId ? (
          <ChatView
            key={activeId}
            chatId={activeId}
            onTurnComplete={refreshChats}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        ) : (
          <EmptyState
            onCreate={handleCreate}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
      </section>
    </main>
  );
}

function EmptyState({
  onCreate,
  onOpenSidebar,
}: {
  onCreate: () => Promise<void> | void;
  onOpenSidebar: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-bg-panel/60 px-3 py-2 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg text-fg-muted transition hover:bg-bg-subtle hover:text-fg"
          aria-label="Открыть меню"
        >
          <MenuIcon width={18} height={18} />
        </button>
        <span className="text-sm font-semibold">Chat with AI</span>
        <span className="w-9" />
      </header>
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <SparkleIcon width={26} height={26} />
          </div>
          <h1 className="text-xl font-semibold sm:text-2xl">Чат с нейросетью</h1>
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
    </div>
  );
}
