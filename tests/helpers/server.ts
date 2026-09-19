import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".json": "application/json",
};

export type FixtureServer = { url: string; close: () => Promise<void>; requests: IncomingMessage[] };

/**
 * Serve a directory over HTTP for tests. Extra headers, statuses and
 * redirects can be attached per path, and every request is recorded so a
 * test can inspect what headers arrived.
 */
export async function serveDir(
  root: string,
  options: {
    headers?: Record<string, Record<string, string>>;
    status?: Record<string, number>;
    redirects?: Record<string, string>;
    /** Serve this HTML body for a path instead of a file (e.g. an HTML 404 for robots.txt). */
    bodies?: Record<string, { body: string; type?: string; status?: number }>;
  } = {},
): Promise<FixtureServer> {
  const requests: IncomingMessage[] = [];
  const server: Server = createServer(async (req, res) => {
    requests.push(req);
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const redirect = options.redirects?.[pathname];
    if (redirect) {
      res.writeHead(302, { location: redirect });
      res.end();
      return;
    }
    const fixed = options.bodies?.[pathname];
    if (fixed) {
      res.writeHead(fixed.status ?? 200, { "content-type": fixed.type ?? "text/html; charset=utf-8" });
      res.end(fixed.body);
      return;
    }
    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, safe);
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);
      const extra = options.headers?.[pathname] ?? {};
      res.writeHead(options.status?.[pathname] ?? 200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        ...extra,
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><head><title>Not found</title></head><body><h1>Not found</h1></body></html>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
