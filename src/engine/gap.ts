import type { PageFacts } from "./extract";

export type GapStatus = "pass" | "warn" | "fail";

export type RenderGap = {
  status: GapStatus;
  staticWordCount: number;
  renderedWordCount: number;
  /** Share of the rendered word volume already present in the initial HTML, 0..1. */
  wordRatio: number;
  /** The rendered page has an H1 the initial HTML lacks. */
  missingH1: boolean;
  /** Subheadings that exist only after JavaScript runs. */
  missingSubheadings: string[];
  detail: string;
};

/** Below this share of rendered words in the initial HTML, crawlers miss real content. */
export const WORD_RATIO_WARN = 0.8;
export const WORD_RATIO_FAIL = 0.5;

/**
 * Compare what a crawler downloads (initial HTML) with what a browser shows
 * after JavaScript. Most retrieval crawlers do not execute JavaScript, so
 * content that exists only in the rendered view is invisible to them.
 */
export function compareStaticVsRendered(staticFacts: PageFacts, renderedFacts: PageFacts): RenderGap {
  const staticWordCount = staticFacts.wordCount;
  const renderedWordCount = renderedFacts.wordCount;
  const wordRatio = renderedWordCount === 0 ? 1 : Math.min(1, staticWordCount / renderedWordCount);

  const staticSubheadings = new Set(staticFacts.subheadings);
  const missingSubheadings = renderedFacts.subheadings.filter((h) => !staticSubheadings.has(h));
  const missingH1 = renderedFacts.h1s.length > 0 && staticFacts.h1s.length === 0;

  let status: GapStatus = "pass";
  if (wordRatio < WORD_RATIO_FAIL || missingH1) status = "fail";
  else if (
    wordRatio < WORD_RATIO_WARN ||
    (renderedFacts.subheadings.length > 0 &&
      missingSubheadings.length > renderedFacts.subheadings.length / 2)
  )
    status = "warn";

  const percent = Math.round(wordRatio * 100);
  const detail =
    status === "pass"
      ? `${staticWordCount} of ${renderedWordCount} rendered words (${percent}%) are in the initial HTML.`
      : missingH1
        ? `The H1 "${renderedFacts.h1s[0]}" only exists after JavaScript runs. Initial HTML has ${staticWordCount} word${staticWordCount === 1 ? "" : "s"}, rendered has ${renderedWordCount}.`
        : `Only ${staticWordCount} of ${renderedWordCount} rendered words (${percent}%) are in the initial HTML${
            missingSubheadings.length
              ? `, and ${missingSubheadings.length} subheading${missingSubheadings.length === 1 ? "" : "s"} appear only after JavaScript`
              : ""
          }.`;

  return {
    status,
    staticWordCount,
    renderedWordCount,
    wordRatio,
    missingH1,
    missingSubheadings,
    detail,
  };
}
