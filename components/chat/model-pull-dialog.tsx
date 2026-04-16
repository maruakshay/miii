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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPulled?: () => void;
};

export function ModelPullDialog({ open, onOpenChange, onPulled }: Props) {
  const [name, setName] = React.useState("");
  const [log, setLog] = React.useState("");
  const [pulling, setPulling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setLog("");
      setError(null);
      setPulling(false);
    }
  }, [open]);

  async function startPull() {
    const model = name.trim();
    if (!model || pulling) return;
    setPulling(true);
    setError(null);
    setLog("");

    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Pull failed (${res.status})`);
      }
      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line) as {
              status?: string;
              digest?: string;
              completed?: number;
              total?: number;
            };
            let piece = obj.status;
            if (!piece && obj.digest) piece = `digest ${obj.digest}`;
            if (!piece) piece = line;
            setLog((prev) =>
              prev + (prev ? "\n" : "") + (piece || JSON.stringify(obj)),
            );
          } catch {
            setLog((prev) => prev + (prev ? "\n" : "") + line);
          }
        }
        if (done) break;
      }
      const tail = buf.trim();
      if (tail) setLog((prev) => prev + (prev ? "\n" : "") + tail);
      onPulled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull failed");
    } finally {
      setPulling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--chat-border)] bg-[var(--chat-composer)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#2d2a20]">Pull model (Ollama)</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pull-model" className="text-[#3d3929]">
            Model name
          </Label>
          <div className="flex gap-2">
            <Input
              id="pull-model"
              placeholder="e.g. llama3.2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-[var(--chat-border)] bg-white"
              disabled={pulling}
              onKeyDown={(e) => {
                if (e.key === "Enter") void startPull();
              }}
            />
            <Button
              type="button"
              className="shrink-0 bg-[#2d2a20] text-white"
              disabled={pulling || !name.trim()}
              onClick={() => void startPull()}
            >
              {pulling ? "Pulling…" : "Pull"}
            </Button>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : null}
        <ScrollArea className="h-48 rounded-lg border border-[var(--chat-border)] bg-white p-2">
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-[#3d3929]">
            {log || (pulling ? "Starting…" : "Log output appears here.")}
          </pre>
        </ScrollArea>
        <p className="text-[11px] text-[#8a8475]">
          Shortcut: ⌘⇧P / Ctrl+Shift+P · Requires a running Ollama daemon.
        </p>
      </DialogContent>
    </Dialog>
  );
}
