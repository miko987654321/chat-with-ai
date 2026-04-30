"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { LLMModel } from "@/lib/types";
import { CheckIcon } from "./Icons";

interface Props {
  value: string;
  disabled?: boolean;
  onChange: (modelId: string) => void | Promise<void>;
}

export function ModelPicker({ value, disabled, onChange }: Props) {
  const [models, setModels] = useState<LLMModel[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .listModels(ctrl.signal)
      .then((r) => setModels(r.models))
      .catch(() => setModels([]));
    return () => ctrl.abort();
  }, []);

  // close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!models) {
    return <div className="skeleton h-7 w-44 rounded-md" />;
  }

  const current = models.find((m) => m.id === value);

  const choose = async (id: string) => {
    if (id === value) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await onChange(id);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || busy}
        title={current?.description}
        className={clsx(
          "inline-flex max-w-[180px] items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-xs transition sm:max-w-none",
          "hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60",
          open && "bg-bg-subtle",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="hidden text-fg-subtle sm:inline">Модель:</span>
        <span className="truncate font-medium">{current?.name ?? value ?? "—"}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx("text-fg-subtle transition", open && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-30 mt-1.5 max-h-[70vh] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-bg-panel shadow-lg animate-fade-in"
        >
          {models.map((m) => {
            const active = m.id === value;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(m.id)}
                  className={clsx(
                    "flex w-full items-start gap-2 px-3 py-2 text-left transition",
                    active ? "bg-bg-subtle" : "hover:bg-bg-subtle",
                  )}
                >
                  <div className="mt-0.5 h-4 w-4 shrink-0 text-accent">
                    {active ? <CheckIcon width={14} height={14} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    {m.description && (
                      <div className="mt-0.5 text-xs text-fg-muted">{m.description}</div>
                    )}
                    <div className="mt-1 truncate font-mono text-[10px] text-fg-subtle">
                      {m.id}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
