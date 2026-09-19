import pc from "picocolors";
import { auditUrl, type PageReport } from "../engine/audit";
import { BASELINE_FILE, readBaseline, writeBadge, writeBaseline } from "./baseline";
import { parseHeaderFlags, readConfig, resolveRules, resolveTargets, type Config } from "./config";
import { diffReports, summarize, type DiffResult, type PageSummary } from "./diff";
import { renderDiffMarkdown, renderDiffTerminal } from "./format";
import { annotate, appendStepSummary, githubContext, setOutput, upsertPrComment } from "./github";

export type CiFlags = {
  baseUrl?: string;
  paths?: string[];
  render?: boolean;
  header?: string[];
  updateBaseline?: boolean;
  failOn?: "regression" | "never";
  json?: boolean;
  comment?: boolean;
  config?: string;
  version: string;
};

export type CiOutcome = {
  results: { result: DiffResult; report: PageReport }[];
  failed: boolean;
  baselineWritten: boolean;
};

export async function runCi(flags: CiFlags): Promise<CiOutcome> {
  const config: Config | null = await readConfig(flags.config);
  if (!config && !flags.paths?.length) {
    throw new Error(
      "No ai-readable.config.json found and no --paths given. Run `npx ai-readable init` to create one.",
    );
  }
  const paths = flags.paths?.length ? flags.paths : config?.paths ?? [];
  const baseUrl = flags.baseUrl ?? config?.baseUrl;
  const render = flags.render ?? config?.render ?? true;
  const headers = { ...(config?.headers ?? {}), ...parseHeaderFlags(flags.header) };
  const rules = resolveRules(config?.rules);
  const targets = resolveTargets(paths, baseUrl);

  const baseline = await readBaseline();
  const results: { result: DiffResult; report: PageReport }[] = [];
  // Only the configured targets: pages removed from the config leave the baseline and the badge.
  const nextPages: Record<string, PageSummary> = {};

  for (const target of targets) {
    if (!flags.json) process.stderr.write(pc.dim(`checking ${target.url}${render ? " (with render)" : ""}…\n`));
    const report = await auditUrl(target.url, { render, headers, timeoutMs: config?.timeoutMs, version: flags.version });
    const before = baseline?.pages[target.key] ?? null;
    const result = diffReports(before, report, rules);
    result.url = target.key;
    results.push({ result, report });
    if (!flags.json) process.stdout.write(`${renderDiffTerminal(result, report)}\n`);
    if (report.renderError && render && !flags.json) process.stderr.write(pc.yellow(`  render skipped: ${report.renderError}\n`));
    if (!report.fetchError) nextPages[target.key] = summarize(report);
    else if (baseline?.pages[target.key]) nextPages[target.key] = baseline.pages[target.key];
    if (report.renderError && render) await annotate("warning", `${target.key}: rendered comparison skipped: ${report.renderError}`);
  }

  const failed = flags.failOn === "never" ? false : results.some((r) => r.result.failed);

  const ctx = await githubContext();
  const repoUrl = "https://github.com/Citlyze/ai-readable";
  const markdown = renderDiffMarkdown(results, { repoUrl, runUrl: ctx?.runUrl ?? undefined });

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ failed, results: results.map((r) => ({ ...r.result, report: r.report })) }, null, 2)}\n`);
  }

  if (ctx) {
    for (const { result } of results) {
      for (const r of result.regressions) {
        await annotate(r.severity === "fail" ? "error" : "warning", `${result.url}: ${r.message}`);
      }
    }
    await appendStepSummary(markdown);
    const scores = results.filter((r) => !r.report.fetchError).map((r) => r.report.score);
    await setOutput("failed", failed ? "true" : "false");
    await setOutput("score", scores.length ? Math.min(...scores) : 0);
    await setOutput("regressions", results.reduce((n, r) => n + r.result.regressions.filter((x) => x.severity === "fail").length, 0));
    if (flags.comment !== false) {
      try {
        const outcome = await upsertPrComment(ctx, markdown);
        if (outcome !== "skipped" && !flags.json) process.stderr.write(pc.dim(`PR comment ${outcome}\n`));
      } catch (error) {
        await annotate("warning", `Could not post the PR comment: ${(error as Error).message}`);
      }
    }
  }

  let baselineWritten = false;
  if (flags.updateBaseline) {
    await writeBaseline(nextPages);
    await writeBadge(Object.values(nextPages).map((p) => p.score));
    baselineWritten = true;
    if (!flags.json) process.stderr.write(pc.dim(`baseline written to ${BASELINE_FILE}\n`));
  } else if (!baseline && !flags.json) {
    process.stderr.write(
      pc.yellow(`no baseline at ${BASELINE_FILE}; only absolute rules applied. Run with --update-baseline on your main branch to create one.\n`),
    );
  }

  return { results, failed, baselineWritten };
}
