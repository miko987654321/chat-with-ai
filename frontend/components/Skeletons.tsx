export function ChatListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-9 rounded-lg"
          style={{ opacity: 1 - i * 0.1 }}
        />
      ))}
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-12 w-3/4 self-end rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-20 w-full rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-10 w-1/2 self-end rounded-2xl" />
      </div>
    </div>
  );
}
