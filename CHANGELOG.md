# Changelog

## 0.1.3

- Security: with `--render` and custom headers (a preview bypass token, basic auth), a same-origin request that redirected to another origin carried the headers there. Own-origin requests are now fetched hop by hop with redirects off, so a cross-origin hop never sees them. Same-origin redirects of images, scripts and other subresources keep the headers. A redirect of the page itself is now followed by the browser without them; the CLI renders the URL the plain fetch already resolved, so this only affects a redirect the browser alone triggers.
- Security: control characters (ESC, CSI and the rest of C0 and C1) are stripped from page titles, headings, meta tags, JSON-LD types and quoted robots.txt lines, so a page cannot rewrite the terminal that prints the report.
- Pull request comment: only a comment written by the same token is updated, never another user's comment that carries the marker, and comments past the first 100 are searched.
- Action: Playwright is installed at the exact version this repository tests against, instead of the newest 1.x.
- Agent Skill: report text quoted from the site is data, not instructions.
- Development dependencies: vite 8.3.5 and undici 7.30.1 in the lockfile.

## 0.1.2

- Marketplace listing renamed to "ai-readable gate". No functional change.

## 0.1.1

- Action metadata: description shortened to the GitHub Marketplace limit. No functional change.

## 0.1.0

First release.

- `ai-readable <url>`: per-bot robots.txt verdicts for 19 documented AI crawlers, nine AI readability checks scored /100, optional rendered comparison, JSON, Markdown and share-card output.
- `ai-readable ci`: baseline diff with regression rules, GitHub Actions annotations, step summary, pull request comment, badge JSON.
- `ai-readable init`: config and workflow scaffold.
- Composite GitHub Action `Citlyze/ai-readable@v1`.
- Agent Skill (`SKILL.md`) and Claude Code / Codex plugin manifests.
- Recipes for Next.js, Astro, single-page app exports, and robots.txt.

Scores match the hosted [Citlyze AEO grader](https://www.citlyze.com/free-tools/aeo-grader) on the same checklist. They can differ on very large pages: the hosted tool reads the first 256 KB of HTML, this CLI reads up to 2 MB.
