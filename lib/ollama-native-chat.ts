import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { getOllamaBaseUrl } from "@/lib/ollama";
import { messageContentToString } from "@/lib/messages";

import type { ChatStreamPart } from "@/lib/chat-stream-types";

export type OllamaApiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Maps LangChain messages to Ollama `/api/chat` message list (merges adjacent system messages). */
export function langchainMessagesToOllamaApi(
  messages: BaseMessage[],
): OllamaApiMessage[] {
  const rows: OllamaApiMessage[] = [];
  for (const m of messages) {
    if (m instanceof SystemMessage) {
      const content = messageContentToString(m);
      const last = rows[rows.length - 1];
      if (last?.role === "system") {
        last.content = `${last.content}\n\n${content}`;
      } else {
        rows.push({ role: "system", content });
      }
      continue;
    }
    if (m instanceof HumanMessage) {
      rows.push({ role: "user", content: messageContentToString(m) });
      continue;
    }
    if (m instanceof AIMessage) {
      rows.push({ role: "assistant", content: messageContentToString(m) });
    }
  }
  return rows;
}

type OllamaStreamLine = {
  message?: { role?: string; content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
};

/**
 * Streams tokens from Ollama's native HTTP API and emits usage on the final `done` line.
 * Used when no tools are active so we get accurate token counts from Ollama.
 */
export async function* streamOllamaNativeChat(
  model: string,
  ollamaMessages: OllamaApiMessage[],
): AsyncGenerator<ChatStreamPart, void, undefined> {
  const base = getOllamaBaseUrl();
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t?.trim() || `Ollama returned ${res.status}`);
  }
  if (!res.body) {
    throw new Error("No response body from Ollama");
  }

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
      let obj: OllamaStreamLine;
      try {
        obj = JSON.parse(line) as OllamaStreamLine;
      } catch {
        continue;
      }
      const piece = obj.message?.content;
      if (typeof piece === "string" && piece.length > 0) {
        yield { type: "token", t: piece };
      }
      if (obj.done === true) {
        yield {
          type: "meta",
          promptEvalCount:
            typeof obj.prompt_eval_count === "number"
              ? obj.prompt_eval_count
              : undefined,
          evalCount:
            typeof obj.eval_count === "number" ? obj.eval_count : undefined,
          totalDurationNs:
            typeof obj.total_duration === "number"
              ? obj.total_duration
              : undefined,
        };
      }
    }
    if (done) break;
  }

  const tail = buffer.trim();
  if (tail) {
    try {
      const obj = JSON.parse(tail) as OllamaStreamLine;
      const piece = obj.message?.content;
      if (typeof piece === "string" && piece.length > 0) {
        yield { type: "token", t: piece };
      }
      if (obj.done === true) {
        yield {
          type: "meta",
          promptEvalCount:
            typeof obj.prompt_eval_count === "number"
              ? obj.prompt_eval_count
              : undefined,
          evalCount:
            typeof obj.eval_count === "number" ? obj.eval_count : undefined,
          totalDurationNs:
            typeof obj.total_duration === "number"
              ? obj.total_duration
              : undefined,
        };
      }
    } catch {
      /* ignore */
    }
  }
}
