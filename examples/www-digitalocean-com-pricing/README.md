## https://www.digitalocean.com/pricing

**84/100** AI readability · HTTP 200 · 2099 words in the initial HTML

| | Check | Points | Evidence |
|---|---|---:|---|
| ✅ | AI crawler access | 25/25 | No search or assistant bots are blocked for this path. |
| ✅ | Reachable and indexable | 15/15 | HTTP 200, no noindex directive. |
| ✅ | One descriptive H1 | 10/10 | H1: "Simple, predictable pricing". |
| ⚠️ | Question-shaped headings | 6/12 | 1 of 45 subheadings are questions (for example "Still have questions?"). |
| ✅ | Liftable answer blocks | 15/15 | 2 headings followed by a 25 to 90 word paragraph. |
| ⚠️ | Entity structured data | 0/10 | No JSON-LD entity markup. |
| ✅ | Tables and lists | 8/8 | 0 tables, 242 list items. |
| ✅ | Title and meta description | 5/5 | Title 51 chars, description 159 chars. |
| ℹ️ | llms.txt |  | No llms.txt. Not scored: no major engine documents reading it. |

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
| Amazonbot | Amazon | Search index | ✅ allowed | `Allow: /` (line 2) |
| DuckAssistBot | DuckDuckGo | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |
| MistralAI-User | Mistral AI | Assistant fetch | ✅ allowed | `Allow: /` (line 2) |

Training bots: 6 of 6 allowed. Collects content for model training. Blocking does not change what live answers can cite.

![share card](./card.svg)
