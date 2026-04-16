/**
 * OpenClaw-inspired terminal UI: connects to the local Miii Next.js app (default http://127.0.0.1:3000).
 *
 * Usage:
 *   npm run dev   # in another terminal
 *   npm run tui
 *
 *   MIIIBOT_URL=http://127.0.0.1:3000 npm run tui
 *   npm run tui -- --url http://127.0.0.1:3000
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Spacer, Text, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import { render } from "ink";

type ChatRow = { role: "user" | "assistant" | "system"; text: string };

type NdLine =
  | { type: "token"; t: string }
  | {
      type: "meta";
      promptEvalCount?: number;
      evalCount?: number;
      totalDurationNs?: number;
    }
  | { type: "done" }
  | { type: "error"; message: string };

type ChatApiPayload = {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  webSearch: boolean;
  tavilyApiKey: string;
  systemPrompt?: string;
  ragCollection?: string;
  chromaApiKey?: string;
  chromaTenant?: string;
  chromaDatabase?: string;
};

function parseArgs(argv: string[]): { url: string } {
  const envUrl = process.env.MIIIBOT_URL?.trim();
  let url = envUrl || "http://127.0.0.1:3000";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) {
      url = argv[i + 1];
      i++;
    }
  }
  return { url: url.replace(/\/$/, "") };
}

async function fetchModels(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/models`, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json()) as { models?: string[] };
  return data.models ?? [];
}

function buildChatPayload(
  base: Omit<ChatApiPayload, "systemPrompt" | "ragCollection"> & {
    systemPrompt: string;
    ragCollection: string;
    chromaApiKey: string;
    chromaTenant: string;
    chromaDatabase: string;
  },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: base.model,
    messages: base.messages,
    webSearch: base.webSearch,
    tavilyApiKey: base.tavilyApiKey,
  };
  const sys = base.systemPrompt.trim();
  if (sys) payload.systemPrompt = sys;
  const rag = base.ragCollection.trim();
  if (rag) payload.ragCollection = rag;
  if (base.chromaApiKey.trim()) payload.chromaApiKey = base.chromaApiKey.trim();
  if (base.chromaTenant.trim()) payload.chromaTenant = base.chromaTenant.trim();
  if (base.chromaDatabase.trim())
    payload.chromaDatabase = base.chromaDatabase.trim();
  return payload;
}

function chromaHeadersFromState(opts: {
  chromaApiKey: string;
  chromaTenant: string;
  chromaDatabase: string;
}): Record<string, string> {
  const h: Record<string, string> = {};
  if (opts.chromaApiKey.trim()) h["x-chroma-token"] = opts.chromaApiKey.trim();
  if (opts.chromaTenant.trim()) h["x-chroma-tenant"] = opts.chromaTenant.trim();
  if (opts.chromaDatabase.trim())
    h["x-chroma-database"] = opts.chromaDatabase.trim();
  return h;
}

async function fetchRagCollections(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<{ collections: string[]; message?: string; connected?: boolean }> {
  const res = await fetch(`${baseUrl}/api/rag/collections`, {
    headers: { Accept: "application/json", ...headers },
  });
  const data = (await res.json()) as {
    collections?: string[];
    message?: string;
    connected?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return {
    collections: data.collections ?? [],
    message: data.message,
    connected: data.connected,
  };
}

async function streamOllamaPull(
  baseUrl: string,
  model: string,
  onStatus: (line: string) => void,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/ollama/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      msg = j.error ?? msg;
    } catch {
      msg = (await res.text()) || msg;
    }
    throw new Error(msg);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No pull stream body");
  const dec = new TextDecoder();
  let carry = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const parts = carry.split("\n");
    carry = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as {
          status?: string;
          digest?: string;
        };
        let piece = obj.status;
        if (!piece && obj.digest) piece = `digest ${obj.digest}`;
        if (piece) onStatus(piece);
      } catch {
        onStatus(line);
      }
    }
  }
  if (carry.trim()) {
    try {
      const obj = JSON.parse(carry) as { status?: string };
      if (obj.status) onStatus(obj.status);
    } catch {
      onStatus(carry.trim());
    }
  }
}

async function streamChat(
  baseUrl: string,
  payload: Record<string, unknown>,
  onToken: (t: string) => void,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as {
        error?: string;
        message?: string;
      };
      msg = j.message ?? j.error ?? msg;
    } catch {
      try {
        msg = (await res.text()) || msg;
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const dec = new TextDecoder();
  let carry = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const parts = carry.split("\n");
    carry = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.trim()) continue;
      let obj: NdLine;
      try {
        obj = JSON.parse(line) as NdLine;
      } catch {
        continue;
      }
      if (obj.type === "token" && obj.t) onToken(obj.t);
      if (obj.type === "error") throw new Error(obj.message || "Chat error");
    }
  }
  if (carry.trim()) {
    try {
      const obj = JSON.parse(carry) as NdLine;
      if (obj.type === "token" && obj.t) onToken(obj.t);
      if (obj.type === "error") throw new Error(obj.message || "Chat error");
    } catch (e) {
      if (e instanceof SyntaxError) return;
      throw e;
    }
  }
}

/** Word-wrap plain text to a maximum line width (preserves blank lines between paragraphs). */
function wrapPlainText(text: string, maxWidth: number): string[] {
  if (maxWidth < 4) return text.split("\n");
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxWidth) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      if (word.length <= maxWidth) {
        line = word;
        continue;
      }
      let rest = word;
      while (rest.length > maxWidth) {
        out.push(rest.slice(0, maxWidth));
        rest = rest.slice(maxWidth);
      }
      line = rest;
    }
    if (line) out.push(line);
  }
  return out;
}

