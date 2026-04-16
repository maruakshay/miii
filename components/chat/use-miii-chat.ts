"use client";

import * as React from "react";

import {
  createDefaultConversationsState,
  loadConversationsState,
  saveConversationsState,
  titleFromMessages,
  type MessageStreamMeta,
  type StoredChatMessage,
  type StoredConversation,
} from "@/lib/conversation-storage";

import {
  CHROMA_DATABASE_STORAGE,
  CHROMA_KEY_STORAGE,
  CHROMA_TENANT_STORAGE,
  CMD_NO_MODEL,
  TAVILY_KEY_STORAGE,
  WEB_SEARCH_STORAGE,
} from "./constants";
import {
  getSlashLineContext,
  SLASH_ITEMS,
  type SlashItem,
  type SlashLineContext,
} from "./slash-helpers";

export function uid() {
  return crypto.randomUUID();
}

export type StreamMeta = MessageStreamMeta;

export function useMiiiChat() {
  const [models, setModels] = React.useState<string[]>([]);
  const [model, setModel] = React.useState<string>("");
  const [conversations, setConversations] = React.useState<StoredConversation[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] =
    React.useState<string>("");
  const [hydrated, setHydrated] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loadingModels, setLoadingModels] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [skillDialogOpen, setSkillDialogOpen] = React.useState(false);
  const [deleteSkillDialogOpen, setDeleteSkillDialogOpen] =
    React.useState(false);
  const [tavilyDialogOpen, setTavilyDialogOpen] = React.useState(false);
  const [tavilyErrorHint, setTavilyErrorHint] = React.useState<string | null>(
    null,
  );
  const [webSearch, setWebSearch] = React.useState(false);
  const [tavilyApiKey, setTavilyApiKey] = React.useState("");
  const [chromaApiKey, setChromaApiKey] = React.useState("");
  const [chromaTenant, setChromaTenant] = React.useState("");
  const [chromaDatabase, setChromaDatabase] = React.useState("");
  const [chromaKeyDialogOpen, setChromaKeyDialogOpen] = React.useState(false);
  const [cursorPos, setCursorPos] = React.useState(0);
  const [slashHighlight, setSlashHighlight] = React.useState(0);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [modelPullOpen, setModelPullOpen] = React.useState(false);
  const [ragIngestOpen, setRagIngestOpen] = React.useState(false);
  const [chromaCollections, setChromaCollections] = React.useState<string[]>(
    [],
  );
  const [chromaListError, setChromaListError] = React.useState<string | null>(
    null,
  );

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const hasAppliedDefaultModel = React.useRef(false);

  const slashCtx = React.useMemo(
    () => getSlashLineContext(input, cursorPos),
    [input, cursorPos],
  );
  const slashMenuActive = slashCtx !== null;

  const slashFiltered = React.useMemo(() => {
    if (!slashCtx) return [];
    const q = slashCtx.query.toLowerCase();
    return SLASH_ITEMS.filter(
      (item) =>
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.insert.toLowerCase().includes(q),
    );
  }, [slashCtx]);

  React.useEffect(() => {
    setSlashHighlight(0);
  }, [slashCtx?.query, slashMenuActive, slashFiltered.length]);

  React.useEffect(() => {
    if (!slashMenuActive) return;
    function onMouseDown(ev: MouseEvent) {
      if (!(ev.target instanceof Node)) return;
      if (composerRef.current?.contains(ev.target)) return;
      setInput((prev) => {
        const ta = textareaRef.current;
        const pos = ta?.selectionStart ?? cursorPos;
        const ctx = getSlashLineContext(prev, pos);
        if (!ctx) return prev;
        return prev.slice(0, ctx.lineStart) + prev.slice(ctx.lineEnd);
      });
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [slashMenuActive, cursorPos]);

  React.useEffect(() => {
    const s = loadConversationsState();
    setConversations(s.conversations);
    setActiveConversationId(s.activeConversationId);
    try {
      setWebSearch(localStorage.getItem(WEB_SEARCH_STORAGE) === "1");
      setTavilyApiKey(localStorage.getItem(TAVILY_KEY_STORAGE) ?? "");
      setChromaApiKey(localStorage.getItem(CHROMA_KEY_STORAGE) ?? "");
      setChromaTenant(localStorage.getItem(CHROMA_TENANT_STORAGE) ?? "");
      setChromaDatabase(localStorage.getItem(CHROMA_DATABASE_STORAGE) ?? "");
    } catch {
      /* private mode */
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WEB_SEARCH_STORAGE, webSearch ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [webSearch, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(TAVILY_KEY_STORAGE, tavilyApiKey);
    } catch {
      /* ignore */
    }
  }, [tavilyApiKey, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CHROMA_KEY_STORAGE, chromaApiKey);
      localStorage.setItem(CHROMA_TENANT_STORAGE, chromaTenant);
      localStorage.setItem(CHROMA_DATABASE_STORAGE, chromaDatabase);
    } catch {
      /* ignore */
    }
  }, [chromaApiKey, chromaTenant, chromaDatabase, hydrated]);

  const chromaRequestHeaders = React.useMemo((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (chromaApiKey.trim()) h["x-chroma-token"] = chromaApiKey.trim();
    if (chromaTenant.trim()) h["x-chroma-tenant"] = chromaTenant.trim();
    if (chromaDatabase.trim()) h["x-chroma-database"] = chromaDatabase.trim();
    return h;
  }, [chromaApiKey, chromaTenant, chromaDatabase]);

  React.useEffect(() => {
    if (!hydrated) return;
    saveConversationsState({
      version: 2,
      conversations,
      activeConversationId,
    });
  }, [conversations, activeConversationId, hydrated]);

  const messages = React.useMemo((): StoredChatMessage[] => {
    const c = conversations.find((x) => x.id === activeConversationId);
    return c?.messages ?? [];
  }, [conversations, activeConversationId]);

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId],
  );

  const conversationsSorted = React.useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  const updateActiveMessages = React.useCallback(
    (updater: React.SetStateAction<StoredChatMessage[]>) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversationId) return c;
          const next =
            typeof updater === "function" ? updater(c.messages) : updater;
          return {
            ...c,
            messages: next,
            updatedAt: Date.now(),
            title: titleFromMessages(next),
          };
        }),
      );
    },
    [activeConversationId],
  );

  const updateActiveConversation = React.useCallback(
    (patch: Partial<StoredConversation>) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId ? { ...c, ...patch, updatedAt: Date.now() } : c,
        ),
      );
    },
    [activeConversationId],
  );

  const refreshModels = React.useCallback(async () => {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/models");
      const data = (await res.json()) as {
        models?: string[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load models");
      }
      const list = data.models ?? [];
      setModels(list);
      if (list.length && !hasAppliedDefaultModel.current) {
        hasAppliedDefaultModel.current = true;
        setModel(list[0]);
      }
    } catch (e) {
      setModelsError(
        e instanceof Error ? e.message : "Failed to load models",
      );
    } finally {
      setLoadingModels(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  const refreshChromaCollections = React.useCallback(async () => {
    setChromaListError(null);
    try {
      const res = await fetch("/api/rag/collections", {
        headers: chromaRequestHeaders,
      });
      const data = (await res.json()) as {
        collections?: string[];
        error?: string;
        connected?: boolean;
        message?: string;
      };
      setChromaCollections(data.collections ?? []);
      if (res.ok && data.connected === false) {
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not list collections");
      }
    } catch (e) {
      setChromaCollections([]);
      setChromaListError(
        e instanceof Error ? e.message : "Chroma list failed",
      );
    }
  }, [chromaRequestHeaders]);

  React.useEffect(() => {
    void refreshChromaCollections();
  }, [refreshChromaCollections]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  React.useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const applySlashItem = React.useCallback(
    (item: SlashItem, ctx: SlashLineContext) => {
      const before = input.slice(0, ctx.lineStart);
      const after = input.slice(ctx.lineEnd);
      const focusAt = (pos: number) => {
        requestAnimationFrame(() => {
          const ta = textareaRef.current;
          ta?.setSelectionRange(pos, pos);
          setCursorPos(pos);
        });
      };
      if (item.action === "addSkill") {
        setInput(before + after);
        setSkillDialogOpen(true);
        focusAt(before.length);
        return;
      }
      if (item.action === "deleteSkill") {
        setInput(before + after);
        setDeleteSkillDialogOpen(true);
        focusAt(before.length);
        return;
      }
      if (item.action === "tavily") {
        setInput(before + after);
        setTavilyDialogOpen(true);
        focusAt(before.length);
        return;
      }
      const next = before + item.insert + after;
      setInput(next);
      focusAt(ctx.lineStart + item.insert.length);
    },
    [input],
  );

  const runChatStream = React.useCallback(
    async (threadForApi: StoredChatMessage[], assistantId: string) => {
      if (!model) return;

      const sys = activeConversation?.systemPrompt?.trim();
      const rag = activeConversation?.chromaCollectionName?.trim();

      const payload: Record<string, unknown> = {
        model,
        webSearch,
        tavilyApiKey,
        messages: threadForApi.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };
      if (sys) payload.systemPrompt = sys;
      if (rag) payload.ragCollection = rag;
      if (chromaApiKey.trim()) payload.chromaApiKey = chromaApiKey.trim();
      if (chromaTenant.trim()) payload.chromaTenant = chromaTenant.trim();
      if (chromaDatabase.trim()) payload.chromaDatabase = chromaDatabase.trim();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = "Request failed";
        try {
          const j = (await res.json()) as {
            error?: string;
            message?: string;
          };
          if (res.status === 400 && j.error === "TAVILY_KEY_REQUIRED") {
            setTavilyErrorHint(j.message ?? null);
            setTavilyDialogOpen(true);
            throw new Error("TAVILY_KEY_REQUIRED");
          }
          errMsg = j.error ?? j.message ?? errMsg;
        } catch (e) {
          if (e instanceof Error && e.message === "TAVILY_KEY_REQUIRED") throw e;
          errMsg = (await res.text()) || errMsg;
        }
        throw new Error(errMsg);
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      updateActiveMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const parsed = JSON.parse(line) as {
            type: string;
            t?: string;
            message?: string;
            promptEvalCount?: number;
            evalCount?: number;
            totalDurationNs?: number;
          };
          if (parsed.type === "token" && parsed.t) {
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + parsed.t }
                  : msg,
              ),
            );
          } else if (parsed.type === "meta") {
            const meta: MessageStreamMeta = {
              promptEvalCount: parsed.promptEvalCount,
              evalCount: parsed.evalCount,
              totalDurationNs: parsed.totalDurationNs,
            };
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId && msg.role === "assistant"
                  ? { ...msg, streamMeta: meta }
                  : msg,
              ),
            );
          } else if (parsed.type === "error" && parsed.message) {
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content:
                        msg.content +
                        (msg.content ? "\n\n" : "") +
                        `Error: ${parsed.message}`,
                    }
                  : msg,
              ),
            );
          }
        }
        if (done) break;
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          const parsed = JSON.parse(tail) as {
            type: string;
            t?: string;
            promptEvalCount?: number;
            evalCount?: number;
            totalDurationNs?: number;
          };
          if (parsed.type === "token" && parsed.t) {
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + parsed.t }
                  : msg,
              ),
            );
          } else if (parsed.type === "meta") {
            const meta: MessageStreamMeta = {
              promptEvalCount: parsed.promptEvalCount,
              evalCount: parsed.evalCount,
              totalDurationNs: parsed.totalDurationNs,
            };
            updateActiveMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId && msg.role === "assistant"
                  ? { ...msg, streamMeta: meta }
                  : msg,
              ),
            );
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    },
    [
      model,
      webSearch,
      tavilyApiKey,
      chromaApiKey,
      chromaTenant,
      chromaDatabase,
      activeConversation?.systemPrompt,
      activeConversation?.chromaCollectionName,
      updateActiveMessages,
    ],
  );

  function newChat() {
    const id = uid();
    const fresh: StoredConversation = {
      id,
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setConversations((prev) => [fresh, ...prev]);
    setActiveConversationId(id);
    setSidebarOpen(false);
  }

  function selectConversation(id: string) {
    setActiveConversationId(id);
    setSidebarOpen(false);
  }

  async function sendThread(
    threadForApi: StoredChatMessage[],
    options?: { restoreUserOnTavily?: string },
  ) {
    if (!model || sending) return;
    setSending(true);
    const assistantId = uid();

    try {
      await runChatStream(threadForApi, assistantId);
    } catch (e) {
      if (e instanceof Error && e.message === "TAVILY_KEY_REQUIRED") {
        updateActiveMessages((prev) => prev.slice(0, -1));
        if (options?.restoreUserOnTavily) {
          setInput(options.restoreUserOnTavily);
        }
        setSending(false);
        return;
      }
      const err = e instanceof Error ? e.message : "Something went wrong";
      updateActiveMessages((prev) => {
        const hasSlot = prev.some((m) => m.id === assistantId);
        if (hasSlot) {
          return prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: msg.content
                    ? `${msg.content}\n\nError: ${err}`
                    : `Error: ${err}`,
                }
              : msg,
          );
        }
        return [
          ...prev,
          { id: uid(), role: "assistant", content: `Error: ${err}` },
        ];
      });
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    if (text === "/clear") {
      updateActiveMessages([]);
      setInput("");
      return;
    }

    if (text === "/clear all") {
      const s = createDefaultConversationsState();
      setConversations(s.conversations);
      setActiveConversationId(s.activeConversationId);
      setInput("");
      return;
    }

    if (text === "/tools") {
      setSkillDialogOpen(true);
      setInput("");
      return;
    }

    if (text === "/delete-tool") {
      setDeleteSkillDialogOpen(true);
      setInput("");
      return;
    }

    if (text === "/web") {
      setTavilyDialogOpen(true);
      setInput("");
      return;
    }

    if (!model) return;

    const userMsg: StoredChatMessage = { id: uid(), role: "user", content: text };
    const nextThread: StoredChatMessage[] = [...messages, userMsg];
    updateActiveMessages(nextThread);
    setInput("");
    await sendThread(nextThread, { restoreUserOnTavily: text });
  }

  async function regenerateLast() {
    if (!model || messages.length < 2 || sending) return;
    const last = messages[messages.length - 1];
    const prev = messages[messages.length - 2];
    if (last.role !== "assistant" || prev.role !== "user") return;
    const thread = messages.slice(0, -1);
    updateActiveMessages(thread);
    await sendThread(thread);
  }

  async function commitUserEdit() {
    if (!model || !editingUserId || sending) return;
    const idx = messages.findIndex((m) => m.id === editingUserId);
    if (idx < 0 || messages[idx].role !== "user") return;
    const newContent = editDraft.trim();
    if (!newContent) {
      setEditingUserId(null);
      return;
    }
    const thread = messages.slice(0, idx).concat([
      { ...messages[idx], content: newContent },
    ]);
    updateActiveMessages(thread);
    setEditingUserId(null);
    setEditDraft("");
    await sendThread(thread);
  }

  const inputTrim = input.trim();
  const isCmdNoModel = CMD_NO_MODEL.has(inputTrim);
  const sendDisabled =
    sending || !inputTrim || (!model && !isCmdNoModel);

  return {
    models,
    model,
    setModel,
    conversations,
    activeConversationId,
    hydrated,
    input,
    setInput,
    loadingModels,
    sending,
    modelsError,
    skillDialogOpen,
    setSkillDialogOpen,
    deleteSkillDialogOpen,
    setDeleteSkillDialogOpen,
    tavilyDialogOpen,
    setTavilyDialogOpen,
    tavilyErrorHint,
    setTavilyErrorHint,
    webSearch,
    setWebSearch,
    tavilyApiKey,
    setTavilyApiKey,
    chromaApiKey,
    setChromaApiKey,
    chromaTenant,
    setChromaTenant,
    chromaDatabase,
    setChromaDatabase,
    chromaKeyDialogOpen,
    setChromaKeyDialogOpen,
    chromaRequestHeaders,
    cursorPos,
    setCursorPos,
    slashHighlight,
    setSlashHighlight,
    sidebarOpen,
    setSidebarOpen,
    bottomRef,
    textareaRef,
    composerRef,
    slashCtx,
    slashMenuActive,
    slashFiltered,
    messages,
    activeConversation,
    conversationsSorted,
    updateActiveConversation,
    applySlashItem,
    newChat,
    selectConversation,
    send,
    sendDisabled,
    editingUserId,
    setEditingUserId,
    editDraft,
    setEditDraft,
    commitUserEdit,
    regenerateLast,
    modelPickerOpen,
    setModelPickerOpen,
    modelPullOpen,
    setModelPullOpen,
    ragIngestOpen,
    setRagIngestOpen,
    chromaCollections,
    chromaListError,
    refreshChromaCollections,
    refreshModels,
  };
}
