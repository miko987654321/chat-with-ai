import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat with AI",
  description: "Веб-чат с нейросетью на базе OpenRouter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-bg text-fg">{children}</body>
    </html>
  );
}
