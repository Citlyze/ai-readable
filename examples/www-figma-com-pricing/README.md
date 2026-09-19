## https://www.figma.com/pricing/

**90/100** AI readability · HTTP 200 · 4109 words in the initial HTML

| | Check | Points | Evidence |
|---|---|---:|---|
| ✅ | AI crawler access | 25/25 | No search or assistant bots are blocked for this path. |
| ✅ | Reachable and indexable | 15/15 | HTTP 200, no noindex directive. |
| ✅ | One descriptive H1 | 10/10 | H1: "Pick your plan, choose your seats". |
| ✅ | Question-shaped headings | 12/12 | 12 of 36 subheadings are questions (for example "What you can do in figma"). |
| ✅ | Liftable answer blocks | 15/15 | 7 headings followed by a 25 to 90 word paragraph. |
| ⚠️ | Entity structured data | 0/10 | JSON-LD present (faqpage, question, answer) but no Organization, Product, Article or similar entity type. |
| ✅ | Tables and lists | 8/8 | 0 tables, 293 list items. |
| ✅ | Title and meta description | 5/5 | Title 23 chars, description 150 chars. |
| ℹ️ | llms.txt |  | No llms.txt. Not scored: no major engine documents reading it. |

### What each AI crawler gets

| Bot | Org | Category | Access | robots.txt rule |
|---|---|---|---|---|
| OAI-SearchBot | OpenAI | Search index | ✅ allowed | `Allow: /pricing/$` (line 110) |
| ChatGPT-User | OpenAI | Assistant fetch | ✅ allowed | `Allow: /pricing/$` (line 110) |
| Claude-SearchBot | Anthropic | Search index | ✅ allowed | `Allow: /pricing/$` (line 110) |
| Claude-User | Anthropic | Assistant fetch | ✅ allowed | `Allow: /pricing/$` (line 110) |
| PerplexityBot | Perplexity | Search index | ✅ allowed | `Allow: /pricing/$` (line 110) |
| Perplexity-User | Perplexity | Assistant fetch | ✅ allowed |  |
| Googlebot | Google | Search index | ✅ allowed |  |
| Bingbot | Microsoft | Search index | ✅ allowed |  |
| Applebot | Apple | Search index | ✅ allowed |  |
| Meta-ExternalFetcher | Meta | Assistant fetch | ✅ allowed |  |
| Amazonbot | Amazon | Search index | ✅ allowed |  |
| DuckAssistBot | DuckDuckGo | Assistant fetch | ✅ allowed |  |
| MistralAI-User | Mistral AI | Assistant fetch | ✅ allowed |  |

Training bots: 2 of 6 allowed. Collects content for model training. Blocking does not change what live answers can cite.

![share card](./card.svg)
