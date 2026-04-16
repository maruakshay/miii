"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: string[];
  currentModel: string;
  onSelect: (model: string) => void;
};

export function ModelPickerDialog({
  open,
  onOpenChange,
  models,
  currentModel,
  onSelect,
}: Props) {
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return models;
    return models.filter((m) => m.toLowerCase().includes(s));
  }, [models, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--chat-border)] bg-[var(--chat-composer)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#2d2a20]">Switch model</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Filter models…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-[var(--chat-border)] bg-white"
          autoFocus
        />
        <ul
          className="max-h-64 overflow-y-auto rounded-lg border border-[var(--chat-border)] bg-white py-1"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#8a8475]">No matches</li>
          ) : (
            filtered.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m === currentModel}
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm text-[#2d2a20] hover:bg-[var(--chat-sidebar-hover)]",
                    m === currentModel && "bg-[#dcd8cc] font-medium",
                  )}
                  onClick={() => {
                    onSelect(m);
                    onOpenChange(false);
                  }}
                >
                  {m}
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="text-[11px] text-[#8a8475]">
          Shortcut: ⌘K / Ctrl+K · Pull a new model from the sidebar if it is
          not listed.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