type VisibleBubble = {
  key: string;
  role: ChatRow["role"];
  lines: string[];
};

function bubbleRowBudget(lineCount: number, role: ChatRow["role"]): number {
  if (role === "system") return Math.max(1, lineCount);
  return lineCount + 4;
}

function buildVisibleBubbles(
  rows: ChatRow[],
  innerWidth: number,
  maxTotalRows: number,
): { bubbles: VisibleBubble[]; truncated: boolean } {
  const bubbles: VisibleBubble[] = [];
  let used = 0;
  let truncated = false;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const wrapped = wrapPlainText(row.text, innerWidth);
    const cost = bubbleRowBudget(wrapped.length, row.role);
    if (used + cost > maxTotalRows && bubbles.length > 0) {
      truncated = true;
      break;
    }
    bubbles.unshift({
      key: `m-${i}-${row.role}`,
      role: row.role,
      lines: wrapped,
    });
    used += cost;
  }

  return { bubbles, truncated };
}

function App({ initialUrl }: { initialUrl: string }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const termCols = stdout?.columns ?? 80;

  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsHint, setModelsHint] = useState<string | null>(null);
  const [rowsState, setRowsState] = useState<ChatRow[]>([
    {
      role: "system",
      text:
        "Miii TUI — /help for commands (parity with web: RAG, system prompt, pull). Ensure `npm run dev` is running.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pullBusy, setPullBusy] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [tavilyApiKey, setTavilyApiKey] = useState(
    () => process.env.TAVILY_API_KEY?.trim() ?? "",
  );
  const [systemPrompt, setSystemPrompt] = useState("");
  const [ragCollection, setRagCollection] = useState("");
  const [chromaApiKey, setChromaApiKey] = useState("");
  const [chromaTenant, setChromaTenant] = useState("");
  const [chromaDatabase, setChromaDatabase] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchModels(baseUrl);
        if (cancelled) return;
        setModels(list);
        if (list.length) setModel((m) => m || list[0]!);
        setModelsHint(
          list.length
            ? null
            : "No models from Ollama — set one with /model <name>",
        );
      } catch (e) {
        if (cancelled) return;
        setModelsHint(
          e instanceof Error ? e.message : "Could not reach /api/models",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const transcriptHeight = Math.max(8, termRows - 10);
  const bubbleOuterWidth = Math.min(76, Math.max(28, termCols - 10));
  const innerWrapWidth = Math.max(16, bubbleOuterWidth - 6);

  const { bubbles, truncated } = useMemo(
    () => buildVisibleBubbles(rowsState, innerWrapWidth, transcriptHeight),
    [rowsState, innerWrapWidth, transcriptHeight],
  );

  const lastRow = rowsState[rowsState.length - 1];
  const streamingAssistant = busy && lastRow?.role === "assistant";

  const pushSystem = useCallback((text: string) => {
    setRowsState((prev) => [...prev, { role: "system", text }]);
  }, []);

  const chromaHdr = useMemo(
    () =>
      chromaHeadersFromState({
        chromaApiKey,
        chromaTenant,
        chromaDatabase,
      }),
    [chromaApiKey, chromaTenant, chromaDatabase],
  );

  const runChat = useCallback(
    async (userText: string) => {
      const m = model.trim();
      if (!m) {
        pushSystem("Set a model first: /model <ollama-model>");
        return;
      }
      setBusy(true);
      const history = rowsState.filter(
        (r) => r.role === "user" || r.role === "assistant",
      );
      const messages = [
        ...history.map((r) => ({
          role: r.role as "user" | "assistant",
          content: r.text,
        })),
        { role: "user" as const, content: userText },
      ];

      setRowsState((prev) => [
        ...prev,
        { role: "user", text: userText },
        { role: "assistant", text: "" },
      ]);

      const payload = buildChatPayload({
        model: m,
        messages,
        webSearch,
        tavilyApiKey: tavilyApiKey,
        systemPrompt,
        ragCollection,
        chromaApiKey,
        chromaTenant,
        chromaDatabase,
      });

      try {
        await streamChat(baseUrl, payload, (t) => {
          setRowsState((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                role: "assistant",
                text: last.text + t,
              };
            }
            return next;
          });
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRowsState((prev) => {
          const next = [...prev];
          if (
            next[next.length - 1]?.role === "assistant" &&
            !next[next.length - 1].text
          ) {
            next.pop();
          }
          return [...next, { role: "system", text: `Error: ${msg}` }];
        });
      } finally {
        setBusy(false);
      }
    },
    [
      baseUrl,
      model,
      rowsState,
      webSearch,
      tavilyApiKey,
      systemPrompt,
      ragCollection,
      chromaApiKey,
      chromaTenant,
      chromaDatabase,
      pushSystem,
    ],
  );

  const regenerateLast = useCallback(async () => {
    const m = model.trim();
    if (!m) {
      pushSystem("Set a model first: /model <ollama-model>");
      return;
    }
    const hist = rowsState.filter(
      (r) => r.role === "user" || r.role === "assistant",
    );
    if (hist.length < 2 || hist[hist.length - 1]?.role !== "assistant") {
      pushSystem("Nothing to regenerate (need a user message then an assistant reply).");
      return;
    }
    const baseRows = rowsState.slice(0, -1);
    const threadForApi = hist.slice(0, -1).map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.text,
    }));

    setBusy(true);
    setRowsState([...baseRows, { role: "assistant", text: "" }]);

    const payload = buildChatPayload({
      model: m,
      messages: threadForApi,
      webSearch,
      tavilyApiKey,
      systemPrompt,
      ragCollection,
      chromaApiKey,
      chromaTenant,
      chromaDatabase,
    });

    try {
      await streamChat(baseUrl, payload, (t) => {
        setRowsState((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { role: "assistant", text: last.text + t };
          }
          return next;
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRowsState((prev) => {
        const next = [...prev];
        if (
          next[next.length - 1]?.role === "assistant" &&
          !next[next.length - 1].text
        ) {
          next.pop();
        }
        return [...next, { role: "system", text: `Error: ${msg}` }];
      });
    } finally {
      setBusy(false);
    }
  }, [
    baseUrl,
    model,
    rowsState,
    webSearch,
    tavilyApiKey,
    systemPrompt,
    ragCollection,
    chromaApiKey,
    chromaTenant,
    chromaDatabase,
    pushSystem,
  ]);

  const handleSubmit = useCallback(
    (value: string) => {
      const text = value.trim();
      setInput("");
      if (!text) return;

      if (text === "/help" || text === "/?") {
        pushSystem(
          [
            "/help /? — this help",
            "/quit /exit — leave",
            "/new — new chat (clears messages; resets system prompt & RAG collection for this session)",
            "/clear — clear messages only (keeps system prompt & RAG selection)",
            "/clear all — same as /new (one local session; matches “delete all chats”)",
            "/regenerate — redo last assistant reply (same user message)",
            "/models — refresh model list from API",
            "/model — show current model",
            "/model <name> — set Ollama model tag",
            `/url <base> — API base (default ${initialUrl})`,
            "/web on|off — toggle Tavily web search",
            "/web — show web search state (use /tavily set <key> if you see TAVILY_KEY_REQUIRED)",
            "/tavily — show whether a key is set (masked)",
            "/tavily set <key> — Tavily API key for this session",
            "/tavily clear — remove stored key (falls back to env at process start only)",
            "/system — show custom system prompt",
            "/system clear — clear custom system prompt",
            "/system <text> — one-line system prompt (use \\n for newline)",
            "/rag — show selected Chroma collection",
            "/rag none — no RAG context",
            "/rag list — list collections (uses /chroma headers if set)",
            "/rag <name> — attach collection for the next sends",
            "/chroma — Chroma Cloud / multi-tenant header help",
            "/chroma key|tenant|database <value> — set header (omit value to clear that field)",
            "/chroma clear — clear key, tenant, and database",
            "/pull <model> — pull model via Ollama (streams status)",
            "/tools — add custom skills (open the web UI; server-side files)",
            "/delete-tool — remove a skill (web UI)",
            "—",
            "Env: MIIIBOT_URL, TAVILY_API_KEY (default key at startup)",
            "Index documents into Chroma from the web UI (RAG ingest dialog).",
          ].join("\n"),
        );
        return;
      }
      if (text === "/quit" || text === "/exit") {
        exit();
        return;
      }
      if (text === "/new" || text === "/clear all") {
        setSystemPrompt("");
        setRagCollection("");
        setRowsState([
          {
            role: "system",
            text: "New chat — messages cleared; system prompt and RAG collection reset.",
          },
        ]);
        return;
      }
      if (text === "/clear") {
        setRowsState([
          {
            role: "system",
            text: "Messages cleared (system prompt and RAG selection unchanged).",
          },
        ]);
        return;
      }
      if (text === "/regenerate") {
        if (busy || pullBusy) {
          pushSystem("Wait for the current operation to finish.");
          return;
        }
        void regenerateLast();
        return;
      }
      if (text === "/models") {
        void (async () => {
          try {
            const list = await fetchModels(baseUrl);
            setModels(list);
            if (list.length && !model) setModel(list[0]);
            pushSystem(
              list.length ? list.join(", ") : "(empty — check Ollama)",
            );
          } catch (e) {
            pushSystem(e instanceof Error ? e.message : String(e));
          }
        })();
        return;
      }
      if (text.startsWith("/model")) {
        const rest = text.slice("/model".length).trim();
        if (!rest) {
          pushSystem(`Model: ${model || "(none)"}`);
          return;
        }
        setModel(rest);
        pushSystem(`Model set to ${rest}`);
        return;
      }
      if (text.startsWith("/url")) {
        const rest = text.slice("/url".length).trim().replace(/\/$/, "");
        if (!rest) {
          pushSystem(`URL: ${baseUrl}`);
          return;
        }
        setBaseUrl(rest);
        pushSystem(`URL set to ${rest} (re-fetching models…)`);
        return;
      }
      if (text === "/web") {
        pushSystem(
          [
            `Web search: ${webSearch ? "on" : "off"}`,
            tavilyApiKey.trim()
              ? "Tavily key: set (masked in /tavily)"
              : "Tavily key: not set — use /tavily set <key> or TAVILY_API_KEY",
          ].join("\n"),
        );
        return;
      }
      if (text === "/web on") {
        setWebSearch(true);
        pushSystem(
          "Web search ON — ensure a Tavily key is set (/tavily set) or server TAVILY_API_KEY.",
        );
        return;
      }
      if (text === "/web off") {
        setWebSearch(false);
        pushSystem("Web search OFF.");
        return;
      }
      if (text === "/tavily" || text === "/tavily clear") {
        if (text === "/tavily clear") {
          setTavilyApiKey("");
          pushSystem("Tavily key cleared for this session.");
          return;
        }
        pushSystem(
          tavilyApiKey.trim()
            ? `Tavily key is set (${tavilyApiKey.length} chars). Use /tavily clear to remove.`
            : "No Tavily key in session. Set with /tavily set <key> or TAVILY_API_KEY env.",
        );
        return;
      }
      if (text.startsWith("/tavily set ")) {
        const k = text.slice("/tavily set ".length).trim();
        if (!k) {
          pushSystem("Usage: /tavily set <api-key>");
          return;
        }
        setTavilyApiKey(k);
        pushSystem("Tavily key saved for this session.");
        return;
      }
      if (text.startsWith("/system")) {
        const rest = text.slice("/system".length).trim();
        if (!rest) {
          pushSystem(
            systemPrompt.trim()
              ? `System prompt:\n${systemPrompt}`
              : "No custom system prompt (default Miii behavior).",
          );
          return;
        }
        if (rest === "clear") {
          setSystemPrompt("");
          pushSystem("System prompt cleared.");
          return;
        }
        setSystemPrompt(rest.replace(/\\n/g, "\n"));
        pushSystem("System prompt updated.");
        return;
      }
      if (text.startsWith("/rag")) {
        const rest = text.slice("/rag".length).trim();
        if (!rest) {
          pushSystem(
            ragCollection.trim()
              ? `RAG collection: ${ragCollection}`
              : "RAG: none (no Chroma collection).",
          );
          return;
        }
        if (rest === "none") {
          setRagCollection("");
          pushSystem("RAG collection cleared.");
          return;
        }
        if (rest === "list") {
          void (async () => {
            try {
              const { collections, message, connected } =
                await fetchRagCollections(baseUrl, chromaHdr);
              if (connected === false && message) {
                pushSystem(`${message}\n(collections: ${collections.join(", ") || "(none)"})`);
                return;
              }
              pushSystem(
                collections.length
                  ? collections.join(", ")
                  : "(no collections — ingest from web UI or Chroma CLI)",
              );
            } catch (e) {
              pushSystem(e instanceof Error ? e.message : String(e));
            }
          })();
          return;
        }
        setRagCollection(rest);
        pushSystem(`RAG collection set to “${rest}”.`);
        return;
      }
      if (text === "/chroma") {
        pushSystem(
          [
            "Chroma optional headers (Cloud / multi-tenant), sent with RAG and /rag list:",
            "/chroma key <token>   — x-chroma-token",
            "/chroma tenant <id>   — x-chroma-tenant",
            "/chroma database <id> — x-chroma-database",
            "/chroma clear — clear all three",
          ].join("\n"),
        );
        return;
      }
      if (text === "/chroma clear") {
        setChromaApiKey("");
        setChromaTenant("");
        setChromaDatabase("");
        pushSystem("Chroma headers cleared.");
        return;
      }
      if (text.startsWith("/chroma key")) {
        const v = text.slice("/chroma key".length).trim();
        setChromaApiKey(v);
        pushSystem(v ? "Chroma key set." : "Chroma key cleared.");
        return;
      }
      if (text.startsWith("/chroma tenant")) {
        const v = text.slice("/chroma tenant".length).trim();
        setChromaTenant(v);
        pushSystem(v ? "Chroma tenant set." : "Chroma tenant cleared.");
        return;
      }
      if (text.startsWith("/chroma database")) {
        const v = text.slice("/chroma database".length).trim();
        setChromaDatabase(v);
        pushSystem(v ? "Chroma database set." : "Chroma database cleared.");
        return;
      }
      if (text.startsWith("/pull ")) {
        const name = text.slice("/pull ".length).trim();
        if (!name || pullBusy) {
          if (!name) pushSystem("Usage: /pull <model> e.g. llama3.2");
          else pushSystem("Already pulling a model.");
          return;
        }
        setPullBusy(true);
        pushSystem(`Pulling ${name}…`);
        void (async () => {
          const lines: string[] = [];
          try {
            await streamOllamaPull(baseUrl, name, (line) => {
              lines.push(line);
            });
            const tail = lines.slice(-12).join("\n");
            pushSystem(
              tail
                ? `Pull log (last lines):\n${tail}`
                : "Pull completed (no log lines). Run /models to refresh.",
            );
            try {
              const list = await fetchModels(baseUrl);
              setModels(list);
              if (list.length && !model) setModel(list[0]!);
            } catch {
              /* ignore */
            }
          } catch (e) {
            pushSystem(e instanceof Error ? e.message : String(e));
          } finally {
            setPullBusy(false);
          }
        })();
        return;
      }
      if (text === "/tools") {
        pushSystem(
          "Custom skills are edited via the web UI (/tools opens Add tool). Files live on the server under the app’s skill storage.",
        );
        return;
      }
      if (text === "/delete-tool") {
        pushSystem(
          "Delete a skill from the web UI (/delete-tool) or remove the JSON file on the server.",
        );
        return;
      }

      if (busy || pullBusy) {
        pushSystem("Wait for the current reply or pull to finish.");
        return;
      }
      void runChat(text);
    },
    [
      baseUrl,
      busy,
      pullBusy,
      chromaHdr,
      exit,
      initialUrl,
      model,
      pushSystem,
      ragCollection,
      regenerateLast,
      runChat,
      systemPrompt,
      tavilyApiKey,
      webSearch,
    ],
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="magenta"
        paddingX={1}
        marginBottom={1}
      >
        <Text>
          <Text color="magenta" bold>
            Miii TUI
          </Text>
          <Text dimColor> · </Text>
          <Text color="cyan">{baseUrl}</Text>
          <Text dimColor> · </Text>
          <Text dimColor>
            {models.length ? `${models.length} tags · ` : ""}
          </Text>
          <Text>model </Text>
          <Text color="green">{model || "—"}</Text>
          <Text dimColor> · </Text>
          <Text>web </Text>
          <Text color={webSearch ? "yellow" : "gray"}>
            {webSearch ? "on" : "off"}
          </Text>
          <Text dimColor> · </Text>
          <Text dimColor>{busy ? "streaming…" : pullBusy ? "pulling…" : "idle"}</Text>
          <Text dimColor> · </Text>
          <Text dimColor>sys </Text>
          <Text color={systemPrompt.trim() ? "yellow" : "gray"}>
            {systemPrompt.trim() ? "on" : "off"}
          </Text>
          <Text dimColor> · </Text>
          <Text dimColor>rag </Text>
          <Text color={ragCollection.trim() ? "magenta" : "gray"}>
            {ragCollection.trim()
              ? ragCollection.length > 14
                ? `${ragCollection.slice(0, 12)}…`
                : ragCollection
              : "—"}
          </Text>
        </Text>
      </Box>

      {modelsHint ? (
        <Box
          marginBottom={1}
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
        >
          <Text color="yellow">{modelsHint}</Text>
        </Box>
      ) : null}

      <Box
        flexDirection="column"
        flexGrow={1}
        marginBottom={1}
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={1}
      >
        {truncated ? (
          <Box marginBottom={1}>
            <Text dimColor italic>
              ▲ Older messages not shown — widen/tall terminal or /clear
            </Text>
          </Box>
        ) : null}
        {bubbles.map((bubble, bi) => {
          const isLastBubble = bi === bubbles.length - 1;
          const showCaret =
            isLastBubble && bubble.role === "assistant" && streamingAssistant;

          if (bubble.role === "system") {
            return (
              <Box key={bubble.key} marginBottom={1} flexDirection="column">
                {bubble.lines.map((ln, j) => (
                  <Text key={`${bubble.key}-l${j}`} dimColor color="yellow">
                    {ln ? `▸ ${ln}` : " "}
                  </Text>
                ))}
              </Box>
            );
          }

          if (bubble.role === "user") {
            return (
              <Box key={bubble.key} flexDirection="row" marginBottom={1}>
                <Spacer />
                <Box
                  borderStyle="round"
                  borderColor="cyan"
                  paddingX={1}
                  width={bubbleOuterWidth}
                >
                  <Box flexDirection="column">
                    <Text bold color="cyan">
                      You
                    </Text>
                    {bubble.lines.map((ln, j) => (
                      <Text key={`${bubble.key}-l${j}`} color="white">
                        {ln}
                      </Text>
                    ))}
                  </Box>
                </Box>
              </Box>
            );
          }

          return (
            <Box key={bubble.key} flexDirection="row" marginBottom={1}>
              <Box
                borderStyle="round"
                borderColor="green"
                paddingX={1}
                width={bubbleOuterWidth}
              >
                <Box flexDirection="column">
                  <Text bold color="green">
                    Miii
                  </Text>
                  {bubble.lines.length === 0 && showCaret ? (
                    <Text color="white">
                      <Text dimColor>▌</Text>
                    </Text>
                  ) : (
                    bubble.lines.map((ln, j) => {
                      const last = j === bubble.lines.length - 1;
                      return (
                        <Text key={`${bubble.key}-l${j}`} color="white">
                          {ln}
                          {last && showCaret ? <Text dimColor> ▌</Text> : null}
                        </Text>
                      );
                    })
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
        <Text color="cyan">{busy ? "… " : "› "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Message or /help"
        />
      </Box>
    </Box>
  );
}

const { url } = parseArgs(process.argv.slice(2));
render(<App initialUrl={url} />);
