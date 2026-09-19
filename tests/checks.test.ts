import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isQuestion, runChecks, type ChecksInput } from "../src/engine/checks";
import { extractPageFacts } from "../src/engine/extract";
import { evaluateBots } from "../src/engine/robots";

const site = (file: string) => readFileSync(join(__dirname, "..", "site", "fixture", file), "utf8");

function input(html: string, overrides: { [K in keyof ChecksInput]?: ChecksInput[K] } = {}): ChecksInput {
  return {
    facts: extractPageFacts(html),
    bots: evaluateBots("User-agent: *\nAllow: /\n", "https://example.com/"),
    httpStatus: 200,
    xRobotsTag: null,
    robotsTxtFound: true,
    llmsTxt: null,
    ...overrides,
  };
}

const byId = (result: ReturnType<typeof runChecks>, id: string) => {
  const check = result.checks.find((c) => c.id === id);
  if (!check) throw new Error(id);
  return check;
};

describe("runChecks", () => {
  it("scores the good fixture page 100 and every scored check passes", () => {
    const result = runChecks(input(site("index.html")));
    expect(result.score).toBe(100);
    expect(result.checks.filter((c) => c.max > 0).every((c) => c.status === "pass")).toBe(true);
    expect(byId(result, "llmsTxt").status).toBe("info");
  });

  it("weights sum to 100", () => {
    const result = runChecks(input(site("index.html")));
    expect(result.checks.reduce((n, c) => n + c.max, 0)).toBe(100);
  });

  it("fails crawler access only when a search or assistant bot is blocked", () => {
    const trainingOnly = evaluateBots("User-agent: GPTBot\nDisallow: /\n", "https://example.com/");
    expect(byId(runChecks(input(site("index.html"), { bots: trainingOnly })), "crawlerAccess").status).toBe("pass");

    const search = evaluateBots("User-agent: OAI-SearchBot\nDisallow: /\n", "https://example.com/");
    const check = byId(runChecks(input(site("index.html"), { bots: search })), "crawlerAccess");
    expect(check.status).toBe("fail");
    expect(check.points).toBe(0);
    expect(check.detail).toContain("OAI-SearchBot");
  });

  it("fails indexable on meta noindex, X-Robots-Tag and error statuses", () => {
    expect(byId(runChecks(input(site("noindex/index.html"))), "indexable").status).toBe("fail");
    expect(byId(runChecks(input(site("index.html"), { xRobotsTag: "noindex, nofollow" })), "indexable").status).toBe("fail");
    const notFound = runChecks(input(site("index.html"), { httpStatus: 404 }));
    expect(byId(notFound, "indexable").detail).toContain("HTTP 404");
    expect(notFound.score).toBe(0);
    expect(byId(runChecks(input(site("index.html"), { httpStatus: null })), "indexable").status).toBe("pass");
  });

  it("scores the client-rendered pricing shell low with a missing H1", () => {
    const result = runChecks(input(site("pricing/index.html")));
    expect(byId(result, "singleH1").status).toBe("fail");
    expect(byId(result, "answerBlocks").status).toBe("fail");
    expect(byId(result, "questionHeadings").status).toBe("fail");
    expect(result.score).toBeLessThan(50);
  });

  it("gives half credit for multiple H1s and one question heading", () => {
    const html = `<title>A long enough title for this</title><meta name="description" content="${"d".repeat(60)}"><h1>One two three</h1><h1>Four five six</h1><h2>How does it work?</h2><p>${"w ".repeat(30)}</p>`;
    const result = runChecks(input(html));
    expect(byId(result, "singleH1")).toMatchObject({ status: "warn", points: 5 });
    expect(byId(result, "questionHeadings")).toMatchObject({ status: "warn", points: 6 });
    expect(byId(result, "answerBlocks")).toMatchObject({ status: "warn", points: 7 });
  });

  it("does not credit FAQPage as entity markup", () => {
    const html = `<script type="application/ld+json">{"@type":"FAQPage"}</script><h1>x</h1>`;
    const check = byId(runChecks(input(html)), "structuredData");
    expect(check.status).toBe("warn");
    expect(check.detail).toContain("faqpage");
  });

  it("reports llms.txt without scoring it", () => {
    const withFile = byId(runChecks(input(site("index.html"), { llmsTxt: "# Acme\n" })), "llmsTxt");
    expect(withFile.detail).toContain("found");
    expect(withFile.max).toBe(0);
    const html404 = byId(runChecks(input(site("index.html"), { llmsTxt: "<html>404</html>" })), "llmsTxt");
    expect(html404.detail).toContain("No llms.txt");
  });
});

describe("isQuestion", () => {
  it("accepts trailing question marks and question starters", () => {
    expect(isQuestion("How much does it cost?")).toBe(true);
    expect(isQuestion("Why teams switch")).toBe(true);
    expect(isQuestion("Pricing")).toBe(false);
    expect(isQuestion("")).toBe(false);
  });
});
