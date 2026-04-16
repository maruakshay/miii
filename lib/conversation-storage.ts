export const CONVERSATIONS_STORAGE_KEY = "miii.conversations.v2";

const LEGACY_STORAGE_KEY = "miii.conversations.v1";

export type ChatRole = "user" | "assistant";

/** Usage stats from Ollama when available (assistant messages). */
export type MessageStreamMeta = {
  promptEvalCount?: number;
  evalCount?: number;
  totalDurationNs?: number;
};

export type StoredChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  streamMeta?: MessageStreamMeta;
};

export type StoredConversation = {
  id: string;
  title: string;
  messages: StoredChatMessage[];
  updatedAt: number;
  /** When non-empty, replaces the default Miii system prompt for this chat only. */
  systemPrompt?: string;
  /** Chroma collection name for RAG context (optional). */
  chromaCollectionName?: string;
};

export type ConversationsState = {
  version: 2;
  conversations: StoredConversation[];
  activeConversationId: string;
};

function newConversation(): StoredConversation {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    updatedAt: Date.now(),
  };
}

export function createDefaultConversationsState(): ConversationsState {
  const c = newConversation();
  return {
    version: 2,
    conversations: [c],
    activeConversationId: c.id,
  };
}

export function titleFromMessages(messages: StoredChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const line = firstUser.content.trim().split("\n")[0] ?? "";
  if (!line) return "New chat";
  return line.length > 48 ? `${line.slice(0, 45)}…` : line;
}

function parseStreamMeta(
  raw: unknown,
): MessageStreamMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const meta: MessageStreamMeta = {};
  if (typeof o.promptEvalCount === "number")
    meta.promptEvalCount = o.promptEvalCount;
  if (typeof o.evalCount === "number") meta.evalCount = o.evalCount;
  if (typeof o.totalDurationNs === "number")
    meta.totalDurationNs = o.totalDurationNs;
  return Object.keys(meta).length ? meta : undefined;
}

function parseChatMessage(x: unknown): StoredChatMessage | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.content !== "string" ||
    (o.role !== "user" && o.role !== "assistant")
  ) {
    return null;
  }
  const streamMeta = parseStreamMeta(o.streamMeta);
  const msg: StoredChatMessage = {
    id: o.id,
    role: o.role,
    content: o.content,
  };
  if (streamMeta) msg.streamMeta = streamMeta;
  return msg;
}

function normalizeConversation(x: unknown): StoredConversation | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  const rawMsgs = o.messages;
  if (!Array.isArray(rawMsgs)) return null;
  const messages: StoredChatMessage[] = [];
  for (const m of rawMsgs) {
    const parsed = parseChatMessage(m);
    if (parsed) messages.push(parsed);
  }
  const title =
    typeof o.title === "string" && o.title.length > 0 ? o.title : "New chat";
  const updatedAt =
    typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
      ? o.updatedAt
      : Date.now();
  const systemPrompt =
    typeof o.systemPrompt === "string" ? o.systemPrompt : undefined;
  const chromaCollectionName =
    typeof o.chromaCollectionName === "string"
      ? o.chromaCollectionName
      : undefined;
  return {
    id: o.id,
    title,
    messages,
    updatedAt,
    systemPrompt,
    chromaCollectionName,
  };
}

function migrateFromV1(parsed: unknown): ConversationsState | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.version !== 1) return null;
  const rawList = o.conversations;
  if (!Array.isArray(rawList) || rawList.length === 0) return null;
  const conversations: StoredConversation[] = [];
  for (const item of rawList) {
    const c = normalizeConversation(item);
    if (c) conversations.push(c);
  }
  if (conversations.length === 0) return null;
  let activeConversationId =
    typeof o.activeConversationId === "string"
      ? o.activeConversationId
      : conversations[0].id;
  if (!conversations.some((c) => c.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
  }
  return {
    version: 2,
    conversations,
    activeConversationId,
  };
}

export function normalizeConversationsState(parsed: unknown): ConversationsState {
  if (!parsed || typeof parsed !== "object") {
    return createDefaultConversationsState();
  }
  const o = parsed as Record<string, unknown>;
  if (o.version === 1) {
    const migrated = migrateFromV1(parsed);
    if (migrated) return migrated;
  }
  const rawList = o.conversations;
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return createDefaultConversationsState();
  }
  const conversations: StoredConversation[] = [];
  for (const item of rawList) {
    const c = normalizeConversation(item);
    if (c) conversations.push(c);
  }
  if (conversations.length === 0) {
    return createDefaultConversationsState();
  }
  let activeConversationId =
    typeof o.activeConversationId === "string"
      ? o.activeConversationId
      : conversations[0].id;
  if (!conversations.some((c) => c.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
  }
  return {
    version: 2,
    conversations,
    activeConversationId,
  };
}

export function loadConversationsState(): ConversationsState {
  if (typeof window === "undefined") {
    return createDefaultConversationsState();
  }
  try {
    let raw = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsedLegacy: unknown = JSON.parse(raw);
        const state = normalizeConversationsState(parsedLegacy);
        saveConversationsState(state);
        try {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return state;
      }
    }
    if (!raw) return createDefaultConversationsState();
    const parsed: unknown = JSON.parse(raw);
    return normalizeConversationsState(parsed);
  } catch {
    return createDefaultConversationsState();
  }
}

export function saveConversationsState(state: ConversationsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    /* quota or private mode */
  }
}
