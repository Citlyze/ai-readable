import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GitHub evaluates `${{ }}` expressions anywhere in action.yml, including
 * input descriptions. An example expression in a description makes the
 * whole Action fail to load ("Unrecognized named-value: 'secrets'").
 */
describe("action.yml", () => {
  const lines = readFileSync(join(__dirname, "..", "action.yml"), "utf8").split("\n");

  it("uses expressions only in defaults, values and step inputs, never in descriptions", () => {
    const offenders = lines.filter((line) => line.includes("${{") && /^\s*description:/.test(line));
    expect(offenders).toEqual([]);
  });

  it("only references contexts that exist inside a composite action", () => {
    const contexts = new Set<string>();
    for (const line of lines) {
      for (const match of line.matchAll(/\$\{\{\s*([a-z]+)\./g)) contexts.add(match[1]);
    }
    // `secrets` and `env` are not available to action metadata; `github`, `inputs`, `steps`, `runner` are.
    for (const context of contexts) expect(["github", "inputs", "steps", "runner"]).toContain(context);
  });
});
