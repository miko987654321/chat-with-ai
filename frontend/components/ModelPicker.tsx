"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { LLMModel } from "@/lib/types";

interface Props {
  value?: string | null;
  disabled?: boolean;
}

export function ModelPicker({ value, disabled }: Props) {
  const [models, setModels] = useState<LLMModel[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .listModels(ctrl.signal)
      .then((r) => setModels(r.models))
      .catch(() => setModels([]));
    return () => ctrl.abort();
  }, []);

  if (!models) {
    return <div className="skeleton h-7 w-48 rounded-md" />;
  }

  const current = models.find((m) => m.id === value);

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-xs",
        disabled && "opacity-60",
      )}
      title={current?.description}
    >
      <span className="text-fg-subtle">Модель:</span>
      <span className="font-medium">{current?.name ?? value ?? "—"}</span>
    </div>
  );
}
