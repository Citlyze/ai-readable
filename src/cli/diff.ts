import type { PageReport } from "../engine/audit";
import { RETRIEVAL_CATEGORIES } from "../engine/bots";
import { STATUS_RANK, type CheckId, type CheckStatus } from "../engine/checks";
import type { GapStatus } from "../engine/gap";

/** What a baseline remembers about a page. Lean on purpose: small diffs, stable across runs. */
export type PageSummary = {
  score: number;
  httpStatus: number | null;
  checks: Record<string, CheckStatus>;
  /** Names of search-index and assistant-fetch bots blocked for the path. */
  blockedRetrievalBots: string[];
  gap: GapStatus | null;
  fetchedAt: string;
};

export type DiffRules = {
  /** Fail when the score drops by more than this many points. */
  maxScoreDrop: number;
  /** Fail when any check moves from pass to warn or fail, or warn to fail. */
  checkRegression: boolean;
  /** Fail when a search or assistant bot that was allowed becomes blocked. */
  botBlocked: boolean;
  /** Fail when the static-vs-rendered gap gets worse. */
  gapRegression: boolean;
  /** Always fail when the page is not indexable (noindex or HTTP error). */
  indexable: boolean;
};

export type RuleOverrides = { [K in keyof DiffRules]?: DiffRules[K] };

export const DEFAULT_RULES: DiffRules = {
  maxScoreDrop: 5,
  checkRegression: true,
  botBlocked: true,
  gapRegression: true,
  indexable: true,
};

export type Regression = {
  rule: keyof DiffRules | "fetch";
  severity: "fail" | "warn";
  /** Check id or bot name the regression is about, for recipe links. */
  subject: string;
  message: string;
};

export type DiffResult = {
  url: string;
  before: PageSummary | null;
  after: PageSummary;
  regressions: Regression[];
  improvements: string[];
  /** true when at least one regression has severity "fail". */
  failed: boolean;
};

const GAP_RANK: Record<GapStatus, number> = { pass: 0, warn: 1, fail: 2 };

export function summarize(report: PageReport): PageSummary {
  const checks: Record<string, CheckStatus> = {};
  for (const check of report.checks) checks[check.id] = check.status;
  return {
    score: report.score,
    httpStatus: report.httpStatus,
    checks,
    blockedRetrievalBots: report.bots
      .filter((b) => RETRIEVAL_CATEGORIES.includes(b.category) && !b.allowed)
      .map((b) => b.name)
      .sort(),
    gap: report.gap?.status ?? null,
    fetchedAt: report.fetchedAt,
  };
}

function checkDetail(report: PageReport, id: string): string {
  return report.checks.find((c) => c.id === id)?.detail ?? "";
}

/**
 * Compare a fresh report against its baseline summary. Absolute rules
 * (indexable, fetch errors) apply with or without a baseline; everything
 * else is a regression only relative to the baseline.
 */
export function diffReports(
  before: PageSummary | null,
  report: PageReport,
  rules: DiffRules = DEFAULT_RULES,
): DiffResult {
  const after = summarize(report);
  const regressions: Regression[] = [];
  const improvements: string[] = [];

  if (report.fetchError) {
    regressions.push({
      rule: "fetch",
      severity: "fail",
      subject: "fetch",
      message: `Page could not be fetched: ${report.fetchError}`,
    });
    return { url: report.url, before, after, regressions, improvements, failed: true };
  }

  if (rules.indexable && after.checks.indexable === "fail") {
    regressions.push({
      rule: "indexable",
      severity: "fail",
      subject: "indexable",
      message: checkDetail(report, "indexable"),
    });
  }

  if (before) {
    const drop = before.score - after.score;
    if (drop > rules.maxScoreDrop) {
      regressions.push({
        rule: "maxScoreDrop",
        severity: "fail",
        subject: "score",
        message: `Score dropped from ${before.score} to ${after.score} (limit ${rules.maxScoreDrop} points).`,
      });
    } else if (drop < 0) {
      improvements.push(`Score rose from ${before.score} to ${after.score}.`);
    }

    for (const [id, status] of Object.entries(after.checks)) {
      const previous = before.checks[id];
      if (!previous || status === "info") continue;
      const worse = STATUS_RANK[status] > STATUS_RANK[previous];
      const better = STATUS_RANK[status] < STATUS_RANK[previous];
      if (worse && rules.checkRegression && id !== "indexable") {
        regressions.push({
          rule: "checkRegression",
          severity: "fail",
          subject: id,
          message: `${id}: ${previous} -> ${status}. ${checkDetail(report, id)}`,
        });
      } else if (better) {
        improvements.push(`${id}: ${previous} -> ${status}.`);
      }
    }

    const newlyBlocked = after.blockedRetrievalBots.filter((b) => !before.blockedRetrievalBots.includes(b));
    const unblocked = before.blockedRetrievalBots.filter((b) => !after.blockedRetrievalBots.includes(b));
    if (newlyBlocked.length && rules.botBlocked) {
      for (const name of newlyBlocked) {
        const row = report.bots.find((b) => b.name === name);
        regressions.push({
          rule: "botBlocked",
          severity: "fail",
          subject: name,
          message: `${name} is now blocked${row?.rule ? ` by "${row.rule}"${row.line ? ` (robots.txt line ${row.line})` : ""}` : ""}.`,
        });
      }
    }
    if (unblocked.length) improvements.push(`Unblocked: ${unblocked.join(", ")}.`);

    if (after.gap && before.gap) {
      if (GAP_RANK[after.gap] > GAP_RANK[before.gap] && rules.gapRegression) {
        regressions.push({
          rule: "gapRegression",
          severity: "fail",
          subject: "gap",
          message: `Rendered gap: ${before.gap} -> ${after.gap}. ${report.gap?.detail ?? ""}`,
        });
      } else if (GAP_RANK[after.gap] < GAP_RANK[before.gap]) {
        improvements.push(`Rendered gap: ${before.gap} -> ${after.gap}.`);
      }
    }
  } else {
    // No baseline yet: surface the absolute problems as warnings so the first
    // run is informative without failing on things nobody changed.
    for (const name of after.blockedRetrievalBots) {
      const row = report.bots.find((b) => b.name === name);
      regressions.push({
        rule: "botBlocked",
        severity: "warn",
        subject: name,
        message: `${name} is blocked${row?.rule ? ` by "${row.rule}"` : ""}.`,
      });
    }
    if (after.gap === "fail") {
      regressions.push({
        rule: "gapRegression",
        severity: "warn",
        subject: "gap",
        message: report.gap?.detail ?? "Most of the content only exists after JavaScript runs.",
      });
    }
  }

  return {
    url: report.url,
    before,
    after,
    regressions,
    improvements,
    failed: regressions.some((r) => r.severity === "fail"),
  };
}

export const RECIPE_FOR: { [K in CheckId | "gap" | "fetch" | "score"]?: string } = {
  crawlerAccess: "docs/recipes/robots.md",
  indexable: "docs/recipes/nextjs.md#noindex",
  singleH1: "docs/recipes/nextjs.md#headings",
  questionHeadings: "docs/recipes/nextjs.md#headings",
  answerBlocks: "docs/recipes/nextjs.md#answers",
  structuredData: "docs/recipes/nextjs.md#structured-data",
  extractableFormats: "docs/recipes/nextjs.md#formats",
  titleAndDescription: "docs/recipes/nextjs.md#metadata",
  gap: "docs/recipes/spa-export.md",
};
