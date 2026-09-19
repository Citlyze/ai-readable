import { appendFile, readFile } from "node:fs/promises";
import { COMMENT_MARKER } from "./format";

export type GitHubContext = {
  token: string;
  repository: string;
  prNumber: number | null;
  serverUrl: string;
  runUrl: string | null;
};

/** Read what the Actions runner exposes. Returns null outside GitHub Actions. */
export async function githubContext(env: NodeJS.ProcessEnv = process.env): Promise<GitHubContext | null> {
  const token = env.GITHUB_TOKEN ?? env.INPUT_GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  if (!env.GITHUB_ACTIONS || !token || !repository) return null;

  let prNumber: number | null = null;
  if (env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8")) as {
        pull_request?: { number?: number };
        number?: number;
      };
      prNumber = event.pull_request?.number ?? event.number ?? null;
    } catch {
      prNumber = null;
    }
  }
  if (prNumber === null) {
    const match = /^refs\/pull\/(\d+)\//.exec(env.GITHUB_REF ?? "");
    if (match) prNumber = Number(match[1]);
  }
  const serverUrl = env.GITHUB_SERVER_URL ?? "https://github.com";
  const runUrl = env.GITHUB_RUN_ID ? `${serverUrl}/${repository}/actions/runs/${env.GITHUB_RUN_ID}` : null;
  return { token, repository, prNumber, serverUrl, runUrl };
}

async function api<T>(ctx: GitHubContext, method: string, path: string, body?: unknown): Promise<T> {
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${ctx.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "ai-readable",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${method} ${path} failed: HTTP ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/** Create or update the single ai-readable comment on the pull request. */
export async function upsertPrComment(ctx: GitHubContext, body: string): Promise<"created" | "updated" | "skipped"> {
  if (ctx.prNumber === null) return "skipped";
  const base = `/repos/${ctx.repository}/issues/${ctx.prNumber}/comments`;
  const comments = await api<{ id: number; body?: string }[]>(ctx, "GET", `${base}?per_page=100`);
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));
  if (existing) {
    await api(ctx, "PATCH", `/repos/${ctx.repository}/issues/comments/${existing.id}`, { body });
    return "updated";
  }
  await api(ctx, "POST", base, { body });
  return "created";
}

/** Workflow command annotations and step summary. Safe no-ops outside Actions. */
export async function annotate(level: "error" | "warning" | "notice", message: string): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) return;
  const escaped = message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  process.stdout.write(`::${level}::${escaped}\n`);
}

export async function appendStepSummary(markdown: string): Promise<void> {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  await appendFile(file, `${markdown}\n`);
}

export async function setOutput(name: string, value: string | number): Promise<void> {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  await appendFile(file, `${name}=${value}\n`);
}
