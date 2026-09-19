import { describe, expect, it } from "vitest";
import { extractPageFacts } from "../src/engine/extract";
import { compareStaticVsRendered } from "../src/engine/gap";

const rendered = extractPageFacts(
  `<h1>Acme pricing plans</h1><h2>How much?</h2><p>${"w ".repeat(40)}</p><h2>Which plan?</h2><p>${"w ".repeat(40)}</p>`,
);

describe("compareStaticVsRendered", () => {
  it("passes when the initial HTML already carries the content", () => {
    const gap = compareStaticVsRendered(rendered, rendered);
    expect(gap.status).toBe("pass");
    expect(gap.wordRatio).toBe(1);
  });

  it("fails when the H1 only exists after JavaScript", () => {
    const shell = extractPageFacts(`<div id="root">Loading</div>`);
    const gap = compareStaticVsRendered(shell, rendered);
    expect(gap.status).toBe("fail");
    expect(gap.missingH1).toBe(true);
    expect(gap.missingSubheadings).toEqual(["How much?", "Which plan?"]);
    expect(gap.detail).toContain("Acme pricing plans");
  });

  it("warns between 50 and 80 percent", () => {
    const halfway = extractPageFacts(`<h1>Acme pricing plans</h1><h2>How much?</h2><p>${"w ".repeat(50)}</p>`);
    const gap = compareStaticVsRendered(halfway, rendered);
    expect(gap.status).toBe("warn");
    expect(gap.wordRatio).toBeGreaterThan(0.5);
    expect(gap.wordRatio).toBeLessThan(0.8);
  });

  it("treats an empty rendered page as no gap", () => {
    const empty = extractPageFacts("");
    expect(compareStaticVsRendered(empty, empty).status).toBe("pass");
  });
});
