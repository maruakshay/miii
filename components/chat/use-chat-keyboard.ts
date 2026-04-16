"use client";

import * as React from "react";

type Options = {
  onNewChat: () => void;
  onOpenModelPicker: () => void;
  onFocusComposer: () => void;
  onOpenPull: () => void;
  /** Ref to the main chat composer textarea */
  composerTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

export function useChatKeyboard({
  onNewChat,
  onOpenModelPicker,
  onFocusComposer,
  onOpenPull,
  composerTextareaRef,
}: Options) {
  React.useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const mod = ev.metaKey || ev.ctrlKey;
      if (!mod) return;

      const key = ev.key.toLowerCase();

      if (key === "n") {
        ev.preventDefault();
        onNewChat();
        return;
      }

      if (key === "k") {
        ev.preventDefault();
        onOpenModelPicker();
        return;
      }

      if (key === "/" && !ev.shiftKey) {
        const t = ev.target;
        if (
          t instanceof HTMLTextAreaElement &&
          t.dataset.miiiComposer === "true"
        ) {
          return;
        }
        ev.preventDefault();
        composerTextareaRef.current?.focus();
        onFocusComposer();
        return;
      }

      if (ev.shiftKey && key === "p") {
        ev.preventDefault();
        onOpenPull();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    onNewChat,
    onOpenModelPicker,
    onFocusComposer,
    onOpenPull,
    composerTextareaRef,
  ]);
}
