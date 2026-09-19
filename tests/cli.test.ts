import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveDir, type FixtureServer } from "./helpers/server";

const exec = promisify(execFile);
const ROOT = join(__dirname, "..");
const TSX = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const CLI = join(ROOT, "src", "cli.ts");

type Run = { code: number; stdout: string; stderr: string };

async function cli(args: string[], cwd: string, env: Record<string, string> = {}): Promise<Run> {
  try {
    const { stdout, stderr } = await exec(process.execPath, [TSX, CLI, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1", GITHUB_ACTIONS: "", ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

let server: FixtureServer;
let broken: FixtureServer;
let work: string;
let fixtureCopy: string;

beforeAll(async () => {
  server = await serveDir(join(ROOT, "fixture-site"), {
    headers: { "/blocked/": { "x-robots-tag": "index" } },
  });
  work = await mkdtemp(join(tmpdir(), "ai-readable-"));
  // A second copy of the site whose robots.txt we can break between runs.
  fixtureCopy = await mkdtemp(join(tmpdir(), "ai-readable-site-"));
  await cp(join(ROOT, "fixture-site"), fixtureCopy, { recursive: true });
  broken = await serveDir(fixtureCopy);
}, 30000);

afterAll(async () => {
  await server?.close();
  await broken?.close();
  await rm(work, { recursive: true, force: true });
  await rm(fixtureCopy, { recursive: true, force: true });
});

describe("ai-readable check", () => {
  it("prints a scored report for the good page and exits 0", async () => {
    const run = await cli([`${server.url}/`], work);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("100/100");
    expect(run.stdout).toContain("OAI-SearchBot");
    expect(run.stdout).toContain("citlyze.com");
  }, 20000);

  it("emits JSON with the per-bot verdicts and quotes the blocking rule", async () => {
    const run = await cli([`${server.url}/blocked/`, "--json"], work);
    expect(run.code).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report.schemaVersion).toBe(1);
    const oai = report.bots.find((b: { name: string }) => b.name === "OAI-SearchBot");
    expect(oai.allowed).toBe(false);
    expect(oai.rule).toBe("Disallow: /blocked/");
    expect(report.checks.find((c: { id: string }) => c.id === "crawlerAccess").status).toBe("fail");
    const gpt = report.bots.find((b: { name: string }) => b.name === "GPTBot");
    expect(gpt.allowed).toBe(false);
  }, 20000);

  it("writes an SVG share card", async () => {
    const card = join(work, "card.svg");
    const run = await cli([`${server.url}/pricing/`, "--card", card], work);
    expect(run.code).toBe(0);
    const svg = await readFile(card, "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("AI readability");
  }, 20000);

  it("measures the rendered gap with --render", async () => {
    const run = await cli([`${server.url}/pricing/`, "--render", "--json"], work);
    expect(run.code).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report.renderError).toBeNull();
    expect(report.gap.status).toBe("fail");
    expect(report.gap.missingH1).toBe(true);
    expect(report.gap.renderedWordCount).toBeGreaterThan(report.gap.staticWordCount * 10);
  }, 60000);

  it("reports a fetch failure without crashing", async () => {
    const run = await cli(["http://127.0.0.1:1/"], work);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("Could not fetch");
  }, 20000);
});

describe("ai-readable ci", () => {
  it("creates a baseline and badge, then fails when robots.txt starts blocking a search bot", async () => {
    await writeFile(
      join(work, "ai-readable.config.json"),
      JSON.stringify({ paths: ["/", "/blocked/"], render: false }),
    );

    const first = await cli(["ci", "--base-url", broken.url, "--update-baseline"], work);
    expect(first.code).toBe(0);
    expect(first.stderr).toContain("no regressions");
    const baseline = JSON.parse(await readFile(join(work, ".ai-readable", "baseline.json"), "utf8"));
    expect(Object.keys(baseline.pages).sort()).toEqual(["/", "/blocked/"]);
    expect(baseline.pages["/"].score).toBe(100);
    const badge = JSON.parse(await readFile(join(work, ".ai-readable", "badge.json"), "utf8"));
    expect(badge.label).toBe("ai-readable");

    // Break the home page for PerplexityBot.
    await writeFile(join(fixtureCopy, "robots.txt"), "User-agent: PerplexityBot\nDisallow: /\n");
    const second = await cli(["ci", "--base-url", broken.url], work);
    expect(second.code).toBe(1);
    expect(second.stdout).toContain("PerplexityBot is now blocked");
    expect(second.stderr).toContain("regression detected");

    // --fail-on never keeps the exit code green.
    const third = await cli(["ci", "--base-url", broken.url, "--fail-on", "never"], work);
    expect(third.code).toBe(0);
  }, 60000);

  it("fails a noindex page even on the first run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ai-readable-noindex-"));
    const run = await cli(["ci", "--paths", `${server.url}/noindex/`, "--no-render"], dir);
    expect(run.code).toBe(1);
    expect(run.stdout).toContain("noindex");
    await rm(dir, { recursive: true, force: true });
  }, 20000);

  it("explains when there is no config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ai-readable-empty-"));
    const run = await cli(["ci"], dir);
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("ai-readable init");
    await rm(dir, { recursive: true, force: true });
  }, 20000);
});

describe("ai-readable init and bots", () => {
  it("writes a config and a workflow", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ai-readable-init-"));
    const run = await cli(["init", "--base-url", "https://example.com"], dir);
    expect(run.code).toBe(0);
    const config = JSON.parse(await readFile(join(dir, "ai-readable.config.json"), "utf8"));
    expect(config.baseUrl).toBe("https://example.com");
    const workflow = await readFile(join(dir, ".github", "workflows", "ai-readable.yml"), "utf8");
    expect(workflow).toContain("Citlyze/ai-readable@v1");
    await rm(dir, { recursive: true, force: true });
  }, 20000);

  it("lists bots by category", async () => {
    const run = await cli(["bots"], work);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("Search index");
    expect(run.stdout).toContain("Claude-SearchBot");
  }, 20000);
});
