import { NextResponse } from "next/server";

import { streamChatParts } from "@/lib/chat-graph";
import {
  buildChatSystemMessage,
  jsonToMessages,
  type ChatMessageJSON,
} from "@/lib/messages";
import { resolveTavilyApiKey } from "@/lib/chat-tools";
import {
  type ChromaAuthOptions,
  queryCollectionContext,
} from "@/lib/rag-chroma";

export const maxDuration = 120;

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

function ndjsonLine(obj: NdLine): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

function lastUserContent(rows: ChatMessageJSON[]): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i];
    if (m?.role === "user" && typeof m.content === "string") {
      return m.content;
    }
  }
  return null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model =
    typeof body === "object" &&
    body !== null &&
    "model" in body &&
    typeof (body as { model: unknown }).model === "string"
      ? (body as { model: string }).model
      : null;

  const rawMessages =
    typeof body === "object" &&
    body !== null &&
    "messages" in body &&
    Array.isArray((body as { messages: unknown }).messages)
      ? (body as { messages: ChatMessageJSON[] }).messages
      : null;

  const wantWebSearch =
    typeof body === "object" &&
    body !== null &&
    "webSearch" in body &&
    (body as { webSearch?: unknown }).webSearch === true;

  const clientTavilyKey =
    typeof body === "object" &&
    body !== null &&
    "tavilyApiKey" in body &&
    typeof (body as { tavilyApiKey?: unknown }).tavilyApiKey === "string"
      ? (body as { tavilyApiKey: string }).tavilyApiKey
      : null;

  const systemPromptOverride =
    typeof body === "object" &&
    body !== null &&
    "systemPrompt" in body &&
    typeof (body as { systemPrompt?: unknown }).systemPrompt === "string"
      ? (body as { systemPrompt: string }).systemPrompt
      : null;

  const ragCollection =
    typeof body === "object" &&
    body !== null &&
    "ragCollection" in body &&
    typeof (body as { ragCollection?: unknown }).ragCollection === "string"
      ? (body as { ragCollection: string }).ragCollection.trim()
      : "";

  const chromaApiKey =
    typeof body === "object" &&
    body !== null &&
    "chromaApiKey" in body &&
    typeof (body as { chromaApiKey?: unknown }).chromaApiKey === "string"
      ? (body as { chromaApiKey: string }).chromaApiKey.trim()
      : "";
  const chromaTenant =
    typeof body === "object" &&
    body !== null &&
    "chromaTenant" in body &&
    typeof (body as { chromaTenant?: unknown }).chromaTenant === "string"
      ? (body as { chromaTenant: string }).chromaTenant.trim()
      : "";
  const chromaDatabase =
    typeof body === "object" &&
    body !== null &&
    "chromaDatabase" in body &&
    typeof (body as { chromaDatabase?: unknown }).chromaDatabase === "string"
      ? (body as { chromaDatabase: string }).chromaDatabase.trim()
      : "";

  const chromaAuth: ChromaAuthOptions | undefined =
    chromaApiKey || chromaTenant || chromaDatabase
      ? {
          apiKey: chromaApiKey || null,
          tenant: chromaTenant || null,
          database: chromaDatabase || null,
        }
      : undefined;

  const resolvedTavilyKey = resolveTavilyApiKey(clientTavilyKey);

  if (wantWebSearch && !resolvedTavilyKey) {
    return NextResponse.json(
      {
        error: "TAVILY_KEY_REQUIRED",
        message:
          "Web search is on but no Tavily API key is configured. Add your key in the app or set TAVILY_API_KEY on the server.",
      },
      { status: 400 },
    );
  }

  if (!model?.trim()) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }
  if (!rawMessages?.length) {
    return NextResponse.json(
      { error: "messages are required" },
      { status: 400 },
    );
  }

  for (const m of rawMessages) {
    if (
      !m ||
      typeof m !== "object" ||
      !["user", "assistant", "system"].includes(m.role) ||
      typeof m.content !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid message shape" },
        { status: 400 },
      );
    }
  }

  const webSearchEnabled = wantWebSearch && Boolean(resolvedTavilyKey);

  let ragContext: string | null = null;
  if (ragCollection) {
    const lastUser = lastUserContent(rawMessages);
    if (!lastUser?.trim()) {
      return NextResponse.json(
        { error: "No user message to query RAG against" },
        { status: 400 },
      );
    }
    try {
      ragContext = await queryCollectionContext(
        ragCollection,
        lastUser,
        5,
        chromaAuth,
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Chroma or embedding query failed";
      console.error(e);
      return NextResponse.json(
        {
          error: "RAG_UNAVAILABLE",
          message,
        },
        { status: 503 },
      );
    }
  }

  const messages = [
    buildChatSystemMessage({
      webSearchEnabled,
      customSystemPrompt: systemPromptOverride,
      ragContext,
    }),
    ...jsonToMessages(rawMessages),
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of streamChatParts(messages, model.trim(), {
          webSearch: wantWebSearch,
          tavilyApiKey: clientTavilyKey,
        })) {
          if (part.type === "token") {
            controller.enqueue(ndjsonLine({ type: "token", t: part.t }));
          } else if (part.type === "meta") {
            controller.enqueue(
              ndjsonLine({
                type: "meta",
                promptEvalCount: part.promptEvalCount,
                evalCount: part.evalCount,
                totalDurationNs: part.totalDurationNs,
              }),
            );
          }
        }
        controller.enqueue(ndjsonLine({ type: "done" }));
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Chat failed";
        console.error(e);
        controller.enqueue(ndjsonLine({ type: "error", message }));
        controller.enqueue(ndjsonLine({ type: "done" }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
