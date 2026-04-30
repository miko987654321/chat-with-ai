"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import clsx from "clsx";
import type { Message } from "@/lib/types";
import { SparkleIcon } from "./Icons";

interface BubbleProps {
  message: Pick<Message, "role" | "content">;
  pending?: boolean;
}

function MessageBubbleImpl({ message, pending }: BubbleProps) {
  const isUser = message.role === "user";
  return (
    <div
      className={clsx(
        "flex w-full gap-3 animate-fade-in",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <SparkleIcon width={14} height={14} />
        </div>
      )}
      <div
        className={clsx(
          "prose-msg max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px]",
          isUser
            ? "bg-accent text-accent-fg rounded-br-md"
            : "bg-bg-subtle text-fg rounded-bl-md",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content || ""}
            </ReactMarkdown>
            {pending && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-fg-muted align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
