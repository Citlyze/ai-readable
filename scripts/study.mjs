#!/usr/bin/env node
/**
 * Aggregate study: how readable are sites built with coding-agent app builders?
 *
 *   node scripts/study.mjs sites.txt --render > study.csv
 *
 * sites.txt has one line per site: "<url> <builder>" (builder is a label such as
 * lovable, v0, bolt, claude-code, other). Output is a CSV with one row per site
 * plus aggregate lines on stderr. Individual small sites should not be named in
 * any write-up; publish the aggregates only.
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const [, , listFile, ...rest] = process.argv;
if (!listFile) {
  process.stderr.write("usage: node scripts/study.mjs <sites.txt> [--render]\n");
  process.exit(2);
}
const render = rest.includes("--render");
const cli = join(new URL("..", import.meta.url).pathname, "dist", "cli.js");
const lines = (await readFile(listFile, "utf8")).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

process.stdout.write("url,builder,score,httpStatus,crawlerAccess,indexable,singleH1,answerBlocks,structuredData,staticWords,renderedWords,wordRatio,gapStatus,blockedRetrievalBots\n");
const agg = new Map();

for (const line of lines) {
  const [url, builder = "other"] = line.split(/\s+/);
  const args = [cli, url, "--json"];
  if (render) args.push("--render");
  let report;
  try {
    const { stdout } = await exec(process.execPath, args, { env: { ...process.env, NO_COLOR: "1" }, timeout: 90000 });
    report = JSON.parse(stdout);
  } catch (error) {
    process.stderr.write(`skip ${url}: ${error.message.split("\n")[0]}\n`);
    continue;
  }
  const check = (id) => report.checks.find((c) => c.id === id)?.status ?? "";
  const blocked = report.bots.filter((b) => b.category !== "training" && !b.allowed).map((b) => b.name);
  const gap = report.gap ?? {};
  process.stdout.write(
    [url, builder, report.score, report.httpStatus ?? "", check("crawlerAccess"), check("indexable"), check("singleH1"), check("answerBlocks"), check("structuredData"), gap.staticWordCount ?? "", gap.renderedWordCount ?? "", gap.wordRatio?.toFixed(2) ?? "", gap.status ?? "", blocked.join("|")].join(",") + "\n",
  );
  const a = agg.get(builder) ?? { n: 0, scoreSum: 0, gapFail: 0, noH1: 0, blocked: 0 };
  a.n += 1;
  a.scoreSum += report.score;
  if (gap.status === "fail") a.gapFail += 1;
  if (check("singleH1") === "fail") a.noH1 += 1;
  if (blocked.length) a.blocked += 1;
  agg.set(builder, a);
}

process.stderr.write("\nbuilder\tsites\tavg score\tgap fail %\tno H1 %\tsearch bots blocked %\n");
for (const [builder, a] of agg) {
  const pct = (x) => `${Math.round((100 * x) / a.n)}%`;
  process.stderr.write(`${builder}\t${a.n}\t${Math.round(a.scoreSum / a.n)}\t${pct(a.gapFail)}\t${pct(a.noH1)}\t${pct(a.blocked)}\n`);
}
