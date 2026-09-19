import { isRetrievalBot } from "./bots";
import { ANSWER_MAX_WORDS, ANSWER_MIN_WORDS, words, type PageFacts } from "./extract";
import type { BotVerdict } from "./robots";

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type CheckId =
  | "crawlerAccess"
  | "indexable"
  | "singleH1"
  | "questionHeadings"
  | "answerBlocks"
  | "structuredData"
  | "extractableFormats"
  | "titleAndDescription"
  | "llmsTxt";

export type Check = {
  id: CheckId;
  label: string;
  status: CheckStatus;
  points: number;
  max: number;
  /** One factual sentence quoting the evidence. */
  detail: string;
};

export type ChecksInput = {
  facts: PageFacts;
  bots: BotVerdict[];
  httpStatus: number | null;
  xRobotsTag: string | null;
  robotsTxtFound: boolean;
  llmsTxt: string | null;
};

export type ChecksResult = { score: number; checks: Check[] };

export const CHECK_LABELS: Record<CheckId, string> = {
  crawlerAccess: "AI crawler access",
  indexable: "Reachable and indexable",
  singleH1: "One descriptive H1",
  questionHeadings: "Question-shaped headings",
  answerBlocks: "Liftable answer blocks",
  structuredData: "Entity structured data",
  extractableFormats: "Tables and lists",
  titleAndDescription: "Title and meta description",
  llmsTxt: "llms.txt",
};

const QUESTION_STARTERS = new Set([
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "does",
  "do",
  "is",
  "are",
  "can",
  "should",
  "will",
]);

/** Schema.org types that say who or what the page is about. */
const ENTITY_TYPES = new Set([
  "organization",
  "product",
  "softwareapplication",
  "article",
  "newsarticle",
  "blogposting",
  "localbusiness",
  "person",
  "breadcrumblist",
  "service",
  "event",
]);

export function isQuestion(heading: string): boolean {
  const text = heading.trim().toLowerCase();
  if (!text) return false;
  if (text.endsWith("?")) return true;
  const first = text.split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";
  return QUESTION_STARTERS.has(first);
}

function check(
  id: CheckId,
  status: CheckStatus,
  points: number,
  max: number,
  detail: string,
): Check {
  return { id, label: CHECK_LABELS[id], status, points, max, detail };
}

/**
 * The nine checks, scored /100. Weights: 25, 15, 10, 12, 15, 10, 8, 5, and
 * llms.txt reported but unscored. They are documented in README.md; change
 * them there and here together.
 */
