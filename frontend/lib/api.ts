import type {
  Chat,
  ChatWithMessages,
  Message,
  ModelsResponse,
} from "./types";

const BASE =
  (typeof window === "undefined"
    ? process.env.BACKEND_URL
    : process.env.NEXT_PUBLIC_BACKEND_URL) ?? "http://localhost:8080";

async function request<T>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  async listChats(signal?: AbortSignal): Promise<Chat[]> {
    return request("/api/chats", { method: "GET", signal });
  },

  async createChat(model?: string): Promise<Chat> {
    return request("/api/chats", {
      method: "POST",
      body: JSON.stringify({ model: model ?? "" }),
    });
  },

  async getChat(id: string, signal?: AbortSignal): Promise<ChatWithMessages> {
    return request(`/api/chats/${id}`, { method: "GET", signal });
  },

  async renameChat(id: string, title: string): Promise<void> {
    return request(`/api/chats/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },

  async deleteChat(id: string): Promise<void> {
    return request(`/api/chats/${id}`, { method: "DELETE" });
  },

  async listModels(signal?: AbortSignal): Promise<ModelsResponse> {
    return request("/api/models", { method: "GET", signal });
  },

  /**
   * Streams an assistant reply over Server-Sent Events. Returns an async iterator-like helper:
   *
   *   for await (const ev of api.streamMessage(...)) { ... }
   *
   * Events:
   *   { type: "delta", content }  — incremental token chunk
   *   { type: "done", userMessage, assistantMessage }
   *   { type: "error", message }
   */
  streamMessage(
    chatId: string,
    content: string,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const url = `${BASE}/api/chats/${chatId}/messages`;
    return readSSE(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ content }),
        signal,
      }),
    );
  },
};

export type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; userMessage: Message; assistantMessage: Message }
  | { type: "error"; message: string };

async function* readSSE(
  responsePromise: Promise<Response>,
): AsyncGenerator<StreamEvent> {
  const res = await responsePromise;
  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      detail = await res.text();
    } catch {}
    yield { type: "error", message: `HTTP ${res.status}: ${detail}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const ev = parseSSEFrame(raw);
        if (ev) yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSSEFrame(frame: string): StreamEvent | null {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (event === "delta") return { type: "delta", content: parsed.content };
    if (event === "done")
      return {
        type: "done",
        userMessage: parsed.user_message,
        assistantMessage: parsed.assistant_message,
      };
    if (event === "error")
      return { type: "error", message: parsed.message ?? "Unknown error" };
  } catch {
    return null;
  }
  return null;
}
