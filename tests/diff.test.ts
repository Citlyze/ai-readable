import { describe, expect, it } from "vitest";
import type { PageReport } from "../src/engine/audit";
import { runChecks } from "../src/engine/checks";
import { extractPageFacts } from "../src/engine/extract";
import { evaluateBots } from "../src/engine/robots";
import { badgeJson } from "../src/cli/baseline";
import { DEFAULT_RULES, diffReports, summarize } from "../src/cli/diff";

const GOOD = `<title>A perfectly fine title here</title><meta name="description" content="${"d".repeat(60)}"><h1>Acme Widget Pro guide</h1><h2>How much?</h2><p>${"w ".repeat(30)}</p><h2>Why buy?</h2><p>${"w ".repeat(30)}</p><script type="application/ld+json">{"@type":"Product"}</script><ul><li>a</li><li>b</li><li>c</li></ul>`;

function report(html: string, robots = "User-agent: *\nAllow: /\n", extra: { [K in keyof PageReport]?: PageReport[K] } = {}): PageReport {
  const facts = extractPageFacts(html);
  const verdicts = evaluateBots(robots, "https://example.com/pricing");
  const { score, checks } = runChecks({ facts, bots: verdicts, httpStatus: 200, xRobotsTag: null, robotsTxtFound: true, llmsTxt: null });
  return {
    schemaVersion: 1,
    tool: { name: "ai-readable", version: "test" },
    url: "https://example.com/pricing",
    finalUrl: "https://example.com/pricing",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    httpStatus: 200,
    fetchError: null,
    score,
    checks,
    bots: verdicts.map((v) => ({ id: v.bot.id, name: v.bot.name, organization: v.bot.organization, category: v.bot.category, allowed: v.allowed, token: v.token, rule: v.rule, line: v.line, docs: v.bot.docs })),
    robotsTxt: { found: true, sitemaps: [] },
    llmsTxt: { found: false },
    gap: null,
    renderError: null,
    facts,
    ...extra,
  };
}

describe("diffReports", () => {
  const good = report(GOOD);

  it("passes a good page with no baseline and no absolute problems", () => {
    const result = diffReports(null, good);
    expect(result.failed).toBe(false);
    expect(result.regressions).toEqual([]);
  });

  it("only warns about blocked bots when there is no baseline", () => {
    const blocked = report(GOOD, "User-agent: PerplexityBot\nDisallow: /\n");
    const result = diffReports(null, blocked);
    expect(result.failed).toBe(false);
    expect(result.regressions[0]).toMatchObject({ rule: "botBlocked", severity: "warn", subject: "PerplexityBot" });
  });

  it("always fails a noindex page, baseline or not", () => {
    const noindex = report(`${GOOD}<meta name="robots" content="noindex">`);
    expect(diffReports(null, noindex).failed).toBe(true);
    expect(diffReports(summarize(noindex), noindex).regressions[0].rule).toBe("indexable");
  });

  it("fails on a newly blocked retrieval bot and names the rule", () => {
    const before = summarize(good);
    const after = report(GOOD, "User-agent: OAI-SearchBot\nDisallow: /pricing\n");
    const result = diffReports(before, after);
    expect(result.failed).toBe(true);
    const bot = result.regressions.find((r) => r.rule === "botBlocked");
    expect(bot?.message).toContain('Disallow: /pricing');
    // crawlerAccess also flipped pass -> fail
    expect(result.regressions.some((r) => r.rule === "checkRegression" && r.subject === "crawlerAccess")).toBe(true);
  });

  it("fails when the score drops more than the limit and passes within it", () => {
    const before = summarize(good);
    const noLists = report(GOOD.replace(/<ul>.*<\/ul>/, ""));
    expect(before.score - noLists.score).toBe(8);
    expect(diffReports(before, noLists, { ...DEFAULT_RULES, checkRegression: false }).failed).toBe(true);
    expect(diffReports(before, noLists, { ...DEFAULT_RULES, checkRegression: false, maxScoreDrop: 10 }).failed).toBe(false);
  });

  it("reports improvements and never fails on them", () => {
    const worse = report(GOOD.replace("<h1>Acme Widget Pro guide</h1>", ""));
    const result = diffReports(summarize(worse), good);
    expect(result.failed).toBe(false);
    expect(result.improvements.join(" ")).toContain("singleH1: fail -> pass");
  });

  it("fails on a rendered gap regression", () => {
    const before = summarize({ ...good, gap: { status: "pass", staticWordCount: 100, renderedWordCount: 100, wordRatio: 1, missingH1: false, missingSubheadings: [], detail: "" } });
    const after = { ...good, gap: { status: "fail" as const, staticWordCount: 10, renderedWordCount: 100, wordRatio: 0.1, missingH1: true, missingSubheadings: [], detail: "H1 only after JS" } };
    const result = diffReports(before, after);
    expect(result.regressions.find((r) => r.rule === "gapRegression")?.message).toContain("pass -> fail");
  });

  it("fails on fetch errors", () => {
    const result = diffReports(null, { ...good, fetchError: "Request timed out.", httpStatus: null });
    expect(result.failed).toBe(true);
    expect(result.regressions[0].rule).toBe("fetch");
  });
});

describe("badgeJson", () => {
  it("uses the lowest score and a colour band", () => {
    expect(badgeJson([92, 61])).toMatchObject({ message: "61/100", color: "yellow" });
    expect(badgeJson([])).toMatchObject({ message: "no data" });
  });
});
