#!/usr/bin/env node
/**
 * Regenerate the README and social assets from real tool output:
 *
 *   docs/assets/demo.svg           animated terminal: broken page -> fix -> green
 *   docs/assets/pricing-card.png   share card for the broken fixture pricing page
 *   docs/assets/social-preview.png 1280x640 image for the GitHub repository settings
 *   site/social-preview.png        same image, served by the landing page's og:image
 *
 * Run after `pnpm build`. Needs Playwright (render) and @resvg/resvg-js (PNG).
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Resvg } from "@resvg/resvg-js";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "dist", "cli.js");
const site = join(root, "site");

const TYPES = { ".html": "text/html", ".txt": "text/plain", ".js": "application/javascript", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const { statSync, readFileSync } = await import("node:fs");
  let file = join(site, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404, { "content-type": "text/html" });
    res.end("<title>Not found</title>");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const env = { ...process.env, NO_COLOR: "1" };

async function run(args) {
  const { stdout } = await exec(process.execPath, [cli, ...args], { env });
  return stdout;
}

// Real output, with the loopback host replaced by the public demo host.
const publicHost = "citlyze.github.io/ai-readable";
const clean = (text) => text.replaceAll(`${base}`, `https://${publicHost}`).replace(/\n\s*Track what AI actually says.*\n?/s, "\n");
const before = clean(await run([`${base}/fixture/pricing/`, "--render"]));
const after = clean(await run([`${base}/fixture/fixed/pricing/`, "--render"]));

await mkdir(join(root, "docs", "assets"), { recursive: true });
await run([`${base}/fixture/pricing/`, "--render", "--card", join(root, "docs", "assets", "pricing-card.png")]);

// ---- animated terminal SVG ------------------------------------------------
const MAX_COLS = 112;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fit = (s) => (s.length > MAX_COLS ? `${s.slice(0, MAX_COLS - 1)}…` : s);
const COLORS = { ok: "#4ade80", warn: "#facc15", fail: "#f87171", dim: "#94a3b8", fg: "#e5e7eb", cmd: "#e5e7eb", prompt: "#22c55e" };
const LINE_H = 22;
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

function tint(line) {
  const t = line.trimStart();
  if (t.startsWith("✓")) return COLORS.ok;
  if (t.startsWith("!")) return COLORS.warn;
  if (t.startsWith("✗")) return COLORS.fail;
  if (/^\d+\/100/.test(t)) return COLORS.fg;
  if (t.includes("blocked")) return COLORS.fail;
  return COLORS.dim;
}

/** Shorten the per-bot table so the frame stays readable. */
function condense(output) {
  const lines = output.split("\n");
  const cut = lines.findIndex((l) => l.includes("What each AI crawler gets"));
  const head = cut === -1 ? lines : lines.slice(0, cut);
  const bots = cut === -1 ? [] : lines.slice(cut + 1).filter((l) => /^\s{4}\S/.test(l)).slice(0, 4);
  const blocked = lines.filter((l) => /^\s{4}\S/.test(l) && l.includes("blocked"));
  const shown = [...new Set([...blocked, ...bots])].slice(0, 5);
  return [...head, "  What each AI crawler gets from this URL", ...shown, "    …"].filter((l, i, a) => !(l === "" && a[i - 1] === ""));
}

function frame(command, output, startAt, id) {
  const lines = [`$ ${command}`, ...condense(output)];
  let t = startAt;
  const texts = lines.map((line, i) => {
    const y = 48 + i * LINE_H;
    const delay = i === 0 ? 0 : 0.06;
    t += delay;
    const color = i === 0 ? COLORS.cmd : tint(line);
    return `<text x="24" y="${y}" fill="${color}" opacity="0" xml:space="preserve"><animate attributeName="opacity" to="1" dur="0.01s" begin="${t.toFixed(2)}s" fill="freeze"/>${esc(fit(line))}</text>`;
  });
  return { svg: `<g id="${id}">${texts.join("")}</g>`, lines: lines.length, end: t };
}

const f1 = frame("npx ai-readable citlyze.github.io/ai-readable/fixture/pricing --render", before, 0.4, "before");
const f2 = frame("npx ai-readable citlyze.github.io/ai-readable/fixture/pricing --render   # after the fix", after, f1.end + 3.2, "after");
const height = 48 + Math.max(f1.lines, f2.lines) * LINE_H + 24;
const width = 1040;
const fadeOut = `<animate attributeName="opacity" to="0" dur="0.3s" begin="${(f1.end + 2.8).toFixed(2)}s" fill="freeze"/>`;
const demo = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}" font-size="14" style="white-space: pre">
  <rect width="${width}" height="${height}" rx="12" fill="#0b1220"/>
  <circle cx="22" cy="20" r="6" fill="#f87171"/><circle cx="42" cy="20" r="6" fill="#facc15"/><circle cx="62" cy="20" r="6" fill="#4ade80"/>
  <text x="${width / 2}" y="24" text-anchor="middle" fill="#64748b" font-size="12">ai-readable</text>
  <g>${f1.svg.replace('<g id="before">', `<g id="before">${fadeOut}`)}</g>
  ${f2.svg}
</svg>
`;
await writeFile(join(root, "docs", "assets", "demo.svg"), demo);

// ---- social preview (1280x640) ---------------------------------------------
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" font-family="ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <rect width="1280" height="640" fill="#0b1220"/>
  <rect x="0" y="0" width="1280" height="6" fill="#22c55e"/>
  <text x="72" y="120" font-size="30" fill="#94a3b8">github.com/Citlyze/ai-readable</text>
  <text x="72" y="220" font-size="64" font-weight="800" fill="#f8fafc">See what each AI crawler</text>
  <text x="72" y="296" font-size="64" font-weight="800" fill="#f8fafc">actually gets from your pages</text>
  <text x="72" y="360" font-size="30" fill="#cbd5e1">Fail CI when a deploy makes a page unreadable to AI search.</text>
  <rect x="72" y="412" width="700" height="64" rx="12" fill="#111a2e" stroke="#1f2a44"/>
  <text x="96" y="454" font-size="28" fill="#e5e7eb" font-family="${FONT}">$ npx ai-readable example.com --render</text>
  <g font-size="22" font-weight="600">
    <rect x="72" y="516" width="250" height="46" rx="10" fill="#4ade8014" stroke="#4ade80"/><text x="90" y="546" fill="#4ade80">✓ OAI-SearchBot</text>
    <rect x="338" y="516" width="250" height="46" rx="10" fill="#f8717114" stroke="#f87171"/><text x="356" y="546" fill="#f87171">✗ PerplexityBot</text>
    <rect x="604" y="516" width="250" height="46" rx="10" fill="#4ade8014" stroke="#4ade80"/><text x="622" y="546" fill="#4ade80">✓ Claude-SearchBot</text>
    <rect x="870" y="516" width="250" height="46" rx="10" fill="#facc1514" stroke="#facc15"/><text x="888" y="546" fill="#facc15">! 14 words in HTML</text>
  </g>
  <text x="1208" y="120" font-size="26" fill="#64748b" text-anchor="end">MIT · CLI · GitHub Action · Agent Skill</text>
</svg>`;
const png = new Resvg(social, { fitTo: { mode: "width", value: 1280 } }).render().asPng();
await writeFile(join(root, "docs", "assets", "social-preview.png"), png);
await writeFile(join(site, "social-preview.png"), png);

server.close();
process.stderr.write(`demo.svg (${f1.lines}+${f2.lines} lines), pricing-card.png, social-preview.png written\n`);
