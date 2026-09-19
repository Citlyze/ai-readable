import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { USER_AGENT } from "./fetch";

export type RenderResult = {
  html: string | null;
  error: string | null;
};

export const RENDER_HINT =
  "Rendered comparison needs Playwright. Install it with: npm i -D playwright && npx playwright install chromium";

type PlaywrightModule = typeof import("playwright");

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
 * Playwright is an optional peer dependency: when it is missing the result
 * carries a hint instead of throwing, so `--render` degrades to static-only.
 */
export async function renderPage(
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<RenderResult> {
  const playwright = await loadPlaywright();
  if (!playwright) return { html: null, error: RENDER_HINT };

  const timeoutMs = options.timeoutMs ?? 30000;
  let browser: Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>> | null = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      extraHTTPHeaders: options.headers,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    } catch {
      // Sites with long-polling never reach networkidle; settle for "load".
      await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    }
    // Give client-side routers a beat to paint.
    await page.waitForTimeout(500);
    const html = await page.content();
    return { html, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|browserType.launch/i.test(message)) {
      return { html: null, error: "Chromium is not installed. Run: npx playwright install chromium" };
    }
    return { html: null, error: message.split("\n")[0] };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
