import { ChromaConnectionError } from "chromadb";
import { NextResponse } from "next/server";

import { chromaAuthFromRequest, getChromaClient } from "@/lib/rag-chroma";

export async function GET(req: Request) {
  try {
    const client = getChromaClient(chromaAuthFromRequest(req));
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
        message:
          "Chroma is not running or not reachable. Start it (e.g. chroma run) or set CHROMA_URL.",
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
