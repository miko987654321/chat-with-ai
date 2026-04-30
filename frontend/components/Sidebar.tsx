"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Chat } from "@/lib/types";
import { groupChatsByDate } from "@/lib/format";
import { ChatListSkeleton } from "./Skeletons";
import { ThemeToggle } from "./ThemeToggle";
import { PlusIcon, PencilIcon, TrashIcon, MessageIcon, CheckIcon, XIcon } from "./Icons";

// Bind body scroll-lock + Escape close to the mobile drawer state. Static layout on md+ ignores
// these because the sidebar is always visible.
function useMobileDrawer(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

interface SidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => Promise<void> | void;
  refreshKey: number;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ activeId, onSelect, onCreate, refreshKey, open, onClose }: SidebarProps) {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    api
      .listChats(ctrl.signal)
      .then((data) => setChats(data))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err.message);
        setChats([]);
      });
    return () => ctrl.abort();
  }, [refreshKey]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreate();
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    const title = renameValue.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    try {
      await api.renameChat(id, title);
      setChats((prev) =>
        prev?.map((c) => (c.id === id ? { ...c, title } : c)) ?? null,
      );
    } finally {
      setRenamingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить чат? Историю сообщений вернуть не получится.")) return;
    setDeletingId(id);
    try {
      await api.deleteChat(id);
      setChats((prev) => prev?.filter((c) => c.id !== id) ?? null);
      if (activeId === id) onSelect("");
    } finally {
      setDeletingId(null);
    }
  };

  const groups = chats ? groupChatsByDate(chats) : [];
  useMobileDrawer(open, onClose);

  return (
    <>
      {/* Backdrop — only rendered on mobile when drawer is open */}
      <div
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />

      <aside
        className={clsx(
          "z-40 flex h-full w-72 shrink-0 flex-col border-r border-border bg-bg-panel",
          // Mobile: fixed drawer that slides in from the left.
          "fixed inset-y-0 left-0 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop (md+): static, always visible, no transform.
          "md:static md:translate-x-0",
        )}
      >
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageIcon className="text-accent" />
          Chat with AI
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-fg-muted transition hover:bg-bg-subtle hover:text-fg md:hidden"
            aria-label="Закрыть меню"
          >
            <XIcon width={16} height={16} />
          </button>
        </div>
      </div>
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className={clsx(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg px-2.5 py-2 text-sm font-medium",
            "transition hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60",
          )}
          aria-label="Новый чат"
        >
          <PlusIcon width={14} height={14} />
          {creating ? "Создаём…" : "Новый чат"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats === null && <ChatListSkeleton />}
        {chats !== null && chats.length === 0 && !error && (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-fg-muted">
            Пока нет чатов.
            <br />
            Нажмите «Новый чат», чтобы начать.
          </div>
        )}
        {error && (
          <div className="m-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
            Не удалось загрузить чаты: {error}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="px-2 pt-3">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              {group.label}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((c) => {
                const active = c.id === activeId;
                const renaming = renamingId === c.id;
                return (
                  <li key={c.id}>
                    <div
                      className={clsx(
                        "group relative flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition",
                        active
                          ? "bg-bg-subtle text-fg"
                          : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                      )}
                    >
                      {renaming ? (
                        <>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(c.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
                          />
                          <button
                            type="button"
                            onClick={() => handleRename(c.id)}
                            className="rounded p-1 text-fg-muted hover:bg-bg hover:text-fg"
                            aria-label="Сохранить"
                          >
                            <CheckIcon width={14} height={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            className="rounded p-1 text-fg-muted hover:bg-bg hover:text-fg"
                            aria-label="Отменить"
                          >
                            <XIcon width={14} height={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onSelect(c.id)}
                            className="flex-1 truncate text-left"
                            title={c.title}
                          >
                            {c.title || "Без названия"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(c.id);
                              setRenameValue(c.title);
                            }}
                            className="invisible rounded p-1 text-fg-subtle group-hover:visible hover:bg-bg hover:text-fg"
                            aria-label="Переименовать"
                          >
                            <PencilIcon width={14} height={14} />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === c.id}
                            onClick={() => handleDelete(c.id)}
                            className="invisible rounded p-1 text-fg-subtle group-hover:visible hover:bg-bg hover:text-red-500 disabled:opacity-50"
                            aria-label="Удалить"
                          >
                            <TrashIcon width={14} height={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-3 text-[11px] text-fg-subtle">
        Абдуллаев Меирхан
      </div>
      </aside>
    </>
  );
}
