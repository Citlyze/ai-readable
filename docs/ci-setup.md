# CI setup

`ai-readable ci` checks the configured paths, compares them with the committed baseline, fails on regressions, and comments on the pull request. The composite GitHub Action wraps it.

## 1. Config

```bash
npx ai-readable init --base-url https://example.com
```

This writes `ai-readable.config.json` and `.github/workflows/ai-readable.yml`. Edit the paths: home, pricing, and one product or docs page is a good start. Keep it under ten paths; each one is a fetch plus a headless Chromium load.

## 2. Baseline

```bash
npx ai-readable ci --update-baseline
git add .ai-readable && git commit -m "ai-readable baseline"
```

The baseline stores each page's score, check statuses, blocked search and assistant bots, and rendered-gap status. Pull requests are compared with it. The workflow refreshes it on every push to `main` and commits the result, so the baseline tracks what is live.

## 3. Badge

```markdown
![ai-readable](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/OWNER/REPO/main/.ai-readable/badge.json)
```

The badge shows the lowest score across your configured pages.

## Gating a preview deployment

The value of the gate comes from checking the pull request's own deployment, not production. Each host exposes the preview URL differently.

### Vercel

Vercel emits a `deployment_status` event when a preview is ready. Run the gate on that event and pass the bypass secret, since previews are protected by default:

```yaml
on:
  deployment_status:

jobs:
  ai-readable:
    if: github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Preview'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.deployment.sha }}
      - uses: Citlyze/ai-readable@v1
        with:
          base-url: ${{ github.event.deployment_status.environment_url }}
          headers: |
            x-vercel-protection-bypass: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
            x-vercel-set-bypass-cookie: true
```

Create the secret in Vercel under Project Settings, Deployment Protection, Protection Bypass for Automation, and add it to the GitHub repository secrets. Note that on `deployment_status` the pull request number is not in the event, so the comment goes to the commit's pull request only when GitHub can resolve it; the step summary always has the full table.

Preview deployments usually serve a robots.txt that disallows everything. That is correct for previews, so either accept the `crawlerAccess` warning there or run the robots check against production in a second job with `paths` set to full production URLs.

### Netlify

Use the `netlify/actions/cli` step or your own deploy step to capture the deploy URL, then pass it as `base-url`. Password-protected previews need the site password in a cookie; simpler is to leave the preview public or gate production only.

### GitHub Pages

Deploy with `actions/deploy-pages` and pass `${{ steps.deployment.outputs.page_url }}` as `base-url`. Pages sites live under a path prefix; `base-url` may include it.

### Self-hosted or staging

Any reachable URL works. For sites behind basic auth pass `authorization: Basic ...` as a header from a secret.

## Rules

Configure in `ai-readable.config.json`:

```json
{
  "rules": {
    "maxScoreDrop": 5,
    "checkRegression": true,
    "botBlocked": true,
    "gapRegression": true,
    "indexable": true
  }
}
```

- `indexable` and fetch errors are absolute: they fail with or without a baseline.
- Everything else is relative to the baseline. Improvements never fail.
- `fail-on: never` reports without failing, useful while you fix an old site.

## What it does not do

It never spoofs bot user agents. CDNs verify real crawlers by IP, so a spoofed request would tell you about the CDN's bot rules, not about what the crawler gets. The verdicts come from robots.txt rules and the initial HTML, which is what the crawlers themselves read.
