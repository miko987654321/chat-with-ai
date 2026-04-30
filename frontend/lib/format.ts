export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} дн назад`;
  return date.toLocaleDateString("ru-RU");
}

export function groupChatsByDate<T extends { updated_at: string }>(
  chats: T[],
): { label: string; items: T[] }[] {
  const groups: Record<string, T[]> = {
    Сегодня: [],
    Вчера: [],
    "Эта неделя": [],
    "Этот месяц": [],
    Старее: [],
  };
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfDay);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(startOfDay);
  startOfMonth.setMonth(startOfMonth.getMonth() - 1);

  for (const chat of chats) {
    const t = new Date(chat.updated_at);
    if (t >= startOfDay) groups["Сегодня"].push(chat);
    else if (t >= startOfYesterday) groups["Вчера"].push(chat);
    else if (t >= startOfWeek) groups["Эта неделя"].push(chat);
    else if (t >= startOfMonth) groups["Этот месяц"].push(chat);
    else groups["Старее"].push(chat);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}
