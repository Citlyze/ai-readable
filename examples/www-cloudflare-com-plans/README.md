## https://www.cloudflare.com/plans/

**70/100** AI readability · HTTP 200 · 2606 words in the initial HTML

| | Check | Points | Evidence |
|---|---|---:|---|
| ✅ | AI crawler access | 25/25 | No search or assistant bots are blocked for this path. |
| ✅ | Reachable and indexable | 15/15 | HTTP 200, no noindex directive. |
| ⚠️ | One descriptive H1 | 5/10 | 2 H1s found: "Scale predictably" and 1 more. Use one. |
| ❌ | Question-shaped headings | 0/12 | 0 of 11 subheadings are questions. |
| ⚠️ | Liftable answer blocks | 7/15 | 1 heading followed by a 25 to 90 word paragraph. |
| ✅ | Entity structured data | 10/10 | JSON-LD: organization. |
| ✅ | Tables and lists | 8/8 | 24 tables, 0 list items. |
| ⚠️ | Title and meta description | 0/5 | Title 7 chars, description 89 chars. Aim for 15+ and 50+. |
| ℹ️ | llms.txt |  | llms.txt found. Not scored: no major engine documents reading it. |

### What each AI crawler gets

| Bot | Org | Category | Access | robots.txt rule |
|---|---|---|---|---|
| OAI-SearchBot | OpenAI | Search index | ✅ allowed | `Allow: /` (line 4) |
| ChatGPT-User | OpenAI | Assistant fetch | ✅ allowed | `Allow: /` (line 18) |
| Claude-SearchBot | Anthropic | Search index | ✅ allowed | `Allow: /` (line 4) |
| Claude-User | Anthropic | Assistant fetch | ✅ allowed | `Allow: /` (line 4) |
| PerplexityBot | Perplexity | Search index | ✅ allowed | `Allow: /` (line 33) |
| Perplexity-User | Perplexity | Assistant fetch | ✅ allowed | `Allow: /` (line 4) |
| Googlebot | Google | Search index | ✅ allowed | `Allow: /` (line 4) |
| Bingbot | Microsoft | Search index | ✅ allowed | `Allow: /` (line 4) |
| Applebot | Apple | Search index | ✅ allowed | `Allow: /` (line 4) |
| Meta-ExternalFetcher | Meta | Assistant fetch | ✅ allowed | `Allow: /` (line 4) |
| Amazonbot | Amazon | Search index | ✅ allowed | `Allow: /` (line 4) |
| DuckAssistBot | DuckDuckGo | Assistant fetch | ✅ allowed | `Allow: /` (line 4) |
| MistralAI-User | Mistral AI | Assistant fetch | ✅ allowed | `Allow: /` (line 4) |

Training bots: 6 of 6 allowed. Collects content for model training. Blocking does not change what live answers can cite.

![share card](./card.svg)
