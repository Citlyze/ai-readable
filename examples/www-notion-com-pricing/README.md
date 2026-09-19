## https://www.notion.com/pricing

**53/100** AI readability · HTTP 200 · 3637 words in the initial HTML

| | Check | Points | Evidence |
|---|---|---:|---|
| ❌ | AI crawler access | 0/25 | Blocked in robots.txt: Amazonbot. |
| ✅ | Reachable and indexable | 15/15 | HTTP 200, no noindex directive. |
| ✅ | One descriptive H1 | 10/10 | H1: "One tool to run your company.". |
| ❌ | Question-shaped headings | 0/12 | 0 of 10 subheadings are questions. |
| ✅ | Liftable answer blocks | 15/15 | 2 headings followed by a 25 to 90 word paragraph. |
| ⚠️ | Entity structured data | 0/10 | No JSON-LD entity markup. |
| ✅ | Tables and lists | 8/8 | 0 tables, 113 list items. |
| ✅ | Title and meta description | 5/5 | Title 57 chars, description 120 chars. |
| ℹ️ | llms.txt |  | llms.txt found. Not scored: no major engine documents reading it. |

### What each AI crawler gets

| Bot | Org | Category | Access | robots.txt rule |
|---|---|---|---|---|
| OAI-SearchBot | OpenAI | Search index | ✅ allowed | `Allow: /` (line 2) |
| ChatGPT-User | OpenAI | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |
| Claude-SearchBot | Anthropic | Search index | ✅ allowed | `Allow: /` (line 2) |
| Claude-User | Anthropic | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |
| PerplexityBot | Perplexity | Search index | ✅ allowed | `Allow: /` (line 2) |
| Perplexity-User | Perplexity | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |
| Googlebot | Google | Search index | ✅ allowed | `Allow: /` (line 2) |
| Bingbot | Microsoft | Search index | ✅ allowed | `Allow: /` (line 2) |
| Applebot | Apple | Search index | ✅ allowed | `Allow: /` (line 2) |
| Meta-ExternalFetcher | Meta | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |
| Amazonbot | Amazon | Search index | ❌ blocked | `Disallow: /` (line 21) |
| DuckAssistBot | DuckDuckGo | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |
| MistralAI-User | Mistral AI | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |

Training bots: 5 of 6 allowed. Collects content for model training. Blocking does not change what live answers can cite.

![share card](./card.svg)
