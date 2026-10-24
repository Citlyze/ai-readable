import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sameOrigin, USER_AGENT } from "./fetch";

export type RenderResult = {
  html: string | null;
  error: string | null;
};

export const RENDER_HINT =
  "Rendered comparison needs Playwright. Install it with: npm i -D playwright && npx playwright install chromium";

type PlaywrightModule = typeof import("playwright");

const MAX_REDIRECTS = 5;

let cached: Promise<PlaywrightModule | null> | null = null;

/**
 * Resolve Playwright from our own dependencies first, then from the project
 * the command runs in. `npx ai-readable` executes from the npx cache, so a
 * Playwright installed in the user's project is only reachable via cwd.
 */
async function loadPlaywright(): Promise<PlaywrightModule | null> {
  if (!cached) {
    cached = (async () => {
      try {
        return await import("playwright");
      } catch {
        // fall through
      }
      try {
        const require = createRequire(join(process.cwd(), "package.json"));
        const entry = require.resolve("playwright");
        return (await import(pathToFileURL(entry).href)) as PlaywrightModule;
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

/**
 * Load the page in headless Chromium and return the DOM after JavaScript ran.
 * Custom headers (a preview bypass token, basic auth) are attached only to
 * requests for the page's own origin; third-party scripts, fonts and
 * analytics never see them. Playwright is an optional peer dependency: when
 * it is missing the result carries a hint instead of throwing.
 */
export async function renderPage(
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<RenderResult> {
  const playwright = await loadPlaywright();
  if (!playwright) return { html: null, error: RENDER_HINT };

  const timeoutMs = options.timeoutMs ?? 30000;
  const extra = options.headers ?? {};
  let browser: Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>> | null = null;
  try {
    const scoped = Object.keys(extra).length > 0;
    browser = await playwright.chromium.launch({
      headless: true,
      // With custom headers, own-origin responses are fulfilled from Node (see
      // the route below). Chromium cannot tell which address space a fulfilled
      // document came from, so its local-network checks would block a
      // localhost page from loading its other localhost services.
      args: scoped ? ["--disable-features=LocalNetworkAccessChecks"] : [],
    });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 900 },
      javaScriptEnabled: true,
    });
    if (scoped) {
      await context.route("**/*", async (route) => {
        const request = route.request();
        if (!sameOrigin(request.url(), url)) {
          await route.continue();
          return;
        }
        // route.continue({ headers }) carries the headers onto every redirect
        // the request triggers, including one to another origin. Fetch each
        // hop here with redirects off instead. Same-origin hops of a
        // subresource are followed here with the headers; any other redirect
        // goes back to the browser, which follows it without them (a hop the
        // browser follows is not routed again). That drops the headers on a
        // same-origin redirect of a navigation, which is rare here: callers
        // render the URL the static fetch already resolved.
        const headers = { ...request.headers(), ...extra };
        try {
          let target = request.url();
          for (let hop = 0; ; hop += 1) {
            const response = await route.fetch({ url: target, headers, maxRedirects: 0 });
            const location = response.status() >= 300 && response.status() < 400 ? response.headers().location : undefined;
            const next = location ? new URL(location, target).toString() : null;
            if (!next || !sameOrigin(next, url) || request.isNavigationRequest() || hop >= MAX_REDIRECTS) {
              await route.fulfill({ response });
              return;
            }
            target = next;
          }
        } catch {
          await route.abort().catch(() => undefined);
        }
      });
    }
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    // Sites with long-polling never reach networkidle; do not fail on that.
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    // Give client-side routers a beat to paint.
    await page.waitForTimeout(500);
    const html = await page.content();
    return { html, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|browserType.launch/i.test(message)) {
      return { html: null, error: "Chromium is not installed. Run: npx playwright install chromium" };
    }
    return { html: null, error: message.split("\n")[0].slice(0, 200) };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
