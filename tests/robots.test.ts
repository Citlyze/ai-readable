import { describe, expect, it } from "vitest";
import { BOTS } from "../src/engine/bots";
import { evaluateBots, sitemapsIn } from "../src/engine/robots";

const ROBOTS = `User-agent: *
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: oai-searchbot
Disallow: /pricing
Allow: /pricing/public

User-agent: PerplexityBot
User-agent: Perplexity-User
Disallow: /private/

Sitemap: https://example.com/sitemap.xml
`;

const byName = (rows: ReturnType<typeof evaluateBots>, name: string) => {
  const row = rows.find((r) => r.bot.name === name);
  if (!row) throw new Error(`${name} missing`);
  return row;
};

describe("evaluateBots", () => {
  it("treats a missing robots.txt as allowed for everyone", () => {
    const rows = evaluateBots(null, "https://example.com/pricing");
    expect(rows).toHaveLength(BOTS.length);
    expect(rows.every((r) => r.allowed && r.source === "missing")).toBe(true);
  });

  it("blocks a training bot on a site-wide disallow and quotes the line", () => {
    const rows = evaluateBots(ROBOTS, "https://example.com/pricing");
    const gpt = byName(rows, "GPTBot");
    expect(gpt.allowed).toBe(false);
    expect(gpt.rule).toBe("Disallow: /");
    expect(gpt.line).toBe(5);
  });

  it("matches user-agent tokens case-insensitively and honours the longest matching rule", () => {
    const blocked = byName(evaluateBots(ROBOTS, "https://example.com/pricing"), "OAI-SearchBot");
    expect(blocked.allowed).toBe(false);
    expect(blocked.rule).toBe("Disallow: /pricing");

    const allowed = byName(evaluateBots(ROBOTS, "https://example.com/pricing/public"), "OAI-SearchBot");
    expect(allowed.allowed).toBe(true);
    expect(allowed.rule).toBe("Allow: /pricing/public");
  });

  it("applies a shared group to every agent listed in it", () => {
    const rows = evaluateBots(ROBOTS, "https://example.com/private/x");
    expect(byName(rows, "PerplexityBot").allowed).toBe(false);
    expect(byName(rows, "Perplexity-User").allowed).toBe(false);
    expect(byName(rows, "ClaudeBot").allowed).toBe(true);
  });

  it("falls back to the wildcard group for bots without a specific group", () => {
    const claude = byName(evaluateBots(ROBOTS, "https://example.com/anything"), "Claude-SearchBot");
    expect(claude.allowed).toBe(true);
    expect(claude.source).toBe("rule");
    expect(claude.rule).toBe("Allow: /");
  });

  it("lists sitemaps", () => {
    expect(sitemapsIn(ROBOTS, "https://example.com/")).toEqual(["https://example.com/sitemap.xml"]);
    expect(sitemapsIn(null, "https://example.com/")).toEqual([]);
  });
});

describe("bot registry", () => {
  it("has unique ids and tokens with a docs link each", () => {
    const ids = new Set(BOTS.map((b) => b.id));
    expect(ids.size).toBe(BOTS.length);
    const tokens = BOTS.flatMap((b) => b.tokens);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const bot of BOTS) expect(bot.docs).toMatch(/^https:\/\//);
  });
});

describe("skill copies", () => {
  it("keeps skills/ai-readable/SKILL.md identical to the root SKILL.md", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const root = await readFile(join(__dirname, "..", "SKILL.md"), "utf8");
    const copy = await readFile(join(__dirname, "..", "skills", "ai-readable", "SKILL.md"), "utf8");
    expect(copy).toBe(root);
  });
});
