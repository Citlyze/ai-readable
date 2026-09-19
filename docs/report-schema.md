# Report schema (v1)

`npx ai-readable <url> --json` prints one object per URL (an array when several URLs are given). `schemaVersion` changes only when a field is removed or its meaning changes; baselines written with another version are refused with a message telling you to re-create them.

```jsonc
{
  "schemaVersion": 1,
  "tool": { "name": "ai-readable", "version": "0.1.0" },
  "url": "https://example.com/pricing",
  "finalUrl": "https://example.com/pricing/",     // after redirects
  "fetchedAt": "2026-09-19T12:00:00.000Z",
  "httpStatus": 200,                               // null when the fetch failed
  "fetchError": null,                              // sentence when the fetch failed
  "score": 92,                                     // 0 when the fetch failed
  "checks": [
    {
      "id": "crawlerAccess",                       // see the check table in README
      "label": "AI crawler access",
      "status": "pass",                            // pass | warn | fail | info
      "points": 25,
      "max": 25,
      "detail": "No search or assistant bots are blocked for this path."
    }
  ],
  "bots": [
    {
      "id": "oai-searchbot",
      "name": "OAI-SearchBot",
      "organization": "OpenAI",
      "category": "search-index",                  // search-index | assistant-fetch | training
      "allowed": false,
      "token": "OAI-SearchBot",                    // the token that decided the verdict
      "rule": "Disallow: /pricing",                // robots.txt line, null when no rule matched
      "line": 12,                                  // 1-based line number, null when no rule matched
      "docs": "https://platform.openai.com/docs/bots"
    }
  ],
  "robotsTxt": { "found": true, "sitemaps": ["https://example.com/sitemap.xml"] },
  "llmsTxt": { "found": false },
  "gap": {                                         // null unless --render succeeded
    "status": "fail",                              // pass | warn | fail
    "staticWordCount": 14,
    "renderedWordCount": 312,
    "wordRatio": 0.04,
    "missingH1": true,
    "missingSubheadings": ["How much does it cost?"],
    "detail": "The H1 \"Pricing plans\" only exists after JavaScript runs. ..."
  },
  "renderError": null,                             // why gap is null when --render was asked
  "facts": {                                       // what the checks read
    "title": "...",
    "metaDescription": "...",
    "robotsMeta": "index, follow",
    "h1s": ["..."],
    "subheadings": ["..."],
    "answerBlocks": 2,
    "ldTypes": ["product", "organization"],
    "tables": 1,
    "listItems": 6,
    "wordCount": 412,
    "canonical": "https://example.com/pricing",
    "lang": "en"
  }
}
```

## Baseline (`.ai-readable/baseline.json`)

```jsonc
{
  "schemaVersion": 1,
  "updatedAt": "2026-09-19T12:00:00.000Z",
  "pages": {
    "/pricing": {
      "score": 92,
      "httpStatus": 200,
      "checks": { "crawlerAccess": "pass", "indexable": "pass", "...": "..." },
      "blockedRetrievalBots": [],
      "gap": "pass",                               // null when render was off
      "fetchedAt": "2026-09-19T12:00:00.000Z"
    }
  }
}
```

## Badge (`.ai-readable/badge.json`)

The [shields.io endpoint format](https://shields.io/badges/endpoint-badge): `label`, `message` (lowest score, e.g. `92/100`) and `color`.
