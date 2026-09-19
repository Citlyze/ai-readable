import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pc from "picocolors";
import { CONFIG_FILE } from "./config";

const WORKFLOW_FILE = ".github/workflows/ai-readable.yml";

const CONFIG_TEMPLATE = {
  $schema: "https://raw.githubusercontent.com/Citlyze/ai-readable/main/docs/config.schema.json",
  paths: ["/", "/pricing"],
  render: true,
  rules: { maxScoreDrop: 5 },
};

function workflow(baseUrl: string): string {
  return `name: ai-readable

# Gate every pull request on AI readability, and refresh the baseline on main.
# Set BASE_URL to the deployed site or a preview URL. For Vercel previews, see
# https://github.com/Citlyze/ai-readable/blob/main/docs/ci-setup.md

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  ai-readable:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Citlyze/ai-readable@v1
        with:
          base-url: ${baseUrl}
          update-baseline: \${{ github.event_name == 'push' }}
      - name: Commit refreshed baseline
        if: github.event_name == 'push'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .ai-readable
          git diff --staged --quiet || git commit -m "chore: refresh ai-readable baseline" && git push
`;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(options: { baseUrl?: string; force?: boolean }): Promise<void> {
  const baseUrl = options.baseUrl ?? "https://example.com";
  const written: string[] = [];

  if (options.force || !(await exists(CONFIG_FILE))) {
    await writeFile(CONFIG_FILE, `${JSON.stringify({ baseUrl, ...CONFIG_TEMPLATE }, null, 2)}\n`);
    written.push(CONFIG_FILE);
  } else {
    process.stderr.write(pc.dim(`${CONFIG_FILE} already exists, leaving it alone\n`));
  }

  if (options.force || !(await exists(WORKFLOW_FILE))) {
    await mkdir(dirname(WORKFLOW_FILE), { recursive: true });
    await writeFile(WORKFLOW_FILE, workflow(baseUrl));
    written.push(WORKFLOW_FILE);
  } else {
    process.stderr.write(pc.dim(`${WORKFLOW_FILE} already exists, leaving it alone\n`));
  }

  for (const file of written) process.stdout.write(`${pc.green("wrote")} ${file}\n`);
  process.stdout.write(
    `\nNext:\n  1. Edit ${CONFIG_FILE}: set baseUrl and the paths that matter (home, pricing, one product page).\n  2. Run ${pc.bold("npx ai-readable ci --update-baseline")} once and commit .ai-readable/.\n  3. Add the badge to your README:\n     ![ai-readable](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/OWNER/REPO/main/.ai-readable/badge.json)\n`,
  );
}
