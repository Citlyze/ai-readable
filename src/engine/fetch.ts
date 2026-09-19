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
  redirects: string[];
  error: string | null;
};

export type FetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  /**
   * Extra request headers. They are sent only to the origin of the requested
   * URL: a redirect to another origin drops them, so a preview-deploy bypass
   * token can never travel to a third party.
   */
  headers?: Record<string, string>;
  maxRedirects?: number;
};

export const USER_AGENT =
  "Mozilla/5.0 (compatible; ai-readable/0.1; +https://github.com/Citlyze/ai-readable)";

const BASE_HEADERS: Record<string, string> = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
  "accept-language": "en",
};

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Only http and https URLs are supported, got ${url.protocol}`);
  }
  return url.toString();
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function describe(error: unknown): string {
  const cause = (error as { cause?: { message?: string; code?: string } }).cause;
  const message = [error instanceof Error ? error.message : String(error), cause?.message, cause?.code]
    .filter(Boolean)
    .join(" ");
  if (error instanceof DOMException && error.name === "AbortError") return "Request timed out.";
  if (/bad port/i.test(message))
    return "This port is on the Fetch specification's blocked-port list, so Node refuses to connect. Serve the site on another port.";
  if (/timeout|timed?[ _-]?out|ETIMEDOUT/i.test(message)) return "Request timed out.";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return "Domain could not be resolved.";
  if (/certificate|CERT_|SSL|TLS|EPROTO/i.test(message))
    return "TLS certificate could not be verified.";
  if (/ECONN|EHOSTUNREACH|ENETUNREACH|fetch failed/i.test(message))
    return "Site could not be reached.";
  return (message || "Request failed.").slice(0, 200);
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
 * Byte-capped, timeout-bounded fetch that follows redirects itself, so custom
 * headers stay on the original origin. Never throws: failures come back as
 * `error` so a page report can still be written.
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxBytes = options.maxBytes ?? 256 * 1024;
  const maxRedirects = options.maxRedirects ?? 5;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const redirects: string[] = [];
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
    redirects,
    error: null,
  };

  try {
    let current = url;
    for (;;) {
      const extra = sameOrigin(current, url) ? options.headers ?? {} : {};
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { ...BASE_HEADERS, ...extra },
      });

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => undefined);
        if (redirects.length >= maxRedirects) {
          return { ...base, finalUrl: current, status: response.status, error: "Too many redirects." };
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return { ...base, finalUrl: current, status: response.status, error: "Invalid redirect location." };
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return { ...base, finalUrl: current, status: response.status, error: "Redirected to a non-http URL." };
        }
        redirects.push(next.toString());
        current = next.toString();
        continue;
      }

      const headers = Object.fromEntries(
        [...response.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]),
      );
      const body = await readLimited(response, maxBytes);
      return {
        ...base,
        finalUrl: current,
        status: response.status,
        ok: response.ok,
        headers,
        contentType: headers["content-type"] ?? "",
        ...body,
      };
    }
  } catch (error) {
    return { ...base, error: describe(error) };
  } finally {
    clearTimeout(timer);
  }
}
