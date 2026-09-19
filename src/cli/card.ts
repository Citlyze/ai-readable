import { writeFile } from "node:fs/promises";
import type { PageReport } from "../engine/audit";
import { RETRIEVAL_CATEGORIES } from "../engine/bots";

const WIDTH = 1200;
const HEIGHT = 630;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function tone(ok: boolean, mid = false): string {
  if (ok) return "#16a34a";
  return mid ? "#d97706" : "#dc2626";
}

/**
 * A factual share card. The headline is the rendered gap when it was
 * measured, otherwise the score. Below it, the search and assistant bots
 * with their verdicts. No claims about being cited.
 */
export function renderCardSvg(report: PageReport): string {
  const url = report.finalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const gap = report.gap;

  let headline: string;
  let sub: string;
  let headTone: string;
  if (report.fetchError) {
    headline = "Could not be fetched";
    sub = report.fetchError;
    headTone = tone(false);
  } else if (gap) {
    headline = `${gap.staticWordCount} words in the HTML AI crawlers get`;
    sub = `${gap.renderedWordCount} words after JavaScript · ${Math.round(gap.wordRatio * 100)}% reaches crawlers that skip JS`;
    headTone = tone(gap.status === "pass", gap.status === "warn");
  } else {
    headline = `${report.score}/100 AI readability`;
    const failing = report.checks.filter((c) => c.status === "fail").map((c) => c.label);
    sub = failing.length ? `Failing: ${failing.join(", ")}` : `${report.facts.wordCount} words in the initial HTML, no failing checks`;
    headTone = tone(report.score >= 75, report.score >= 50);
  }

  const bots = report.bots.filter((b) => RETRIEVAL_CATEGORIES.includes(b.category)).slice(0, 12);
  const chipW = 262;
  const chipH = 44;
  const perRow = 4;
  const chips = bots
    .map((bot, i) => {
      const x = 60 + (i % perRow) * (chipW + 16);
      const y = 330 + Math.floor(i / perRow) * (chipH + 12);
      const color = tone(bot.allowed);
      const label = `${bot.allowed ? "✓" : "✗"} ${bot.name}`;
      return `<g><rect x="${x}" y="${y}" width="${chipW}" height="${chipH}" rx="10" fill="${color}14" stroke="${color}" stroke-width="1.5"/><text x="${x + 14}" y="${y + 28}" font-size="19" font-weight="600" fill="${color}">${esc(clip(label, 24))}</text></g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0b1220"/>
  <rect x="0" y="0" width="${WIDTH}" height="6" fill="${headTone}"/>
  <text x="60" y="92" font-size="26" fill="#94a3b8">${esc(clip(url, 70))}</text>
  <text x="60" y="180" font-size="58" font-weight="800" fill="#f8fafc">${esc(clip(headline, 36))}</text>
  <text x="60" y="232" font-size="26" fill="#cbd5e1">${esc(clip(sub, 78))}</text>
  <text x="60" y="300" font-size="20" font-weight="600" fill="#94a3b8" letter-spacing="1">SEARCH &amp; ASSISTANT BOTS · ROBOTS.TXT FOR THIS PATH</text>
  ${chips}
  <text x="60" y="590" font-size="20" fill="#64748b">npx ai-readable ${esc(clip(url, 50))}</text>
  <text x="${WIDTH - 60}" y="590" font-size="20" fill="#64748b" text-anchor="end">github.com/Citlyze/ai-readable</text>
</svg>
`;
}

export async function writeCard(report: PageReport, file: string): Promise<string> {
  const svg = renderCardSvg(report);
  if (file.toLowerCase().endsWith(".png")) {
    let Resvg: (typeof import("@resvg/resvg-js"))["Resvg"];
    try {
      ({ Resvg } = await import("@resvg/resvg-js"));
    } catch {
      throw new Error("PNG cards need @resvg/resvg-js: npm i -D @resvg/resvg-js. Or write an .svg file instead.");
    }
    const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
    await writeFile(file, png);
    return file;
  }
  await writeFile(file, svg);
  return file;
}
