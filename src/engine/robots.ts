import robotsParser from "robots-parser";
import { BOTS, type Bot } from "./bots";

export type BotVerdict = {
  bot: Bot;
  /** false when any documented token of the bot is disallowed for the URL. */
  allowed: boolean;
  /** Token that produced the verdict (the blocked one when blocked). */
  token: string;
  /** The robots.txt line that decided it, when one did. */
  rule: string | null;
  /** 1-based line number of that rule in robots.txt. */
  line: number | null;
  /** Why the verdict came out this way. */
  source: "missing" | "no-rule" | "rule";
};

type Parsed = ReturnType<typeof robotsParser>;

function lineText(robotsTxt: string, line: number): string | null {
  if (line < 1) return null;
  const text = robotsTxt.split(/\r?\n/)[line - 1];
  return text === undefined ? null : text.trim();
}

/**
 * Evaluate one token against a parsed robots.txt. `isAllowed` answers with
 * `undefined` when the URL's origin does not match the robots.txt origin; we
 * treat that as allowed, because the file simply does not apply.
 */
function verdictFor(
  parsed: Parsed | null,
  robotsTxt: string | null,
  url: string,
  token: string,
): Omit<BotVerdict, "bot"> {
  if (!parsed || robotsTxt === null) {
    return { allowed: true, token, rule: null, line: null, source: "missing" };
  }
  const allowed = parsed.isAllowed(url, token);
  const line = parsed.getMatchingLineNumber(url, token);
  const rule = typeof line === "number" && line > 0 ? lineText(robotsTxt, line) : null;
  if (allowed === undefined || allowed === true) {
    return {
      allowed: true,
      token,
      rule,
      line: rule ? line : null,
      source: rule ? "rule" : "no-rule",
    };
  }
  return { allowed: false, token, rule, line: rule ? line : null, source: "rule" };
}

/**
 * Verdict for every documented bot on one URL. A bot counts as blocked when
 * ANY of its documented tokens is disallowed; the blocking token and rule are
 * surfaced so the report can quote the line.
 */
export function evaluateBots(
  robotsTxt: string | null,
  url: string,
  bots: Bot[] = BOTS,
): BotVerdict[] {
  const origin = new URL(url).origin;
  const parsed = robotsTxt === null ? null : robotsParser(`${origin}/robots.txt`, robotsTxt);

  return bots.map((bot) => {
    const verdicts = bot.tokens.map((token) => verdictFor(parsed, robotsTxt, url, token));
    const blocked = verdicts.find((v) => !v.allowed);
    return { bot, ...(blocked ?? verdicts[0]) };
  });
}

/** Sitemap URLs declared in robots.txt, for the report. */
export function sitemapsIn(robotsTxt: string | null, url: string): string[] {
  if (robotsTxt === null) return [];
  const origin = new URL(url).origin;
  return robotsParser(`${origin}/robots.txt`, robotsTxt).getSitemaps();
}
