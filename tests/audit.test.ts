import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditUrl } from "../src/engine/audit";
import { fetchText } from "../src/engine/fetch";
import { serveDir, type FixtureServer } from "./helpers/server";

const ROOT = join(__dirname, "..", "site");
const SECRET = { "x-preview-bypass": "s3cret" };

let site: FixtureServer;
let other: FixtureServer;

beforeAll(async () => {
  // "other" plays the third-party host a page might redirect to.
  other = await serveDir(ROOT);
  site = await serveDir(ROOT, {
    redirects: { "/go-elsewhere": `${other.url}/fixture/blocked/`, "/go-home": "/fixture/" },
    bodies: {
      "/spa-fallback/robots.txt": { body: "<!doctype html><html><body>app shell</body></html>" },
    },
  });
});

afterAll(async () => {
  await site.close();
  await other.close();
});

describe("fetchText", () => {
  it("follows a same-origin redirect and keeps custom headers", async () => {
    const result = await fetchText(`${site.url}/go-home`, { headers: SECRET });
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe(`${site.url}/fixture/`);
    expect(result.redirects).toEqual([`${site.url}/fixture/`]);
    const landing = site.requests.find((r) => r.url === "/fixture/");
    expect(landing?.headers["x-preview-bypass"]).toBe("s3cret");
  });

  it("drops custom headers on a cross-origin redirect", async () => {
    const result = await fetchText(`${site.url}/go-elsewhere`, { headers: SECRET });
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe(`${other.url}/fixture/blocked/`);
    const hop = other.requests.find((r) => r.url === "/fixture/blocked/");
    expect(hop).toBeDefined();
    expect(hop?.headers["x-preview-bypass"]).toBeUndefined();
    expect(hop?.headers["user-agent"]).toContain("ai-readable");
  });

  it("stops after too many redirects", async () => {
    const loop = await serveDir(ROOT, { redirects: { "/a": "/b", "/b": "/a" } });
    try {
      const result = await fetchText(`${loop.url}/a`, { maxRedirects: 3 });
      expect(result.error).toBe("Too many redirects.");
      expect(result.redirects).toHaveLength(3);
    } finally {
      await loop.close();
    }
  });

  it("truncates at the byte cap", async () => {
    const result = await fetchText(`${site.url}/fixture/`, { maxBytes: 100 });
    expect(result.truncated).toBe(true);
    expect(result.byteLength).toBe(100);
  });
});

describe("auditUrl", () => {
  it("re-reads robots.txt from the final origin after a cross-origin redirect, without the secret", async () => {
    other.requests.length = 0;
    const report = await auditUrl(`${site.url}/go-elsewhere`, { headers: SECRET });
    expect(report.finalUrl).toBe(`${other.url}/fixture/blocked/`);
    const robots = other.requests.filter((r) => r.url === "/robots.txt");
    expect(robots.length).toBeGreaterThan(0);
    expect(robots.every((r) => r.headers["x-preview-bypass"] === undefined)).toBe(true);
    // The other host's robots.txt blocks OAI-SearchBot for /blocked/.
    expect(report.bots.find((b) => b.name === "OAI-SearchBot")?.allowed).toBe(false);
  });

  it("does not mistake an HTML fallback page for robots.txt", async () => {
    // Serve robots.txt as HTML via a sub-path by pointing the audit at a page whose origin has that body.
    const spa = await serveDir(ROOT, {
      bodies: { "/robots.txt": { body: "<!doctype html><html><body>app shell</body></html>" } },
    });
    try {
      const report = await auditUrl(`${spa.url}/fixture/`);
      expect(report.robotsTxt.found).toBe(false);
      expect(report.checks.find((c) => c.id === "crawlerAccess")?.detail).toContain("No robots.txt");
      expect(report.bots.every((b) => b.allowed)).toBe(true);
    } finally {
      await spa.close();
    }
  });

  it("reports an HTML llms.txt as absent", async () => {
    const spa = await serveDir(ROOT, {
      bodies: { "/llms.txt": { body: "<html><body>404</body></html>" } },
    });
    try {
      const report = await auditUrl(`${spa.url}/fixture/`);
      expect(report.llmsTxt.found).toBe(false);
    } finally {
      await spa.close();
    }
  });
});

describe("renderPage header scoping", () => {
  it("sends custom headers to the page origin only, never to third-party requests", async () => {
    const { renderPage } = await import("../src/engine/render");
    const third = await serveDir(ROOT, {
      bodies: { "/vendor.js": { body: "window.__vendor = 1;", type: "application/javascript" } },
    });
    const app = await serveDir(ROOT, {
      bodies: {
        "/app.js": { body: "document.body.insertAdjacentHTML('beforeend','<p>hydrated</p>');", type: "application/javascript" },
        "/page": {
          body: `<!doctype html><html><head><title>Render test page</title></head><body><h1>Render test</h1><script src="/app.js"></script><script src="${third.url}/vendor.js"></script></body></html>`,
        },
      },
    });
    try {
      const result = await renderPage(`${app.url}/page`, { headers: SECRET });
      expect(result.error).toBeNull();
      expect(result.html).toContain("hydrated");
      const own = app.requests.filter((r) => r.url === "/app.js" || r.url === "/page");
      expect(own.length).toBeGreaterThan(0);
      expect(own.every((r) => r.headers["x-preview-bypass"] === "s3cret")).toBe(true);
      const vendor = third.requests.filter((r) => r.url === "/vendor.js");
      expect(vendor.length).toBeGreaterThan(0);
      expect(vendor.every((r) => r.headers["x-preview-bypass"] === undefined)).toBe(true);
    } finally {
      await app.close();
      await third.close();
    }
  }, 60000);
});

describe("fetchText error messages", () => {
  it("explains a blocked port instead of a generic failure", async () => {
    const result = await fetchText("http://127.0.0.1:4190/");
    expect(result.error).toContain("blocked-port list");
  });
});
