import pc from "picocolors";
import { auditUrl, type PageReport } from "../engine/audit";
import { writeCard } from "./card";
import { parseHeaderFlags } from "./config";
import { renderMarkdown, renderTerminal } from "./format";

export type CheckFlags = {
  render?: boolean;
  json?: boolean;
  md?: boolean;
  card?: string;
  header?: string[];
  bots?: "all" | "retrieval";
  timeout?: string;
  version: string;
};

export async function runCheck(urls: string[], flags: CheckFlags): Promise<PageReport[]> {
  const headers = parseHeaderFlags(flags.header);
  const timeoutMs = flags.timeout ? Number(flags.timeout) : undefined;
  const reports: PageReport[] = [];

  for (const url of urls) {
    if (!flags.json && !flags.md) process.stderr.write(pc.dim(`checking ${url}${flags.render ? " (with render)" : ""}…\n`));
    const report = await auditUrl(url, { render: flags.render, headers, timeoutMs, version: flags.version });
    reports.push(report);
    if (flags.json) continue;
    if (flags.md) {
      process.stdout.write(`${renderMarkdown(report, { bots: flags.bots })}\n\n`);
      continue;
    }
    process.stdout.write(`${renderTerminal(report, { bots: flags.bots })}\n\n`);
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2)}\n`);
  }

  if (flags.card) {
    const target = reports[0];
    if (!target) throw new Error("Nothing to draw a card for.");
    const file = await writeCard(target, flags.card);
    process.stderr.write(pc.dim(`card written to ${file}\n`));
  }

  return reports;
}
