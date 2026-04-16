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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialApiKey: string;
  initialTenant: string;
  initialDatabase: string;
  onSave: (opts: {
    apiKey: string;
    tenant: string;
    database: string;
  }) => void;
};

export function ChromaKeyDialog({
  open,
  onOpenChange,
  initialApiKey,
  initialTenant,
  initialDatabase,
  onSave,
}: Props) {
  const [apiKey, setApiKey] = React.useState(initialApiKey);
  const [tenant, setTenant] = React.useState(initialTenant);
  const [database, setDatabase] = React.useState(initialDatabase);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setApiKey(initialApiKey);
      setTenant(initialTenant);
      setDatabase(initialDatabase);
    }
  }, [open, initialApiKey, initialTenant, initialDatabase]);

  function save() {
    setSaving(true);
    try {
      onSave({
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
            Local Chroma (
            <code className="rounded bg-white px-1 font-mono text-[12px]">chroma run</code>
            ) usually needs no token. For{" "}
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
