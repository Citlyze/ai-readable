import pc from "picocolors";
import type { BotRow, PageReport } from "../engine/audit";
import { CATEGORY_INFO, type BotCategory } from "../engine/bots";
import type { CheckStatus } from "../engine/checks";
import type { DiffResult } from "./diff";
import { RECIPE_FOR } from "./diff";

export const FOOTER = "Track what AI actually says about you, not just whether it can read you: https://www.citlyze.com";

const GLYPH: Record<CheckStatus, string> = { pass: "✓", warn: "!", fail: "✗", info: "·" };

function paint(status: CheckStatus | "blocked" | "allowed", text: string): string {
  switch (status) {
    case "pass":
    case "allowed":
      return pc.green(text);
    case "warn":
      return pc.yellow(text);
    case "fail":
    case "blocked":
      return pc.red(text);
    default:
      return pc.dim(text);
  }
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function scoreColor(score: number): (s: string) => string {
  if (score >= 75) return pc.green;
  if (score >= 50) return pc.yellow;
  return pc.red;
}

function groupBots(bots: BotRow[]): [BotCategory, BotRow[]][] {
  const order = (Object.keys(CATEGORY_INFO) as BotCategory[]).sort(
    (a, b) => CATEGORY_INFO[a].order - CATEGORY_INFO[b].order,
  );
  return order.map((category) => [category, bots.filter((b) => b.category === category)]);
}

export function renderTerminal(report: PageReport, options: { bots?: "all" | "retrieval" } = {}): string {
  const lines: string[] = [];
  lines.push(pc.bold(report.finalUrl));
  if (report.fetchError) {
    lines.push(paint("fail", `  Could not fetch the page: ${report.fetchError}`));
    return lines.join("\n");
  }
  lines.push(
    `  ${pc.bold(scoreColor(report.score)(`${report.score}/100`))} ${pc.dim(
      `AI readability · HTTP ${report.httpStatus} · ${report.facts.wordCount} word${report.facts.wordCount === 1 ? "" : "s"} in the initial HTML`,
    )}`,
  );
  lines.push("");

  for (const check of report.checks) {
    const points = check.max ? pc.dim(pad(`${check.points}/${check.max}`, 6)) : pc.dim(pad("", 6));
    lines.push(`  ${paint(check.status, GLYPH[check.status])} ${points} ${pad(check.label, 28)} ${pc.dim(check.detail)}`);
  }

  if (report.gap) {
    lines.push("");
    const g = report.gap;
    lines.push(
      `  ${paint(g.status, GLYPH[g.status])} ${pc.dim(pad("", 6))} ${pad("Initial HTML vs rendered", 28)} ${pc.dim(g.detail)}`,
    );
  } else if (report.renderError) {
    lines.push("");
    lines.push(`  ${pc.dim("·")} ${pc.dim(pad("", 6))} ${pad("Initial HTML vs rendered", 28)} ${pc.dim(report.renderError)}`);
  }

  lines.push("");
  lines.push(pc.bold("  What each AI crawler gets from this URL"));
  const show = options.bots ?? "retrieval";
  for (const [category, bots] of groupBots(report.bots)) {
    if (show === "retrieval" && category === "training") {
      const blocked = bots.filter((b) => !b.allowed).length;
      lines.push(
        pc.dim(`  ${CATEGORY_INFO[category].label}: ${bots.length - blocked} of ${bots.length} allowed. ${CATEGORY_INFO[category].consequence} Show with --bots all.`),
      );
      continue;
    }
    lines.push(`  ${pc.underline(CATEGORY_INFO[category].label)} ${pc.dim(`· ${CATEGORY_INFO[category].consequence}`)}`);
    for (const bot of bots) {
      const verdict = bot.allowed ? paint("allowed", "allowed") : paint("blocked", "blocked");
      const evidence = bot.allowed
        ? bot.rule
          ? pc.dim(`matched "${bot.rule}"`)
          : ""
        : pc.dim(`"${bot.rule}"${bot.line ? ` at robots.txt:${bot.line}` : ""}`);
      lines.push(`    ${pad(bot.name, 22)} ${pad(bot.organization, 12)} ${pad(verdict, 17)} ${evidence}`);
    }
  }
  if (!report.robotsTxt.found) lines.push(pc.dim("  No robots.txt, so every crawler is allowed by default."));

  lines.push("");
  lines.push(pc.dim(`  ${FOOTER}`));
  return lines.join("\n");
}

function mdStatus(status: CheckStatus | "blocked" | "allowed"): string {
  switch (status) {
    case "pass":
      return "✅";
    case "warn":
      return "⚠️";
    case "fail":
      return "❌";
    case "allowed":
      return "✅ allowed";
    case "blocked":
      return "❌ blocked";
    default:
      return "ℹ️";
  }
}

export function renderMarkdown(report: PageReport, options: { bots?: "all" | "retrieval" } = {}): string {
  const lines: string[] = [];
  lines.push(`## ${report.finalUrl}`);
  if (report.fetchError) {
    lines.push("", `❌ Could not fetch the page: ${report.fetchError}`);
    return lines.join("\n");
  }
  lines.push("", `**${report.score}/100** AI readability · HTTP ${report.httpStatus} · ${report.facts.wordCount} word${report.facts.wordCount === 1 ? "" : "s"} in the initial HTML`, "");
  lines.push("| | Check | Points | Evidence |", "|---|---|---:|---|");
  for (const check of report.checks) {
    lines.push(`| ${mdStatus(check.status)} | ${check.label} | ${check.max ? `${check.points}/${check.max}` : ""} | ${check.detail.replace(/\|/g, "\\|")} |`);
  }
  if (report.gap) {
    lines.push(`| ${mdStatus(report.gap.status)} | Initial HTML vs rendered | | ${report.gap.detail} |`);
  }
  lines.push("", "### What each AI crawler gets", "");
  lines.push("| Bot | Org | Category | Access | robots.txt rule |", "|---|---|---|---|---|");
  const show = options.bots ?? "retrieval";
  for (const bot of report.bots) {
    if (show === "retrieval" && bot.category === "training") continue;
    lines.push(
      `| ${bot.name} | ${bot.organization} | ${CATEGORY_INFO[bot.category].label} | ${mdStatus(bot.allowed ? "allowed" : "blocked")} | ${
        bot.rule ? `\`${bot.rule}\`${bot.line ? ` (line ${bot.line})` : ""}` : ""
      } |`,
    );
  }
  if (show === "retrieval") {
    const training = report.bots.filter((b) => b.category === "training");
    lines.push("", `Training bots: ${training.filter((b) => b.allowed).length} of ${training.length} allowed. ${CATEGORY_INFO.training.consequence}`);
  }
  return lines.join("\n");
}

export function renderDiffTerminal(result: DiffResult, report: PageReport): string {
  const lines: string[] = [];
  const label = result.before ? `${result.before.score} -> ${result.after.score}` : `${result.after.score} (no baseline yet)`;
  const tone = result.failed ? pc.red : result.regressions.length ? pc.yellow : pc.green;
  lines.push(`${tone(result.failed ? "✗" : result.regressions.length ? "!" : "✓")} ${pc.bold(report.finalUrl)} ${pc.dim(label)}`);
  for (const r of result.regressions) {
    lines.push(`    ${r.severity === "fail" ? pc.red("fail") : pc.yellow("warn")} ${r.message}`);
  }
  for (const i of result.improvements) lines.push(`    ${pc.green("better")} ${i}`);
  return lines.join("\n");
}

const MARKER = "<!-- ai-readable -->";

export function renderDiffMarkdown(
  results: { result: DiffResult; report: PageReport }[],
  options: { repoUrl?: string; runUrl?: string } = {},
): string {
  const failed = results.filter((r) => r.result.failed).length;
  const lines: string[] = [MARKER];
  lines.push(
    failed
      ? `### ❌ ai-readable: ${failed} page${failed === 1 ? "" : "s"} regressed`
      : `### ✅ ai-readable: no AI readability regressions`,
  );
  lines.push("", "| Page | Score | Search & assistant bots | Rendered gap | Result |", "|---|---:|---|---|---|");
  for (const { result, report } of results) {
    const score = result.before ? `${result.before.score} → ${result.after.score}` : `${result.after.score}`;
    const blocked = result.after.blockedRetrievalBots.length
      ? `❌ ${result.after.blockedRetrievalBots.join(", ")}`
      : "✅ all allowed";
    const gap = report.gap ? `${mdStatus(report.gap.status)} ${Math.round(report.gap.wordRatio * 100)}% in HTML` : "not run";
    const outcome = result.failed ? "❌ regressed" : result.regressions.length ? "⚠️ warnings" : "✅ ok";
    lines.push(`| [${result.url.replace(/^https?:\/\//, "")}](${report.finalUrl}) | ${score} | ${blocked} | ${gap} | ${outcome} |`);
  }
  const details = results.filter((r) => r.result.regressions.length || r.result.improvements.length);
  if (details.length) {
    lines.push("");
    for (const { result } of details) {
      lines.push(`<details><summary>${result.url}</summary>`, "");
      for (const r of result.regressions) {
        const recipe = RECIPE_FOR[r.subject as keyof typeof RECIPE_FOR] ?? (r.rule === "botBlocked" ? RECIPE_FOR.crawlerAccess : undefined);
        const link = recipe && options.repoUrl ? ` ([how to fix](${options.repoUrl}/blob/main/${recipe}))` : "";
        lines.push(`- ${r.severity === "fail" ? "❌" : "⚠️"} ${r.message}${link}`);
      }
      for (const i of result.improvements) lines.push(`- ✅ ${i}`);
      lines.push("", "</details>");
    }
  }
  lines.push("");
  lines.push(
    `<sub>Checked with [ai-readable](${options.repoUrl ?? "https://github.com/Citlyze/ai-readable"})${
      options.runUrl ? ` · [run](${options.runUrl})` : ""
    }. Robots rules and initial-HTML content only; no bot user agents are spoofed.</sub>`,
  );
  return lines.join("\n");
}

export { MARKER as COMMENT_MARKER };
