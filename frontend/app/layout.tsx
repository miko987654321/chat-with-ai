import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat with AI",
  description: "Веб-чат с нейросетью на базе OpenRouter",
};

// Inlined synchronously to avoid a flash of light theme. Mirrors the logic in ThemeToggle:
// stored choice wins; otherwise we follow the OS preference for the very first visit, then
// the user's explicit toggle is persisted from then on.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = (stored === "light" || stored === "dark")
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bg text-fg">{children}</body>
    </html>
  );
}
