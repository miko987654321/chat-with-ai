"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = theme;
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // initial pick + react to system changes when theme === "system"
  useEffect(() => {
    setMounted(true);
    setTheme(readTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cycle = () => {
    const next: Theme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    if (next === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    applyTheme(next);
  };

  const label =
    theme === "light"
      ? "Светлая тема"
      : theme === "dark"
        ? "Тёмная тема"
        : "Системная тема";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label + " (нажмите, чтобы переключить)"}
      aria-label={label}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-fg-muted transition",
        "hover:bg-bg-subtle hover:text-fg",
        className,
      )}
    >
      {/* Stable SSR icon (sun); replaced after hydration to match user pref. */}
      {!mounted || theme === "light" ? (
        <SunIcon />
      ) : theme === "dark" ? (
        <MoonIcon />
      ) : (
        <SystemIcon />
      )}
    </button>
  );
}

const svgBase = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SunIcon() {
  return (
    <svg {...svgBase}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...svgBase}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg {...svgBase}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
