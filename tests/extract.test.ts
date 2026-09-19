import { describe, expect, it } from "vitest";
import { extractPageFacts, ldTypeValues } from "../src/engine/extract";

const PAGE = `<!doctype html>
<html lang="fr">
<head>
  <title>  Acme   Widget Pro </title>
  <meta name="description" content=" Compare models. ">
  <meta name="robots" content="INDEX, Follow">
  <link rel="canonical" href="https://example.com/widgets">
  <script type="application/ld+json">{"@type":"Product","brand":{"@type":"Organization"}}</script>
  <script type="application/ld+json">{"@graph":[{"@type":["WebPage","FAQPage"]}]}</script>
  <style>h1 { color: red }</style>
</head>
<body>
  <header><h1>Acme Widget Pro buying guide</h1></header>
  <div><h2>What is it?</h2></div>
  <p>${"word ".repeat(30).trim()}</p>
  <h3>Too short</h3>
  <p>short answer</p>
  <h2>Long one</h2>
  <p>${"word ".repeat(120).trim()}</p>
  <script>console.log("noise noise noise")</script>
  <noscript>Enable JavaScript please</noscript>
  <table><tr><td>a</td></tr></table>
  <ul><li>1</li><li>2</li></ul><ol><li>3</li></ol>
</body></html>`;

describe("extractPageFacts", () => {
  const facts = extractPageFacts(PAGE);

  it("keeps the H1 that lives inside <header>", () => {
    expect(facts.h1s).toEqual(["Acme Widget Pro buying guide"]);
  });

  it("collapses whitespace in title and trims the description", () => {
    expect(facts.title).toBe("Acme Widget Pro");
    expect(facts.metaDescription).toBe("Compare models.");
    expect(facts.robotsMeta).toBe("index, follow");
  });

  it("counts an answer block even when the heading is wrapped in a div", () => {
    // 30-word paragraph under a div-wrapped h2 counts; 2-word and 120-word paragraphs do not.
    expect(facts.answerBlocks).toBe(1);
  });

  it("collects subheadings in document order", () => {
    expect(facts.subheadings).toEqual(["What is it?", "Too short", "Long one"]);
  });

  it("harvests nested and @graph JSON-LD types, lowercased", () => {
    expect(facts.ldTypes.sort()).toEqual(["faqpage", "organization", "product", "webpage"]);
  });

  it("excludes script, style and noscript text from the word count", () => {
    expect(facts.wordCount).toBe(
      5 + 3 + 30 + 2 + 2 + 2 + 120 + 1 + 3, // h1, h2, p, h3, p, h2, p, td, li x3
    );
  });

  it("reads canonical and lang", () => {
    expect(facts.canonical).toBe("https://example.com/widgets");
    expect(facts.lang).toBe("fr");
    expect(facts.tables).toBe(1);
    expect(facts.listItems).toBe(3);
  });
});

describe("ldTypeValues", () => {
  it("ignores invalid JSON", () => {
    expect(ldTypeValues("{not json")).toEqual([]);
  });
  it("handles arrays of documents", () => {
    expect(ldTypeValues('[{"@type":"Article"},{"@type":"Person"}]')).toEqual(["article", "person"]);
  });
});
