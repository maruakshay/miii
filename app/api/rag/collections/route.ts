import { ChromaConnectionError } from "chromadb";
import { NextResponse } from "next/server";

import {
  chromaAuthFromRequest,
  getChromaClient,
  resolveChromaBaseUrl,
} from "@/lib/rag-chroma";

export async function GET(req: Request) {
  const baseUrl = resolveChromaBaseUrl(req);
  try {
    const client = getChromaClient(chromaAuthFromRequest(req), baseUrl);
    const cols = await client.listCollections();
    const names = cols
      .map((c) => c.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ collections: names, connected: true });
  } catch (e) {
    if (e instanceof ChromaConnectionError) {
      return NextResponse.json({
        collections: [] as string[],
        connected: false,
        message: `Chroma is not running or not reachable at ${baseUrl}. From the repo run npm run chroma (or npx chroma run), set CHROMA_URL on the server, or set the Chroma URL in the app (sidebar → Chroma).`,
      });
    }
    const message = e instanceof Error ? e.message : "Chroma unavailable";
    console.error(e);
    return NextResponse.json(
      { error: message, collections: [] as string[], connected: false },
      { status: 500 },
    );
  }
}
