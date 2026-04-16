"use client";

import * as React from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIngested?: () => void;
  /** Headers forwarded to `/api/rag/ingest` (Chroma token / tenant / database). */
  chromaHeaders: Record<string, string>;
};

export function RagIngestDialog({
  open,
  onOpenChange,
  onIngested,
  chromaHeaders,
}: Props) {
  const [collectionName, setCollectionName] = React.useState("");
  const [text, setText] = React.useState("");
  const [source, setSource] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setMessage(null);
      setError(null);
      setBusy(false);
      setFiles([]);
    }
  }, [open]);

  async function submit() {
    const name = collectionName.trim();
    const bodyText = text.trim();
    const hasFiles = files.length > 0;
    if (!name || (!bodyText && !hasFiles) || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (hasFiles) {
        const form = new FormData();
        form.set("collectionName", name);
        if (source.trim()) form.set("source", source.trim());
        if (bodyText) form.set("text", bodyText);
        for (const f of files) {
          form.append("files", f);
        }
        const res = await fetch("/api/rag/ingest", {
          method: "POST",
          headers: chromaHeaders,
          body: form,
        });
        const data = (await res.json()) as { error?: string; chunks?: number };
        if (!res.ok) {
          throw new Error(data.error ?? "Ingest failed");
        }
        setMessage(`Indexed ${data.chunks ?? 0} chunk(s) into “${name}”.`);
        setText("");
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onIngested?.();
        return;
      }

      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...chromaHeaders,
        },
        body: JSON.stringify({
          collectionName: name,
          text: bodyText,
          source: source.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; chunks?: number };
      if (!res.ok) {
        throw new Error(data.error ?? "Ingest failed");
      }
      setMessage(`Indexed ${data.chunks ?? 0} chunk(s) into “${name}”.`);
      setText("");
      onIngested?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    collectionName.trim() &&
    (text.trim() || files.length > 0) &&
    !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[var(--chat-border)] bg-[var(--chat-composer)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#2d2a20]">
            Add documents (Chroma)
          </DialogTitle>
        </DialogHeader>
        <p className="text-[13px] leading-relaxed text-[#6b6558]">
          Use the sidebar <strong>Unlock</strong> button if Chroma Cloud needs
          a token. Embeddings use Ollama (
          <code className="rounded bg-white px-1 font-mono text-[12px]">
            OLLAMA_EMBED_MODEL
          </code>
          ).
        </p>
        <div className="space-y-2">
          <Label htmlFor="rag-collection">Collection name</Label>
          <Input
            id="rag-collection"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="my-notes"
            className="border-[var(--chat-border)] bg-white"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rag-source">Source label (optional)</Label>
          <Input
            id="rag-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Meeting notes"
            className="border-[var(--chat-border)] bg-white"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rag-files">Files (optional)</Label>
          <input
            ref={fileInputRef}
            id="rag-files"
            type="file"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const list = e.target.files;
              setFiles(list ? Array.from(list) : []);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-3.5" />
              Choose files
            </Button>
            {files.length > 0 ? (
              <span className="text-[12px] text-[#6b6558]">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </span>
            ) : (
              <span className="text-[12px] text-[#8a8475]">
                .txt, .md, code, etc. (read as UTF-8 text)
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rag-text">Text to index (or paste only)</Label>
          <Textarea
            id="rag-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type document text…"
            rows={6}
            className="resize-y border-[var(--chat-border)] bg-white"
            disabled={busy}
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-[#2d6a4f]">{message}</p> : null}
        <Button
          type="button"
          className="w-full bg-[#2d2a20] text-white"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {busy ? "Indexing…" : "Index into Chroma"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