export function runChecks(input: ChecksInput): ChecksResult {
  const { facts, bots, httpStatus, xRobotsTag, robotsTxtFound, llmsTxt } = input;
  const checks: Check[] = [];

  // 1. Retrieval access: the eligibility gate, so it carries the most weight.
  const blocked = bots.filter((v) => isRetrievalBot(v.bot) && !v.allowed);
  const blockedNames = [...new Set(blocked.map((v) => v.bot.name))];
  checks.push(
    check(
      "crawlerAccess",
      blockedNames.length === 0 ? "pass" : "fail",
      blockedNames.length === 0 ? 25 : 0,
      25,
      blockedNames.length === 0
        ? robotsTxtFound
          ? "No search or assistant bots are blocked for this path."
          : "No robots.txt found, so nothing is blocked."
        : `Blocked in robots.txt: ${blockedNames.slice(0, 4).join(", ")}${
            blockedNames.length > 4 ? ` and ${blockedNames.length - 4} more` : ""
          }.`,
    ),
  );

  // 2. Reachable and indexable.
  const headerNoindex = (xRobotsTag ?? "").toLowerCase().includes("noindex");
  const metaNoindex = facts.robotsMeta.includes("noindex");
  const errorStatus = httpStatus !== null && httpStatus >= 400;
  const noindex = metaNoindex || headerNoindex || errorStatus;
  checks.push(
    check(
      "indexable",
      noindex ? "fail" : "pass",
      noindex ? 0 : 15,
      15,
      errorStatus
        ? `The page returned HTTP ${httpStatus}, so engines cannot index it.`
        : metaNoindex
          ? `meta robots is "${facts.robotsMeta}".`
          : headerNoindex
            ? `The X-Robots-Tag header is "${xRobotsTag}".`
            : httpStatus
              ? `HTTP ${httpStatus}, no noindex directive.`
              : "No noindex directive.",
    ),
  );

  // 3. One descriptive H1.
  const h1s = facts.h1s;
  const h1Ok = h1s.length === 1 && words(h1s[0]) >= 3;
  checks.push(
    check(
      "singleH1",
      h1Ok ? "pass" : h1s.length === 0 ? "fail" : "warn",
      h1Ok ? 10 : h1s.length === 0 ? 0 : 5,
      10,
      h1s.length === 0
        ? "No H1 in the HTML."
        : h1s.length > 1
          ? `${h1s.length} H1s found: "${h1s[0]}" and ${h1s.length - 1} more. Use one.`
          : words(h1s[0]) < 3
            ? `The H1 is "${h1s[0]}". Name the thing and what it is.`
            : `H1: "${h1s[0]}".`,
    ),
  );

  // 4. Question-shaped headings.
  const headings = facts.subheadings;
  const questions = headings.filter(isQuestion);
  const questionStatus: CheckStatus =
    questions.length >= 2 ? "pass" : questions.length === 1 ? "warn" : "fail";
  checks.push(
    check(
      "questionHeadings",
      questionStatus,
      questionStatus === "pass" ? 12 : questionStatus === "warn" ? 6 : 0,
      12,
      headings.length
        ? `${questions.length} of ${headings.length} subheadings are questions${
            questions[0] ? ` (for example "${questions[0]}")` : ""
          }.`
        : "No H2 or H3 subheadings in the HTML.",
    ),
  );

  // 5. A direct answer right under a heading.
  const answers = facts.answerBlocks;
  const answerStatus: CheckStatus = answers >= 2 ? "pass" : answers === 1 ? "warn" : "fail";
  checks.push(
    check(
      "answerBlocks",
      answerStatus,
      answerStatus === "pass" ? 15 : answerStatus === "warn" ? 7 : 0,
      15,
      `${answers} heading${answers === 1 ? "" : "s"} followed by a ${ANSWER_MIN_WORDS} to ${ANSWER_MAX_WORDS} word paragraph.`,
    ),
  );

  // 6. Entity structured data. FAQPage earns nothing: Google retired FAQ rich
  // results, and the type says nothing about who the page is about.
  const entityTypes = facts.ldTypes.filter((type) => ENTITY_TYPES.has(type));
  checks.push(
    check(
      "structuredData",
      entityTypes.length ? "pass" : "warn",
      entityTypes.length ? 10 : 0,
      10,
      entityTypes.length
        ? `JSON-LD: ${[...new Set(entityTypes)].slice(0, 4).join(", ")}.`
        : facts.ldTypes.length
          ? `JSON-LD present (${[...new Set(facts.ldTypes)].slice(0, 3).join(", ")}) but no Organization, Product, Article or similar entity type.`
          : "No JSON-LD entity markup.",
    ),
  );

  // 7. Extractable formats.
  const formatsOk = facts.tables > 0 || facts.listItems >= 3;
  checks.push(
    check(
      "extractableFormats",
      formatsOk ? "pass" : "warn",
      formatsOk ? 8 : 0,
      8,
      formatsOk
        ? `${facts.tables} table${facts.tables === 1 ? "" : "s"}, ${facts.listItems} list item${
            facts.listItems === 1 ? "" : "s"
          }.`
        : "No tables and fewer than three list items. Comparative facts lift better from tables.",
    ),
  );

  // 8. Title and meta description.
  const { title, metaDescription } = facts;
  const metaOk = title.length >= 15 && metaDescription.length >= 50;
  checks.push(
    check(
      "titleAndDescription",
      metaOk ? "pass" : "warn",
      metaOk ? 5 : 0,
      5,
      !title
        ? "No title tag."
        : !metaDescription
          ? `Title "${title}", no meta description.`
          : metaOk
            ? `Title ${title.length} chars, description ${metaDescription.length} chars.`
            : `Title ${title.length} chars, description ${metaDescription.length} chars. Aim for 15+ and 50+.`,
    ),
  );

  // 9. llms.txt: reported, never scored. Adoption is real; consumption by the
  // major engines is not documented, so it earns nothing either way.
  const hasLlms = Boolean(llmsTxt && llmsTxt.trim().startsWith("#"));
  checks.push(
    check(
      "llmsTxt",
      "info",
      0,
      0,
      hasLlms
        ? "llms.txt found. Not scored: no major engine documents reading it."
        : "No llms.txt. Not scored: no major engine documents reading it.",
    ),
  );

  const max = checks.reduce((sum, c) => sum + c.max, 0);
  const earned = checks.reduce((sum, c) => sum + c.points, 0);
  // An error page is not the page. Whatever structure the 404 template has,
  // engines never index it, so the score is zero, not credit for the template.
  return { score: errorStatus ? 0 : Math.round((earned / max) * 100), checks };
}

export const STATUS_RANK: Record<CheckStatus, number> = { pass: 0, info: 0, warn: 1, fail: 2 };
