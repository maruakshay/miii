import { ChromaConnectionError } from "chromadb";
import { NextResponse } from "next/server";

import { chromaAuthFromRequest, ingestTextIntoCollection } from "@/lib/rag-chroma";

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/;

export async function POST(req: Request) {
  const auth = chromaAuthFromRequest(req);
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
    }
    const collectionName = String(form.get("collectionName") ?? "").trim();
    const sourceRaw = form.get("source");
    const source =
      typeof sourceRaw === "string" && sourceRaw.trim()
        ? sourceRaw.trim()
        : undefined;

    if (!NAME_RE.test(collectionName)) {
      return NextResponse.json(
        {
          error:
            "Invalid collection name (use letters, numbers, dot, underscore, hyphen; max 63 chars)",
        },
        { status: 400 },
      );
    }

    const fileParts = form.getAll("files");
    const texts: string[] = [];
    for (const part of fileParts) {
      if (part instanceof File && part.size > 0) {
        const name = part.name || "file";
        try {
          texts.push(`\n\n## ${name}\n\n${await part.text()}`);
        } catch {
          return NextResponse.json(
            { error: `Could not read file: ${name}` },
            { status: 400 },
          );
        }
      }
    }
    const pasted = String(form.get("text") ?? "").trim();
    const combined = [pasted, ...texts].filter(Boolean).join("\n").trim();
    if (!combined) {
      return NextResponse.json(
        { error: "Add at least one file or paste text" },
        { status: 400 },
      );
    }

    try {
      const result = await ingestTextIntoCollection(
        collectionName,
        combined,
        source,
        auth,
      );
      return NextResponse.json({
        ok: true,
        collectionName,
        chunks: result.chunks,
      });
    } catch (e) {
      if (e instanceof ChromaConnectionError) {
        return NextResponse.json(
          {
            error:
              "Cannot reach Chroma. Check CHROMA_URL, run chroma, or set your API token.",
          },
          { status: 503 },
        );
      }
      const message = e instanceof Error ? e.message : "Ingest failed";
      console.error(e);
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const collectionName =
    typeof body === "object" &&
    body !== null &&
    "collectionName" in body &&
    typeof (body as { collectionName: unknown }).collectionName === "string"
      ? (body as { collectionName: string }).collectionName.trim()
      : "";
  const text =
    typeof body === "object" &&
    body !== null &&
    "text" in body &&
    typeof (body as { text: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";
  const source =
    typeof body === "object" &&
    body !== null &&
    "source" in body &&
    typeof (body as { source: unknown }).source === "string"
      ? (body as { source: string }).source.trim()
      : undefined;

  if (!NAME_RE.test(collectionName)) {
    return NextResponse.json(
      {
        error:
          "Invalid collection name (use letters, numbers, dot, underscore, hyphen; max 63 chars)",
      },
      { status: 400 },
    );
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const result = await ingestTextIntoCollection(
      collectionName,
      text,
      source,
      auth,
    );
    return NextResponse.json({
      ok: true,
      collectionName,
      chunks: result.chunks,
    });
  } catch (e) {
    if (e instanceof ChromaConnectionError) {
      return NextResponse.json(
        {
          error:
            "Cannot reach Chroma. Check CHROMA_URL, run chroma, or set your API token.",
        },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "Ingest failed";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
