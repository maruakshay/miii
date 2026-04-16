/**
 * Shared Chroma HTTP URL helpers (no chromadb import — safe for client components).
 * Client-provided URLs are restricted to loopback hosts to avoid SSRF from the API.
 */

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0:0:0:0:0:0:0:1"
  );
}

/**
 * Normalize a user-supplied Chroma base URL. Only http(s) on loopback is allowed.
 * Returns null if empty, invalid, or non-loopback.
 */
export function normalizeClientChromaUrl(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!isLoopbackHostname(u.hostname)) return null;
  return u.href.replace(/\/$/, "");
}

export function isLoopbackHost(hostname: string): boolean {
  return isLoopbackHostname(hostname);
}
