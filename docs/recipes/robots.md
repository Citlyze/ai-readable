# Recipe: robots.txt for AI crawlers

`ai-readable` fails `crawlerAccess` when a **search-index** or **assistant-fetch** bot is disallowed for the checked path. It never fails for training bots, because blocking those does not change what live answers can cite.

## The three categories, and what blocking each one costs

| Category | Examples | Blocking it means |
|---|---|---|
| Search index | OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, Applebot, Amazonbot | Your pages leave the index that ChatGPT search, Claude search, Perplexity, AI Overviews, Copilot, Siri and Alexa retrieve from. |
| Assistant fetch | ChatGPT-User, Claude-User, Perplexity-User, Meta-ExternalFetcher, DuckAssistBot, MistralAI-User | An assistant cannot open your page when a user pastes the link or asks about it, so it cannot quote or cite you. |
| Training | GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, Meta-ExternalAgent, CCBot | Future models learn less from you. Live answers are unaffected. |

Run `npx ai-readable bots` for the full list with vendor documentation links.

## The most common accident

A block-list copied from a "block all AI" snippet that includes the search bots:

```
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
Disallow: /
```

That removes you from ChatGPT search and stops ChatGPT opening your links, when the intent was only to opt out of training. Split the group:

```
# Opt out of training only
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Meta-ExternalAgent
User-agent: CCBot
Disallow: /

# Everyone else, including search and assistant bots
User-agent: *
Allow: /
```

## Path-level blocks

A `Disallow` under a specific bot group wins over `User-agent: *`. The report quotes the rule and the line number, so search your robots.txt for that exact line. A rule like `Disallow: /pricing` also matches `/pricing-plans` and `/pricing/enterprise`; use `Disallow: /pricing/` or `Disallow: /pricing$` when you mean one page.

## Framework notes

- **Next.js App Router:** `app/robots.ts` generates the file. Make sure the `rules` array keeps search and assistant bots allowed; a `userAgent: "*"` entry does not override a specific bot entry that disallows.
- **Astro:** a static `public/robots.txt`, or `@astrojs/sitemap` plus your own file. There is no generator by default.
- **Vercel / Netlify previews:** previews often serve a blanket `Disallow: /`, which is correct for previews. Gate against the production URL for the robots check, or accept the warning on previews.
- **WordPress:** plugins that "block AI" frequently block the search bots too. Check the generated file, not the plugin's description.

## After the fix

```bash
npx ai-readable https://example.com/pricing
```

The per-bot table should show every search and assistant bot as allowed for that path.
