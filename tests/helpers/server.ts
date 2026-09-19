import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".json": "application/json",
};

export type FixtureServer = { url: string; close: () => Promise<void> };

/**
 * Serve a directory over HTTP for tests. Extra headers can be attached per
 * path so a test can simulate X-Robots-Tag or an error status.
 */
export async function serveDir(
  root: string,
  options: { headers?: Record<string, Record<string, string>>; status?: Record<string, number> } = {},
): Promise<FixtureServer> {
  const server: Server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
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
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
