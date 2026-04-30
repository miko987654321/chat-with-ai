"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import clsx from "clsx";
import { SendIcon, StopIcon } from "./Icons";

export interface MessageInputHandle {
  focus: () => void;
}

interface Props {
  onSubmit: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput = forwardRef<MessageInputHandle, Props>(
  function MessageInput(
    { onSubmit, onStop, isStreaming, disabled, placeholder },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState("");

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
    }, [value]);

    const submit = () => {
      const text = value.trim();
      if (!text || disabled || isStreaming) return;
      onSubmit(text);
      setValue("");
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        submit();
      }
    };

    const canSend = value.trim().length > 0 && !disabled && !isStreaming;

    return (
      <div className="border-t border-border bg-bg-panel">
        <div className="mx-auto w-full max-w-3xl p-4">
          <div
            className={clsx(
              "flex items-end gap-2 rounded-2xl border border-border bg-bg p-2 transition",
              "focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgb(var(--accent)/0.12)]",
              disabled && "opacity-60",
            )}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              rows={1}
              placeholder={placeholder ?? "Напишите сообщение… (Enter — отправить, Shift+Enter — перенос)"}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fg text-bg transition hover:opacity-90"
                aria-label="Остановить генерацию"
                title="Остановить"
              >
                <StopIcon width={16} height={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className={clsx(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                  canSend
                    ? "bg-accent text-accent-fg hover:opacity-90"
                    : "bg-bg-subtle text-fg-subtle",
                )}
                aria-label="Отправить"
                title="Отправить"
              >
                <SendIcon width={16} height={16} />
              </button>
            )}
          </div>
          <div className="mt-2 px-1 text-[11px] text-fg-subtle">
            Бесплатные модели могут отвечать с задержкой. Контекст диалога управляется автоматически.
          </div>
        </div>
      </div>
    );
  },
);
