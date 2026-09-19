import { BOTS, type Bot } from "./bots";
import { runChecks, type Check } from "./checks";
import { extractPageFacts, type PageFacts } from "./extract";
import { fetchText, normalizeUrl, type FetchResult } from "./fetch";
import { compareStaticVsRendered, type RenderGap } from "./gap";
import { renderPage } from "./render";
import { evaluateBots, sitemapsIn, type BotVerdict } from "./robots";

export const REPORT_SCHEMA_VERSION = 1;

export type BotRow = {
  id: string;
  name: string;
  organization: string;
  category: Bot["category"];
  allowed: boolean;
  token: string;
  rule: string | null;
  line: number | null;
  docs: string;
};

export type PageReport = {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  tool: { name: "ai-readable"; version: string };
  url: string;
  finalUrl: string;
  fetchedAt: string;
  httpStatus: number | null;
  /** Set when the page could not be fetched at all; checks then reflect that. */
  fetchError: string | null;
  score: number;
  checks: Check[];
  bots: BotRow[];
  robotsTxt: { found: boolean; sitemaps: string[] };
  llmsTxt: { found: boolean };
  gap: RenderGap | null;
  /** Why the gap is null when rendering was requested. */
  renderError: string | null;
  facts: PageFacts;
};

export type AuditOptions = {
  render?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
  bots?: Bot[];
  version?: string;
};

const PAGE_MAX_BYTES = 2 * 1024 * 1024;
const SIDECAR_MAX_BYTES = 64 * 1024;

function toRow(verdict: BotVerdict): BotRow {
  return {
    id: verdict.bot.id,
    name: verdict.bot.name,
    organization: verdict.bot.organization,
    category: verdict.bot.category,
    allowed: verdict.allowed,
    token: verdict.token,
    rule: verdict.rule,
    line: verdict.line,
    docs: verdict.bot.docs,
  };
}

function isHtml(result: FetchResult): boolean {
  return /text\/html|application\/xhtml/i.test(result.contentType) || /^\s*<(!doctype|html)/i.test(result.text);
}

/** A robots.txt only counts when the server returned a plain-text body, not an HTML fallback page. */
function robotsBody(result: FetchResult): string | null {
  if (!result.ok || isHtml(result)) return null;
  return result.text;
}

function llmsBody(result: FetchResult): string | null {
  if (!result.ok || isHtml(result)) return null;
  return result.text;
}

/** Audit one URL: page + robots.txt + llms.txt in parallel, optional render. */
export async function auditUrl(input: string, options: AuditOptions = {}): Promise<PageReport> {
  const url = normalizeUrl(input);
  const timeoutMs = options.timeoutMs ?? 8000;
  const headers = options.headers;
  const sidecar = { timeoutMs: Math.min(timeoutMs, 5000), maxBytes: SIDECAR_MAX_BYTES, headers };

  const origin = new URL(url).origin;
  let [page, robots, llms] = await Promise.all([
    fetchText(url, { timeoutMs, maxBytes: PAGE_MAX_BYTES, headers }),
    fetchText(`${origin}/robots.txt`, sidecar),
    fetchText(`${origin}/llms.txt`, sidecar),
  ]);

  // The page may have redirected to another host (apex to www, http to
  // https on a different domain). robots.txt belongs to the final origin.
  const finalUrl = page.finalUrl || url;
  const finalOrigin = new URL(finalUrl).origin;
  if (finalOrigin !== origin) {
    // Custom headers were scoped to the original origin; do not carry them over.
    const crossSidecar = { ...sidecar, headers: undefined };
    [robots, llms] = await Promise.all([
      fetchText(`${finalOrigin}/robots.txt`, crossSidecar),
      fetchText(`${finalOrigin}/llms.txt`, crossSidecar),
    ]);
  }

  const robotsTxt = robotsBody(robots);
  const llmsTxt = llmsBody(llms);

  const facts = extractPageFacts(page.text);
  const verdicts = evaluateBots(robotsTxt, finalUrl, options.bots ?? BOTS);
  const { score, checks } = runChecks({
    facts,
    bots: verdicts,
    httpStatus: page.error ? null : page.status,
    xRobotsTag: page.headers["x-robots-tag"] ?? null,
    robotsTxtFound: robotsTxt !== null,
    llmsTxt,
  });

  let gap: RenderGap | null = null;
  let renderError: string | null = null;
  if (options.render && !page.error) {
    // Same-origin rule as the fetch: headers only when the final URL kept the origin.
    const renderHeaders = finalOrigin === origin ? headers : undefined;
    const rendered = await renderPage(finalUrl, { headers: renderHeaders });
    if (rendered.html) gap = compareStaticVsRendered(facts, extractPageFacts(rendered.html));
    else renderError = rendered.error;
  }

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: { name: "ai-readable", version: options.version ?? "0.0.0" },
    url,
    finalUrl,
    fetchedAt: new Date().toISOString(),
    httpStatus: page.error ? null : page.status,
    fetchError: page.error,
    score: page.error ? 0 : score,
    checks,
    bots: verdicts.map(toRow),
    robotsTxt: { found: robotsTxt !== null, sitemaps: sitemapsIn(robotsTxt, finalUrl) },
    llmsTxt: { found: llmsTxt !== null && llmsTxt.trim().startsWith("#") },
    gap,
    renderError,
    facts,
  };
}
