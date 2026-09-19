# Launch checklist

Everything in this file needs the GitHub or npm web UI, or a maintainer account. The repository itself is ready; these are the switches around it.

## Repository settings (github.com/Citlyze/ai-readable)

- **Description:** `See what each AI crawler actually gets from your pages. Fail CI when a deploy makes a page unreadable to AI search.`
- **Website:** `https://citlyze.github.io/ai-readable`
- **Topics** (all 20): `ai-search` `aeo` `geo` `seo` `robots-txt` `ai-crawlers` `github-action` `ci` `cli` `chatgpt` `perplexity` `claude` `llm` `generative-engine-optimization` `answer-engine-optimization` `agent-skills` `claude-code` `codex` `cursor` `typescript`
- **Social preview:** upload `docs/assets/social-preview.png` (Settings, General, Social preview).
- **Features:** enable Discussions (the issue template config links to it), keep Issues on, Wiki off, Projects off.
- **Pages:** Settings, Pages, Source = GitHub Actions. The `pages.yml` workflow deploys `site/`; run it once by hand (Actions, "Publish fixture site", Run workflow) so `citlyze.github.io/ai-readable` and `/fixture/` exist before the self-check workflow runs.
- **Labels:** create `wrong-result`, `bot-registry`, `recipe`, `good first issue` (GitHub has it by default), `help wanted`.
- **Branch protection on main:** require the CI workflow to pass; keep "allow GitHub Actions to create pull requests" off.
- **Secrets:** `NPM_TOKEN` (automation token from the npm org) for `release.yml`.
- **Pin** the repository on the Citlyze org profile and add it to the org profile README table.

## First release

1. Push `main`, wait for CI, Pages and Self-check to go green.
2. Tag `v0.1.0` and push the tag; `release.yml` publishes to npm with provenance.
3. Create the GitHub Release from the tag (as the org account), notes from `CHANGELOG.md`, and tick **Publish this Action to the GitHub Marketplace**. The Action name `ai-readable` must be free on the Marketplace; if not, change `name` in `action.yml` before releasing.
4. Create and push the moving tag `v1` pointing at the same commit, so `Citlyze/ai-readable@v1` resolves. Move it on every compatible release.
5. Bump the `version` default in `action.yml` with every npm release.

## Starter issues to open on launch day

Empty issue trackers look abandoned. Open these yourself, labelled `good first issue` or `help wanted`:

- Add a recipe for SvelteKit.
- Add a recipe for Nuxt.
- Add a recipe for Webflow and Framer exports.
- Add `xAI` and `You.com` bots once their documentation names the tokens.
- `--format junit` output for CI systems that ingest test reports.
- Netlify preview deployment example in `docs/ci-setup.md`.

## Directories and registries

- skills.sh picks up `skills/ai-readable/SKILL.md` automatically after the first `npx skills add Citlyze/ai-readable`.
- cursor.directory: submit via the plugin form with the GitHub URL; it scans `skills/*/SKILL.md`.
- Awesome lists: `awesome-actions`, `awesome-claude-skills`, `awesome-agent-skills`, `awesome-seo`, `awesome-generative-engine-optimization`. One-line entries, one pull request each, spaced out.
- GitHub Marketplace listing comes from step 3 above.
- npm: the README renders on the package page; nothing else to do.

## Launch posts

- Lead with the result, not the tool: "Your pricing page is 14 words to ChatGPT." Attach the share card.
- One 48-hour window, Tuesday to Thursday: founder account first, then r/ClaudeAI, r/SEO, r/SaaS, LinkedIn, then Hacker News only with the study data.
- Ask twenty friendly founders to run it on their site and post their card the same day.
- Reply to every comment for 48 hours. Turn any wrong result into an issue with thanks.

## After launch

- Add the repository link to citlyze.com free tools, the docs, the blog footer and the org profile.
- Point the standalone skill in `citlyze-skills` at this repository.
- Run `scripts/study.mjs` across public sites built with Lovable, v0, Bolt and Claude Code for the aggregate study post.
