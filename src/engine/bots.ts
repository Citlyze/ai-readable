/**
 * Documented AI crawlers and fetchers, grouped by what blocking them costs.
 *
 * Every entry comes from the vendor's own documentation page (linked in
 * `docs`). Tokens are the exact strings the vendor says to use in robots.txt.
 * Contributions: add a bot only with a vendor documentation link.
 */

export type BotCategory = "training" | "search-index" | "assistant-fetch";

export type Bot = {
  id: string;
  name: string;
  organization: string;
  category: BotCategory;
  /** robots.txt User-agent tokens the vendor documents for this bot. */
  tokens: string[];
  /** Vendor documentation for the bot. */
  docs: string;
  /** True when the token only exists as a robots.txt directive (no live fetcher). */
  robotsOnly?: boolean;
  /** Which product the bot feeds, for the table. */
  feeds: string;
};

export const CATEGORY_INFO: Record<
  BotCategory,
  { label: string; consequence: string; order: number }
> = {
  "search-index": {
    label: "Search index",
    consequence:
      "Builds the index AI answers retrieve from. Blocking removes your pages from live answers.",
    order: 0,
  },
  "assistant-fetch": {
    label: "Assistant fetch",
    consequence:
      "Fetches a page on demand when a user asks about it. Blocking breaks link reading and citations.",
    order: 1,
  },
  training: {
    label: "Training",
    consequence:
      "Collects content for model training. Blocking does not change what live answers can cite.",
    order: 2,
  },
};

export const RETRIEVAL_CATEGORIES: BotCategory[] = ["search-index", "assistant-fetch"];

export const BOTS: Bot[] = [
  // OpenAI: https://platform.openai.com/docs/bots
  {
    id: "oai-searchbot",
    name: "OAI-SearchBot",
    organization: "OpenAI",
    category: "search-index",
    tokens: ["OAI-SearchBot"],
    docs: "https://platform.openai.com/docs/bots",
    feeds: "ChatGPT search results",
  },
  {
    id: "chatgpt-user",
    name: "ChatGPT-User",
    organization: "OpenAI",
    category: "assistant-fetch",
    tokens: ["ChatGPT-User"],
    docs: "https://platform.openai.com/docs/bots",
    feeds: "ChatGPT link reading and GPT actions",
  },
  {
    id: "gptbot",
    name: "GPTBot",
    organization: "OpenAI",
    category: "training",
    tokens: ["GPTBot"],
    docs: "https://platform.openai.com/docs/bots",
    feeds: "OpenAI model training",
  },
  // Anthropic: https://support.anthropic.com/en/articles/8896518
  {
    id: "claude-searchbot",
    name: "Claude-SearchBot",
    organization: "Anthropic",
    category: "search-index",
    tokens: ["Claude-SearchBot"],
    docs: "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    feeds: "Claude web search results",
  },
  {
    id: "claude-user",
    name: "Claude-User",
    organization: "Anthropic",
    category: "assistant-fetch",
    tokens: ["Claude-User"],
    docs: "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    feeds: "Claude fetching a page a user asked about",
  },
  {
    id: "claudebot",
    name: "ClaudeBot",
    organization: "Anthropic",
    category: "training",
    tokens: ["ClaudeBot"],
    docs: "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    feeds: "Anthropic model training",
  },
  // Perplexity: https://docs.perplexity.ai/guides/bots
  {
    id: "perplexitybot",
    name: "PerplexityBot",
    organization: "Perplexity",
    category: "search-index",
    tokens: ["PerplexityBot"],
    docs: "https://docs.perplexity.ai/guides/bots",
    feeds: "Perplexity search index",
  },
  {
    id: "perplexity-user",
    name: "Perplexity-User",
    organization: "Perplexity",
    category: "assistant-fetch",
    tokens: ["Perplexity-User"],
    docs: "https://docs.perplexity.ai/guides/bots",
    feeds: "Perplexity fetching a page a user asked about",
  },
  // Google: https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
  {
    id: "googlebot",
    name: "Googlebot",
    organization: "Google",
    category: "search-index",
    tokens: ["Googlebot"],
    docs: "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
    feeds: "Google Search, AI Overviews and AI Mode",
  },
  {
    id: "google-extended",
    name: "Google-Extended",
    organization: "Google",
    category: "training",
    tokens: ["Google-Extended"],
    docs: "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
    robotsOnly: true,
    feeds: "Gemini model training (robots.txt directive only)",
  },
  // Microsoft: https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0
  {
    id: "bingbot",
    name: "Bingbot",
    organization: "Microsoft",
    category: "search-index",
    tokens: ["Bingbot"],
    docs: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
    feeds: "Bing and Copilot answers",
  },
  // Apple: https://support.apple.com/en-us/119829
  {
    id: "applebot",
    name: "Applebot",
    organization: "Apple",
    category: "search-index",
    tokens: ["Applebot"],
    docs: "https://support.apple.com/en-us/119829",
    feeds: "Siri and Spotlight suggestions",
  },
  {
    id: "applebot-extended",
    name: "Applebot-Extended",
    organization: "Apple",
    category: "training",
    tokens: ["Applebot-Extended"],
    docs: "https://support.apple.com/en-us/119829",
    robotsOnly: true,
    feeds: "Apple foundation model training (robots.txt directive only)",
  },
  // Meta: https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
  {
    id: "meta-externalfetcher",
    name: "Meta-ExternalFetcher",
    organization: "Meta",
    category: "assistant-fetch",
    tokens: ["Meta-ExternalFetcher"],
    docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers",
    feeds: "Meta AI fetching a page a user asked about",
  },
  {
    id: "meta-externalagent",
    name: "Meta-ExternalAgent",
    organization: "Meta",
    category: "training",
    tokens: ["Meta-ExternalAgent"],
    docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers",
    feeds: "Meta model training",
  },
  // Amazon: https://developer.amazon.com/amazonbot
  {
    id: "amazonbot",
    name: "Amazonbot",
    organization: "Amazon",
    category: "search-index",
    tokens: ["Amazonbot"],
    docs: "https://developer.amazon.com/amazonbot",
    feeds: "Alexa answers",
  },
  // DuckDuckGo: https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot
  {
    id: "duckassistbot",
    name: "DuckAssistBot",
    organization: "DuckDuckGo",
    category: "assistant-fetch",
    tokens: ["DuckAssistBot"],
    docs: "https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot",
    feeds: "DuckAssist answers",
  },
  // Mistral: https://docs.mistral.ai/robots
  {
    id: "mistralai-user",
    name: "MistralAI-User",
    organization: "Mistral AI",
    category: "assistant-fetch",
    tokens: ["MistralAI-User"],
    docs: "https://docs.mistral.ai/robots",
    feeds: "Le Chat fetching a page a user asked about",
  },
  // Common Crawl: https://commoncrawl.org/ccbot
  {
    id: "ccbot",
    name: "CCBot",
    organization: "Common Crawl",
    category: "training",
    tokens: ["CCBot"],
    docs: "https://commoncrawl.org/ccbot",
    feeds: "The Common Crawl corpus many models train on",
  },
];

export function botsByCategory(bots: Bot[] = BOTS): Record<BotCategory, Bot[]> {
  const grouped: Record<BotCategory, Bot[]> = {
    "search-index": [],
    "assistant-fetch": [],
    training: [],
  };
  for (const bot of bots) grouped[bot.category].push(bot);
  return grouped;
}

export function isRetrievalBot(bot: Bot): boolean {
  return RETRIEVAL_CATEGORIES.includes(bot.category);
}
