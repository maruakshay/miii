import { ChromaClient } from "chromadb";

import { isLoopbackHost, normalizeClientChromaUrl } from "@/lib/chroma-url";
import { getOllamaBaseUrl } from "@/lib/ollama";

export type ChromaAuthOptions = {
  /** Sent as `x-chroma-token` (Chroma Cloud and compatible servers). */
  apiKey?: string | null;
  tenant?: string | null;
  database?: string | null;
};

export function getChromaUrl(): string {
  return process.env.CHROMA_URL?.trim() || "http://127.0.0.1:8000";
}

/**
 * Prefer optional loopback URL from client header, then server env / default.
 */
export function resolveChromaBaseUrl(req: Request): string {
  const fromHeader = normalizeClientChromaUrl(req.headers.get("x-chroma-url"));
  if (fromHeader) return fromHeader;
  return getChromaUrl();
}

/** Resolve base URL for /api/chat from optional JSON field (same rules as header). */
export function resolveChromaBaseUrlFromBody(bodyChromaUrl: string | undefined): string {
  const fromBody = normalizeClientChromaUrl(bodyChromaUrl);
  if (fromBody) return fromBody;
  return getChromaUrl();
}

export function getOllamaEmbedModel(): string {
  return process.env.OLLAMA_EMBED_MODEL?.trim() || "nomic-embed-text";
}

function parseChromaUrl(urlStr: string): { host: string; port: number; ssl: boolean } {
  const url = new URL(urlStr);
  const ssl = url.protocol === "https:";
  let port = url.port
    ? parseInt(url.port, 10)
    : ssl
      ? 443
      : 80;
  // Chroma’s local HTTP API defaults to 8000; `http://localhost` without a port must not become :80.
  if (!url.port && !ssl && isLoopbackHost(url.hostname)) {
    port = 8000;
  }
  return { host: url.hostname, port, ssl };
}

/**
 * Optional auth merges client-provided token with server env (`CHROMA_API_KEY`, etc.).
 */
export function getChromaClient(
  opts?: ChromaAuthOptions,
  baseUrlOverride?: string,
): ChromaClient {
  const base = (baseUrlOverride ?? getChromaUrl()).trim();
  const { host, port, ssl } = parseChromaUrl(base);
  const apiKey =
    opts?.apiKey?.trim() || process.env.CHROMA_API_KEY?.trim() || "";
  const tenant =
    opts?.tenant?.trim() || process.env.CHROMA_TENANT?.trim() || undefined;
  const database =
    opts?.database?.trim() || process.env.CHROMA_DATABASE?.trim() || undefined;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["x-chroma-token"] = apiKey;
  }
  return new ChromaClient({
    host,
    port,
    ssl,
    tenant,
    database,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

/** Reads Chroma token / tenant / database from request headers. */
export function chromaAuthFromRequest(req: Request): ChromaAuthOptions {
  return {
    apiKey: req.headers.get("x-chroma-token")?.trim() || null,
    tenant: req.headers.get("x-chroma-tenant")?.trim() || null,
    database: req.headers.get("x-chroma-database")?.trim() || null,
  };
}

/** Ollama `/api/embeddings` — returns embedding vector for one prompt. */
export async function ollamaEmbed(prompt: string): Promise<number[]> {
  const base = getOllamaBaseUrl();
  const model = getOllamaEmbedModel();
  const res = await fetch(`${base}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(
      t?.trim() ||
        `Ollama embeddings failed (${res.status}). Pull the embed model: ollama pull ${model}`,
    );
  }
  const data = (await res.json()) as { embedding?: number[] };
  const emb = data.embedding;
  if (!Array.isArray(emb) || emb.length === 0) {
    throw new Error("Invalid embedding response from Ollama");
  }
  return emb;
}

function chunkText(text: string, maxChunk = 900, overlap = 120): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  if (t.length <= maxChunk) return [t];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + maxChunk, t.length);
    chunks.push(t.slice(i, end).trim());
    if (end >= t.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks.filter(Boolean);
}

export async function ingestTextIntoCollection(
  collectionName: string,
  text: string,
  sourceLabel?: string,
  auth?: ChromaAuthOptions,
  chromaBaseUrl?: string,
): Promise<{ chunks: number }> {
  const client = getChromaClient(auth, chromaBaseUrl);
  const collection = await client.getOrCreateCollection({
    name: collectionName,
    metadata: { source: "miii-rag" },
  });
  const parts = chunkText(text);
  if (parts.length === 0) return { chunks: 0 };

  const embeddings: number[][] = [];
  for (const p of parts) {
    embeddings.push(await ollamaEmbed(p));
  }
  const rid = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const ids = parts.map((_, i) => `${collectionName}-${rid}-${i}`);
  await collection.add({
    ids,
    embeddings,
    documents: parts,
    metadatas: parts.map((_, i) => ({
      chunk: i,
      source: sourceLabel ?? "paste",
    })),
  });
  return { chunks: parts.length };
}

export async function queryCollectionContext(
  collectionName: string,
  query: string,
  k = 5,
  auth?: ChromaAuthOptions,
  chromaBaseUrl?: string,
): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const client = getChromaClient(auth, chromaBaseUrl);
  let collection;
  try {
    collection = await client.getCollection({ name: collectionName });
  } catch {
    return null;
  }
  const embedding = await ollamaEmbed(q);
  const result = await collection.query({
    queryEmbeddings: [embedding],
    nResults: k,
  });
  const docs = result.documents?.[0]?.filter(Boolean) as string[] | undefined;
  if (!docs?.length) return null;
  return docs.map((d, i) => `[${i + 1}] ${d}`).join("\n\n");
}
