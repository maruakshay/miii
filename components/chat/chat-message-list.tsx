"use client";

import type { RefObject } from "react";
import { Loader2Icon, Pencil, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/chat/markdown-content";
import type {
  MessageStreamMeta,
  StoredChatMessage,
} from "@/lib/conversation-storage";
import { cn } from "@/lib/utils";

import { COMPOSER_GAP } from "./constants";

function formatDuration(ns?: number): string {
  if (typeof ns !== "number" || !Number.isFinite(ns)) return "";
  const ms = ns / 1_000_000;
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function approxTokensPerSecond(
  evalCount?: number,
  totalDurationNs?: number,
): string {
  if (
    typeof evalCount !== "number" ||
    typeof totalDurationNs !== "number" ||
    evalCount <= 0 ||
    totalDurationNs <= 0
  ) {
    return "";
  }
  const sec = totalDurationNs / 1e9;
  if (sec <= 0) return "";
  return `${(evalCount / sec).toFixed(1)} tok/s`;
}

function AssistantStreamMetaLine({ meta }: { meta: MessageStreamMeta }) {
  const bits: string[] = [];
  if (meta.promptEvalCount != null) {
    bits.push(`prompt ${meta.promptEvalCount} tok`);
  }
  if (meta.evalCount != null) {
    bits.push(`completion ${meta.evalCount} tok`);
  }
  if (meta.totalDurationNs != null) {
    bits.push(`time ${formatDuration(meta.totalDurationNs)}`);
  }
  const tps = approxTokensPerSecond(meta.evalCount, meta.totalDurationNs);
  if (tps) bits.push(`≈ ${tps}`);
  if (!bits.length) return null;
  return (
    <p className="mt-2 border-t border-[var(--chat-border)]/60 pt-2 text-[11px] tabular-nums leading-relaxed text-[#8a8475]">
      {bits.join(" · ")}
    </p>
  );
}

type Props = {
  hydrated: boolean;
  messages: StoredChatMessage[];
  sending: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  editingUserId: string | null;
  editDraft: string;
  setEditDraft: (v: string) => void;
  onStartEdit: (msg: StoredChatMessage) => void;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onRegenerate: () => void;
};

export function ChatMessageList({
  hydrated,
  messages,
  sending,
  bottomRef,
  editingUserId,
  editDraft,
  setEditDraft,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onRegenerate,
}: Props) {
  const last = messages[messages.length - 1];
  const showThinking =
    hydrated && sending && last?.role === "user";

  function showRegenerateBelowUser(idx: number, userId: string): boolean {
    if (sending || editingUserId === userId) return false;
    const next = messages[idx + 1];
    return next?.role === "assistant" && idx + 1 === messages.length - 1;
  }

  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pt-4 sm:px-6 sm:pt-8 [-webkit-overflow-scrolling:touch]",
        COMPOSER_GAP,
      )}
    >
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-7">
        {!hydrated ? (
          <p className="select-none py-20 text-center text-[15px] text-[#8a8475]">
            Loading…
          </p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-[min(12vh,5rem)] text-center">
            <p className="max-w-md text-[22px] font-medium leading-snug tracking-tight text-[#2d2a20] sm:text-[26px]">
              How can I help you today?
            </p>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[#8a8475]">
              Type a message below. Use{" "}
              <kbd className="rounded-md border border-[var(--chat-border)] bg-[var(--chat-composer)] px-1.5 py-0.5 font-mono text-[12px] text-[#5c5748]">
                /
              </kbd>{" "}
              for commands.{" "}
              <kbd className="rounded-md border border-[var(--chat-border)] bg-[var(--chat-composer)] px-1.5 py-0.5 font-mono text-[11px] text-[#5c5748]">
                ⌘K
              </kbd>{" "}
              switches models;{" "}
              <kbd className="rounded-md border border-[var(--chat-border)] bg-[var(--chat-composer)] px-1.5 py-0.5 font-mono text-[11px] text-[#5c5748]">
                ⌘/
              </kbd>{" "}
              focuses the composer.
            </p>
          </div>
        ) : (
          messages.map((m, idx) =>
            m.role === "user" ? (
              <div key={m.id} className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a8475]">
                    You
                  </span>
                  {editingUserId !== m.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px] text-[#6b6558]"
                      disabled={sending}
                      onClick={() => onStartEdit(m)}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                  ) : null}
                </div>
                {editingUserId === m.id ? (
                  <div className="flex w-full max-w-[min(100%,32rem)] flex-col gap-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={4}
                      className="resize-y rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-composer)] text-[15px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCancelEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#2d2a20] text-white"
                        disabled={sending || !editDraft.trim()}
                        onClick={() => void onCommitEdit()}
                      >
                        Save &amp; resend
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[min(100%,32rem)] rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-composer)] px-4 py-3 text-[15px] leading-relaxed text-[#2d2a20] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                    <MarkdownContent className="text-[#2d2a20]">
                      {m.content}
                    </MarkdownContent>
                  </div>
                )}
                {showRegenerateBelowUser(idx, m.id) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-[11px] text-[#6b6558]"
                    onClick={() => void onRegenerate()}
                  >
                    <RefreshCw className="size-3" />
                    Regenerate
                  </Button>
                ) : null}
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8475]">
                    Miii
                  </span>
                </div>
                <div>
                  <MarkdownContent className="text-[15px] leading-[1.65] text-[#3d3929]">
                    {m.content}
                  </MarkdownContent>
                  {m.streamMeta ? (
                    <AssistantStreamMetaLine meta={m.streamMeta} />
                  ) : null}
                </div>
              </div>
            ),
          )
        )}
        {showThinking ? (
          <div className="flex items-center gap-2.5 text-[13px] text-[#8a8475]">
            <Loader2Icon className="size-4 animate-spin" />
            <span className="font-medium">Thinking…</span>
          </div>
        ) : null}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>
    </div>
  );
}
