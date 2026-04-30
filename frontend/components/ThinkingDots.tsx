export function ThinkingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-fg-muted">
      <span
        className="inline-block h-2 w-2 rounded-full bg-current animate-bounce-dot"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="inline-block h-2 w-2 rounded-full bg-current animate-bounce-dot"
        style={{ animationDelay: "180ms" }}
      />
      <span
        className="inline-block h-2 w-2 rounded-full bg-current animate-bounce-dot"
        style={{ animationDelay: "360ms" }}
      />
      {label && <span className="ml-1 text-xs">{label}</span>}
    </div>
  );
}
