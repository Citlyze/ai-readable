import * as cheerio from "cheerio";

/** A direct answer under a heading: long enough to say something, short enough to lift. */
export const ANSWER_MIN_WORDS = 25;
export const ANSWER_MAX_WORDS = 90;

export type PageFacts = {
  /** <title> text, whitespace-collapsed. */
  title: string;
  /** meta[name=description] content, trimmed. */
  metaDescription: string;
  /** meta[name=robots] content, lowercased. */
  robotsMeta: string;
  /** All H1 texts, whitespace-collapsed, empties dropped. */
  h1s: string[];
  /** H2 and H3 texts in document order. */
  subheadings: string[];
  /** H2/H3 headings immediately followed by a paragraph in the answer word band. */
  answerBlocks: number;
  /** Lowercased JSON-LD @type values found in ld+json scripts. */
  ldTypes: string[];
  tables: number;
  listItems: number;
  /** Words of readable body text with script, style and noscript removed. */
  wordCount: number;
  /** Canonical URL, when declared. */
  canonical: string | null;
  /** lang attribute of <html>, when declared. */
  lang: string | null;
};

export function words(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function collapse(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** Every @type in a JSON-LD document, including nested nodes and @graph. */
export function ldTypeValues(json: string): string[] {
  const types: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return types;
  }
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    if (typeof type === "string") types.push(type.toLowerCase());
    else if (Array.isArray(type)) {
      for (const t of type) if (typeof t === "string") types.push(t.toLowerCase());
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(parsed);
  return types;
}

/**
 * Readable text with a space between every text node. `.text()` glues
 * adjacent elements together ("guideWhat is it?"), which undercounts words
 * on real pages and skews the rendered-gap ratio.
 */
function bodyText($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  $("body, body *")
    .contents()
    .each((_, node) => {
      if (node.type === "text") {
        const text = collapse((node as { data?: string }).data);
        if (text) parts.push(text);
      }
    });
  return parts.join(" ");
}

export function extractPageFacts(html: string): PageFacts {
  const $ = cheerio.load(html);

  const ldTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    for (const type of ldTypeValues($(el).text())) ldTypes.add(type);
  });

  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const lang = $("html").attr("lang")?.trim() || null;

  // Only genuinely non-content elements. Keep <header>: many templates put
  // the page H1 inside one.
  $("script, style, noscript, template").remove();

  const h1s = $("h1")
    .map((_, el) => collapse($(el).text()))
    .get()
    .filter(Boolean);

  const subheadings = $("h2, h3")
    .map((_, el) => collapse($(el).text()))
    .get()
    .filter(Boolean);

  // Walk headings and paragraphs in document order. Sibling traversal misses
  // the common case where a heading is wrapped in its own div.
  let answerBlocks = 0;
  let awaitingAnswer = false;
  $("h2, h3, p").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();
    if (tag === "h2" || tag === "h3") {
      awaitingAnswer = true;
      return;
    }
    if (!awaitingAnswer) return;
    awaitingAnswer = false;
    const count = words(collapse($(el).text()));
    if (count >= ANSWER_MIN_WORDS && count <= ANSWER_MAX_WORDS) answerBlocks += 1;
  });

  return {
    title: collapse($("title").first().text()),
    metaDescription: ($('meta[name="description"]').attr("content") ?? "").trim(),
    robotsMeta: ($('meta[name="robots"]').attr("content") ?? "").toLowerCase(),
    h1s,
    subheadings,
    answerBlocks,
    ldTypes: [...ldTypes],
    tables: $("table").length,
    listItems: $("ul li, ol li").length,
    wordCount: words(bodyText($)),
    canonical,
    lang,
  };
}
