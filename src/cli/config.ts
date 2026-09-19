import { readFile } from "node:fs/promises";
import { DEFAULT_RULES, type DiffRules, type RuleOverrides } from "./diff";

export type Config = {
  /** Origin the paths are resolved against. CI passes the preview URL here. */
  baseUrl?: string;
  /** Paths to gate, e.g. ["/", "/pricing"]. Full URLs are accepted too. */
  paths: string[];
  /** Run the rendered comparison. Defaults to true in `ci`. */
  render?: boolean;
  /** Extra request headers, e.g. a preview-deploy bypass token. */
  headers?: Record<string, string>;
  rules?: RuleOverrides;
  /** Fetch timeout per request in milliseconds. */
  timeoutMs?: number;
};

export const CONFIG_FILE = "ai-readable.config.json";

export async function readConfig(file = CONFIG_FILE): Promise<Config | null> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { [K in keyof Config]?: Config[K] };
    if (!Array.isArray(parsed.paths) || parsed.paths.length === 0) {
      throw new Error(`${file}: "paths" must be a non-empty array.`);
    }
    return { ...parsed, paths: parsed.paths };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function resolveRules(overrides?: RuleOverrides): DiffRules {
  return { ...DEFAULT_RULES, ...(overrides ?? {}) };
}

/** Parse repeated `--header "Name: value"` flags into a header map. */
export function parseHeaderFlags(flags: string[] | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const flag of flags ?? []) {
    const index = flag.indexOf(":");
    if (index === -1) throw new Error(`--header expects "Name: value", got "${flag}"`);
    headers[flag.slice(0, index).trim().toLowerCase()] = flag.slice(index + 1).trim();
  }
  return headers;
}

/**
 * Turn config paths into absolute URLs. A path stays the baseline key; a full
 * URL is its own key. `baseUrl` may carry a path prefix (GitHub Pages sites).
 */
export function resolveTargets(
  paths: string[],
  baseUrl: string | undefined,
): { key: string; url: string }[] {
  return paths.map((entry) => {
    if (/^https?:\/\//i.test(entry)) return { key: entry, url: entry };
    if (!baseUrl) throw new Error(`Path "${entry}" needs a base URL. Pass --base-url or set baseUrl in the config.`);
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const path = entry.startsWith("/") ? entry.slice(1) : entry;
    return { key: entry.startsWith("/") ? entry : `/${entry}`, url: new URL(path, base).toString() };
  });
}
