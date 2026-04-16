import { getOllamaBaseUrl } from "@/lib/ollama";

export const maxDuration = 600;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const model =
    typeof body === "object" &&
    body !== null &&
    "model" in body &&
    typeof (body as { model: unknown }).model === "string"
      ? (body as { model: string }).model.trim()
      : "";
  if (!model) {
    return Response.json({ error: "model is required" }, { status: 400 });
  }

  const base = getOllamaBaseUrl();
  const res = await fetch(`${base}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: true }),
    signal: AbortSignal.timeout(600_000),
  });

  if (!res.ok) {
    const t = await res.text();
    return Response.json(
      { error: t || `Ollama returned ${res.status}` },
      { status: 502 },
    );
  }
  if (!res.body) {
    return Response.json({ error: "No stream body" }, { status: 502 });
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
