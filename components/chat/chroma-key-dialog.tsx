"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeClientChromaUrl } from "@/lib/chroma-url";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialChromaUrl: string;
  initialApiKey: string;
  initialTenant: string;
  initialDatabase: string;
  onSave: (opts: {
    chromaUrl: string;
    apiKey: string;
    tenant: string;
    database: string;
  }) => void;
};

export function ChromaKeyDialog({
  open,
  onOpenChange,
  initialChromaUrl,
  initialApiKey,
  initialTenant,
  initialDatabase,
  onSave,
}: Props) {
  const [chromaUrl, setChromaUrl] = React.useState(initialChromaUrl);
  const [apiKey, setApiKey] = React.useState(initialApiKey);
  const [tenant, setTenant] = React.useState(initialTenant);
  const [database, setDatabase] = React.useState(initialDatabase);
  const [saving, setSaving] = React.useState(false);
  const [urlError, setUrlError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setChromaUrl(initialChromaUrl);
      setApiKey(initialApiKey);
      setTenant(initialTenant);
      setDatabase(initialDatabase);
      setUrlError(null);
    }
  }, [open, initialChromaUrl, initialApiKey, initialTenant, initialDatabase]);

  function save() {
    const urlT = chromaUrl.trim();
    if (urlT && !normalizeClientChromaUrl(urlT)) {
      setUrlError(
        "Use a loopback URL only, e.g. http://127.0.0.1:8000 or http://localhost:8000",
      );
      return;
    }
    setUrlError(null);
    setSaving(true);
    try {
      onSave({
        chromaUrl: urlT,
        apiKey: apiKey.trim(),
        tenant: tenant.trim(),
        database: database.trim(),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[var(--chat-border)] bg-[var(--chat-composer)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#2d2a20]">Chroma connection</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-[#6b6558]">
            For local Chroma, run{" "}
            <code className="rounded bg-white px-1 font-mono text-[12px]">
              npm run chroma
            </code>{" "}
            in this project (or{" "}
            <code className="rounded bg-white px-1 font-mono text-[12px]">
              npx chroma run
            </code>
            ). That usually needs no token. For{" "}
            <a
              href="https://www.trychroma.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#2d2a20] underline"
            >
              Chroma Cloud
            </a>
            , paste your API token and tenant/database if your project uses them.
            The server can also set{" "}
            <code className="rounded bg-white px-1 font-mono text-[11px]">
              CHROMA_API_KEY
            </code>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="chroma-url" className="text-[#3d3929]">
              Chroma URL (local)
            </Label>
            <Input
              id="chroma-url"
              type="url"
              autoComplete="off"
              placeholder="http://127.0.0.1:8000"
              value={chromaUrl}
              onChange={(e) => {
                setChromaUrl(e.target.value);
                setUrlError(null);
              }}
              className="border-[var(--chat-border)] bg-white font-mono text-sm"
            />
            <p className="text-[12px] text-[#8a8475]">
              Leave empty to use the server default (
              <code className="rounded bg-white px-1 font-mono text-[11px]">
                CHROMA_URL
              </code>
              ). The dev server talks to Chroma from Node — run{" "}
              <code className="rounded bg-white px-1 font-mono text-[11px]">
                npm run chroma
              </code>{" "}
              in another terminal.
            </p>
            {urlError ? (
              <p className="text-[12px] text-red-700">{urlError}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="chroma-token" className="text-[#3d3929]">
              API token (optional locally)
            </Label>
            <Input
              id="chroma-token"
              type="password"
              autoComplete="off"
              placeholder="Chroma Cloud token"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="border-[var(--chat-border)] bg-white font-mono text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="chroma-tenant" className="text-[#3d3929]">
              Tenant (Cloud)
            </Label>
            <Input
              id="chroma-tenant"
              autoComplete="off"
              placeholder="Optional"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              className="border-[var(--chat-border)] bg-white font-mono text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="chroma-db" className="text-[#3d3929]">
              Database (Cloud)
            </Label>
            <Input
              id="chroma-db"
              autoComplete="off"
              placeholder="Optional"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              className="border-[var(--chat-border)] bg-white font-mono text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#2d2a20] text-white"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
