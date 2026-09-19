export type FetchResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  contentType: string;
  text: string;
  byteLength: number;
  truncated: boolean;
  error: string | null;
};

export type FetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
};

export const USER_AGENT =
  "Mozilla/5.0 (compatible; ai-readable/0.1; +https://github.com/Citlyze/ai-readable)";

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Only http and https URLs are supported, got ${url.protocol}`);
  }
  return url.toString();
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof DOMException && error.name === "AbortError") return "Request timed out.";
  if (/timeout|timed?[ _-]?out|ETIMEDOUT/i.test(message)) return "Request timed out.";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return "Domain could not be resolved.";
  if (/certificate|CERT_|SSL|TLS|EPROTO/i.test(message))
    return "TLS certificate could not be verified.";
  if (/ECONN|EHOSTUNREACH|ENETUNREACH|fetch failed/i.test(message))
    return "Site could not be reached.";
  return message || "Request failed.";
}

async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; byteLength: number; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return { text, byteLength: Buffer.byteLength(text), truncated: false };
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (received + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - received));
      received = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return { text, byteLength: received, truncated };
}

/**
 * Byte-capped, timeout-bounded fetch. Follows redirects, sends a browser-like
 * user agent that identifies the tool, and never throws: failures come back
 * as `error` so a page report can still be written.
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxBytes = options.maxBytes ?? 256 * 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base: FetchResult = {
    requestedUrl: url,
    finalUrl: url,
    status: 0,
    ok: false,
    headers: {},
    contentType: "",
    text: "",
    byteLength: 0,
    truncated: false,
    error: null,
  };
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "accept-language": "en",
        ...options.headers,
      },
    });
    const headers = Object.fromEntries([...response.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
    const body = await readLimited(response, maxBytes);
    return {
      ...base,
      finalUrl: response.url || url,
      status: response.status,
      ok: response.ok,
      headers,
      contentType: headers["content-type"] ?? "",
      ...body,
    };
  } catch (error) {
    return { ...base, error: describe(error) };
  } finally {
    clearTimeout(timer);
  }
}
