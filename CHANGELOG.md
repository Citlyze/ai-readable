# Changelog

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
