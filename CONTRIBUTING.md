# Contributing

Three kinds of contributions are the most useful, and each is small.

## 1. Add a bot

Edit `src/engine/bots.ts`. Every entry needs a link to the vendor's own documentation naming the robots.txt token and what the bot is for. Pick the category by consequence, not by the vendor's marketing:

- `search-index`: builds an index that live answers retrieve from.
- `assistant-fetch`: fetches a page on demand when a user asks about it.
- `training`: collects content for model training.

No user-agent strings, no IP ranges, no undocumented bots. Run `pnpm test`; the registry test checks ids and tokens are unique.

## 2. Add or improve a recipe

Recipes live in `docs/recipes/`. A recipe section maps to a check id and shows the smallest change that makes the check pass in that framework, with a code snippet the reader can paste. If you add a framework, link it from `SKILL.md` under "Fix the smallest thing first" and from the README.

## 3. Report a wrong result

Open an issue with the URL, the command you ran, the output, and what you expected. False fails are bugs: the extractor or the robots evaluation missed something. Attach the HTML if the page is not public.

## Development

```bash
pnpm install
pnpm test          # unit tests plus a CLI run against the fixture site
pnpm typecheck
pnpm build
node dist/cli.js https://example.com
```

The fixture site in `fixture-site/` has one deliberately broken page per failure class. If you change a check, add or adjust a fixture so the self-check workflow keeps proving it.

## Scope

This project reads robots.txt and HTML. It does not spoof bot user agents, query AI engines, or measure whether a brand is mentioned in AI answers. Pull requests that add those will be closed with thanks; they belong in a different tool.
