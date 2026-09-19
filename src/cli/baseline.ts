import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { REPORT_SCHEMA_VERSION } from "../engine/audit";
import type { PageSummary } from "./diff";

export type Baseline = {
  schemaVersion: number;
  updatedAt: string;
  /** Keyed by the path (or full URL when no baseUrl is configured). */
  pages: Record<string, PageSummary>;
};

export const BASELINE_DIR = ".ai-readable";
export const BASELINE_FILE = join(BASELINE_DIR, "baseline.json");
export const BADGE_FILE = join(BASELINE_DIR, "badge.json");

export async function readBaseline(file = BASELINE_FILE): Promise<Baseline | null> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Baseline;
    if (parsed.schemaVersion !== REPORT_SCHEMA_VERSION) {
      throw new Error(
        `Baseline at ${file} uses schema ${parsed.schemaVersion}, this version writes ${REPORT_SCHEMA_VERSION}. Re-create it with --update-baseline.`,
      );
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeBaseline(
  pages: Record<string, PageSummary>,
  file = BASELINE_FILE,
): Promise<Baseline> {
  const baseline: Baseline = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    pages,
  };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
}

export function badgeColor(score: number): string {
  if (score >= 90) return "brightgreen";
  if (score >= 75) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}

/** shields.io endpoint schema: https://shields.io/badges/endpoint-badge */
export function badgeJson(scores: number[]): {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
} {
  const min = scores.length ? Math.min(...scores) : 0;
  return {
    schemaVersion: 1,
    label: "ai-readable",
    message: scores.length ? `${min}/100` : "no data",
    color: scores.length ? badgeColor(min) : "lightgrey",
  };
}

export async function writeBadge(scores: number[], file = BADGE_FILE): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(badgeJson(scores), null, 2)}\n`);
}
