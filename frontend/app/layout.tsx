import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat with AI",
  description: "Веб-чат с нейросетью на базе OpenRouter",
};

// Inlined synchronously to avoid a flash of light theme. Mirrors the logic in ThemeToggle.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = stored === "dark" || (stored !== "light" && systemDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = stored || "system";
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
