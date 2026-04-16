"use client";

import {
  BookOpen,
  Download,
  Globe,
  Key,
  KeyRound,
  MessageSquarePlus,
  Plus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StoredConversation } from "@/lib/conversation-storage";
import { cn } from "@/lib/utils";

type Props = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  hydrated: boolean;
  sending: boolean;
  newChat: () => void;
  conversationsSorted: StoredConversation[];
  activeConversationId: string;
  selectConversation: (id: string) => void;
  models: string[];
  model: string;
  setModel: (m: string) => void;
  loadingModels: boolean;
  webSearch: boolean;
  setWebSearch: (v: boolean) => void;
  setTavilyDialogOpen: (v: boolean) => void;
  activeConversation: StoredConversation | undefined;
  updateActiveConversation: (patch: Partial<StoredConversation>) => void;
  chromaCollections: string[];
  chromaListError: string | null;
  setModelPullOpen: (v: boolean) => void;
  setRagIngestOpen: (v: boolean) => void;
  refreshChromaCollections: () => void;
  chromaHasCredentials: boolean;
  onOpenChromaKey: () => void;
};

export function ChatSidebar({
  sidebarOpen,
  setSidebarOpen,
  hydrated,
  sending,
  newChat,
  conversationsSorted,
  activeConversationId,
  selectConversation,
  models,
  model,
  setModel,
  loadingModels,
  webSearch,
  setWebSearch,
  setTavilyDialogOpen,
  activeConversation,
  updateActiveConversation,
  chromaCollections,
  chromaListError,
  setModelPullOpen,
  setRagIngestOpen,
  refreshChromaCollections,
  chromaHasCredentials,
  onOpenChromaKey,
}: Props) {
  const ragValue = activeConversation?.chromaCollectionName?.trim()
    ? activeConversation.chromaCollectionName!
    : "__none__";

  return (
    <>
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 animate-in fade-in-0 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,100%)] flex-col border-[var(--chat-border)] bg-[var(--chat-sidebar)] transition-transform duration-200 ease-out md:static md:z-0 md:w-[260px] md:shrink-0 md:translate-x-0 md:border-r",
          sidebarOpen
            ? "translate-x-0 shadow-xl"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--chat-border)] px-3 md:h-[3.25rem] md:px-3.5">
          <span className="truncate text-[17px] font-semibold tracking-tight text-[#2d2a20]">
            Miii
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-[#5c5748] hover:bg-black/[0.06] md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="shrink-0 px-3 pt-3 md:px-3.5">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-center gap-2 rounded-xl border-[var(--chat-border)] bg-[var(--chat-composer)] text-[13px] font-medium text-[#2d2a20] shadow-sm hover:bg-white"
            onClick={newChat}
            disabled={!hydrated || sending}
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 [-webkit-overflow-scrolling:touch]">
          {!hydrated ? (
            <p className="px-2 py-8 text-center text-[13px] text-[#8a8475]">
              Loading…
            </p>
          ) : conversationsSorted.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] leading-relaxed text-[#8a8475]">
              No chats yet. Start one to see it here.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5" role="list">
              {conversationsSorted.map((c) => {
                const active = c.id === activeConversationId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                        active
                          ? "bg-[#dcd8cc] text-[#1f1c17]"
                          : "text-[#3d3929] hover:bg-[var(--chat-sidebar-hover)]",
                        sending && "pointer-events-none opacity-60",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {c.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-[var(--chat-border)] p-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-[#6b6558]">
              System prompt
            </Label>
            <Textarea
              placeholder="Default Miii persona…"
              value={activeConversation?.systemPrompt ?? ""}
              onChange={(e) =>
                updateActiveConversation({ systemPrompt: e.target.value })
              }
              disabled={!hydrated || sending}
              rows={3}
              className="resize-y rounded-lg border-[var(--chat-border)] bg-[var(--chat-composer)] text-[12px] leading-snug text-[#2d2a20] placeholder:text-[#9a9485]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-[#6b6558]">
                Chroma RAG
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={chromaHasCredentials ? "outline" : "default"}
                  size="sm"
                  className={
                    chromaHasCredentials
                      ? "h-7 gap-1 px-2 text-[11px]"
                      : "h-7 gap-1 bg-[#3d3929] px-2 text-[11px] text-white hover:bg-[#2a2720]"
                  }
                  disabled={!hydrated || sending}
                  onClick={onOpenChromaKey}
                  title="API token for Chroma Cloud (optional for local npm run chroma)"
                >
                  <Key className="size-3" />
                  {chromaHasCredentials ? "Token" : "Unlock"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-1.5 text-[11px] text-[#5c5748]"
                  onClick={() => void refreshChromaCollections()}
                >
                  Refresh
                </Button>
              </div>
            </div>
            <p className="text-[10px] leading-snug text-[#8a8475]">
              {chromaHasCredentials
                ? "Token saved in this browser. Local Chroma often needs no token."
                : "Add a token to use Chroma Cloud, or run Chroma locally without one."}
            </p>
            <Select
              value={ragValue}
              onValueChange={(v) => {
                const name =
                  v && v !== "__none__" ? v : undefined;
                updateActiveConversation({
                  chromaCollectionName: name,
                });
              }}
              disabled={!hydrated || sending}
            >
              <SelectTrigger
                size="sm"
                className="h-9 w-full rounded-lg border-[var(--chat-border)] bg-[var(--chat-composer)] text-[12px] text-[#2d2a20]"
              >
                <SelectValue placeholder="No document context" />
              </SelectTrigger>
              <SelectContent className="border border-[var(--chat-border)] bg-[var(--chat-composer)]">
                <SelectItem value="__none__">No document context</SelectItem>
                {chromaCollections.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chromaListError ? (
              <p className="text-[11px] leading-snug text-amber-800">
                {chromaListError}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 text-[12px]"
              disabled={!hydrated || sending}
              onClick={() => setRagIngestOpen(true)}
            >
              <Plus className="size-3.5" />
              Index into Chroma
            </Button>
          </div>

          <Select
            value={model}
            onValueChange={(v) => {
              if (v) setModel(v);
            }}
            disabled={loadingModels || models.length === 0}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-full rounded-lg border-[var(--chat-border)] bg-[var(--chat-composer)] text-[12px] font-medium text-[#2d2a20] shadow-none [&_svg]:text-[#5c5748]"
            >
              <SelectValue
                placeholder={loadingModels ? "Loading models…" : "Model"}
              />
            </SelectTrigger>
            <SelectContent className="border border-[var(--chat-border)] bg-[var(--chat-composer)] text-[#2d2a20]">
              {models.map((m) => (
                <SelectItem
                  key={m}
                  value={m}
                  className="text-[13px] focus:bg-[var(--chat-sidebar-hover)] data-highlighted:bg-[var(--chat-sidebar-hover)]"
                >
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full gap-2 rounded-lg border-[var(--chat-border)] bg-[var(--chat-composer)] text-[12px] font-medium text-[#2d2a20] hover:bg-white"
            disabled={!hydrated || sending}
            onClick={() => setModelPullOpen(true)}
          >
            <Download className="size-3.5 shrink-0" />
            Pull model from Ollama
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={webSearch ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 min-w-0 flex-1 gap-1.5 rounded-lg text-[12px] font-medium",
                webSearch
                  ? "bg-[#2d6a4f] text-white hover:bg-[#245a42]"
                  : "border-[var(--chat-border)] bg-[var(--chat-composer)] text-[#2d2a20] hover:bg-white",
              )}
              disabled={!hydrated || sending}
              aria-pressed={webSearch}
              aria-label={
                webSearch
                  ? "Turn off Tavily web search"
                  : "Turn on Tavily web search"
              }
              title={
                webSearch
                  ? "Web search on — click to disable"
                  : "Web search off — click to configure Tavily"
              }
              onClick={() => {
                if (webSearch) {
                  setWebSearch(false);
                  return;
                }
                setTavilyDialogOpen(true);
              }}
            >
              <Globe className="size-3.5 shrink-0" />
              <span className="truncate">Web</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-lg border-[var(--chat-border)] bg-[var(--chat-composer)] px-2.5 text-[#2d2a20] hover:bg-white"
              disabled={!hydrated || sending}
              aria-label="Tavily API key"
              title="Set or change Tavily API key"
              onClick={() => setTavilyDialogOpen(true)}
            >
              <KeyRound className="size-3.5" />
            </Button>
          </div>

          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#8a8475]">
            <BookOpen className="mt-0.5 size-3 shrink-0" />
            <span>
              ⌘N new chat · ⌘K model · ⌘/ focus · ⌘⇧P pull model
            </span>
          </p>
        </div>
      </aside>
    </>
  );
}
