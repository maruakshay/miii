"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { Loader2Icon, SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { SlashItem, SlashLineContext } from "./slash-helpers";
import { getSlashLineContext } from "./slash-helpers";

type Props = {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  cursorPos: number;
  setCursorPos: (n: number) => void;
  sending: boolean;
  sendDisabled: boolean;
  onSend: () => void;
  slashMenuActive: boolean;
  slashFiltered: SlashItem[];
  slashHighlight: number;
  setSlashHighlight: Dispatch<SetStateAction<number>>;
  slashCtx: SlashLineContext | null;
  applySlashItem: (item: SlashItem, ctx: SlashLineContext) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  composerRef: RefObject<HTMLDivElement | null>;
};

export function ChatComposer({
  input,
  setInput,
  cursorPos,
  setCursorPos,
  sending,
  sendDisabled,
  onSend,
  slashMenuActive,
  slashFiltered,
  slashHighlight,
  setSlashHighlight,
  slashCtx,
  applySlashItem,
  textareaRef,
  composerRef,
}: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 pt-2 md:px-6 md:pl-[260px]">
      <div
        ref={composerRef}
        data-miii-composer-wrap
        className="pointer-events-auto flex w-full max-w-[44rem] items-end gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-composer)] p-2 pl-3 shadow-[0_8px_32px_rgba(45,42,32,0.08)] sm:gap-3 sm:p-2.5 sm:pl-4"
        style={{
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="relative flex min-w-0 flex-1 flex-col">
          {slashMenuActive ? (
            <div
              className="absolute bottom-full left-0 right-0 z-40 mb-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--chat-border)] bg-[var(--chat-composer)] py-1 shadow-lg"
              role="listbox"
              aria-label="Commands"
              onMouseDown={(e) => e.preventDefault()}
            >
              {slashFiltered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#8a8475]">
                  No matching commands
                </p>
              ) : (
                slashFiltered.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={i === slashHighlight}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors",
                      i === slashHighlight
                        ? "bg-[var(--chat-sidebar-hover)]"
                        : "hover:bg-[#f0efe9]",
                    )}
                    onMouseEnter={() => setSlashHighlight(i)}
                    onClick={() => {
                      if (slashCtx) applySlashItem(item, slashCtx);
                    }}
                  >
                    <span className="font-medium text-[#2d2a20]">
                      {item.label}
                    </span>
                    <span className="text-xs text-[#8a8475]">
                      {item.description}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
          <Textarea
            ref={textareaRef}
            data-miii-composer
            placeholder="How can I help?"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setCursorPos(e.target.selectionStart ?? 0);
            }}
            onSelect={(e) =>
              setCursorPos(e.currentTarget.selectionStart ?? 0)
            }
            onKeyUp={(e) =>
              setCursorPos(e.currentTarget.selectionStart ?? 0)
            }
            rows={2}
            className={cn(
              "field-sizing-content min-h-[48px] max-h-40 w-full min-w-0 resize-none rounded-xl border-0 bg-transparent px-1 py-2.5 text-[15px] leading-snug shadow-none",
              "text-[#2d2a20] caret-[#c45c3e] placeholder:text-[#9a9485]",
              "focus-visible:ring-0 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            disabled={sending}
            onKeyDown={(e) => {
              if (
                slashMenuActive &&
                slashFiltered.length > 0 &&
                (e.key === "ArrowDown" || e.key === "ArrowUp")
              ) {
                e.preventDefault();
                if (e.key === "ArrowDown") {
                  setSlashHighlight(
                    (h) => (h + 1) % slashFiltered.length,
                  );
                } else {
                  setSlashHighlight(
                    (h) =>
                      (h - 1 + slashFiltered.length) % slashFiltered.length,
                  );
                }
                return;
              }
              if (
                slashMenuActive &&
                slashFiltered.length > 0 &&
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                const pick = slashFiltered[slashHighlight];
                if (pick && slashCtx) applySlashItem(pick, slashCtx);
                return;
              }
              if (slashMenuActive && e.key === "Escape") {
                e.preventDefault();
                setInput((prev) => {
                  const pos =
                    textareaRef.current?.selectionStart ?? cursorPos;
                  const ctx = getSlashLineContext(prev, pos);
                  if (!ctx) return prev;
                  return (
                    prev.slice(0, ctx.lineStart) + prev.slice(ctx.lineEnd)
                  );
                });
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="default"
          className={cn(
            "mb-0.5 size-10 shrink-0 rounded-full bg-[#2d2a20] text-white shadow-sm",
            "hover:bg-[#1a1814]",
            "disabled:bg-[#d4d0c6] disabled:text-[#9a9485] disabled:opacity-100 disabled:shadow-none",
            "[&_svg]:text-white [&_svg]:opacity-100",
          )}
          onClick={() => void onSend()}
          disabled={sendDisabled}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2Icon className="size-4 shrink-0 animate-spin text-white" />
          ) : (
            <SendIcon
              className="size-4 shrink-0 text-white"
              strokeWidth={2}
            />
          )}
        </Button>
      </div>
    </div>
  );
}
