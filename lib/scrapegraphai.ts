/**
 * ScrapeGraphAI client — shared across BigBite Local projects (ComforterWash, bigbiteportal, etc).
 *
 * Server-only. Never import this from a client component — it reads a secret API key
 * from process.env and calls ScrapeGraphAI's REST API directly.
 *
 * Setup:
 *   1. Add SCRAPEGRAPHAI_API_KEY to .env.local (and to the same var in each Vercel
 *      project's Environment Variables settings — local .env.local is NOT synced to Vercel).
 *   2. Copy this file into `lib/scrapegraphai.ts` in any project that needs scraping.
 *   3. Call the functions below from a server action, API route, or server component.
 *
 * Docs: https://docs.scrapegraphai.com
 *
 * Credit cost model (approximate, confirm against your plan's dashboard):
 *   - Each *page* scraped/searched + extracted costs ~5 credits.
 *   - searchScraper with num_results=N costs ~5*N credits.
 *   - Free plan starts with 500 credits. Budget accordingly — see chooseNumResults() below.
 */

const BASE_URL = "https://api.scrapegraphai.com/v1";

function getApiKey(): string {
  const key = process.env.SCRAPEGRAPHAI_API_KEY;
  if (!key) {
    throw new Error(
      "SCRAPEGRAPHAI_API_KEY is not set. Add it to .env.local locally and to your Vercel " +
        "project's Environment Variables for production/preview deploys."
    );
  }
  return key;
}

type FetchOpts = {
  /** Abort the request after this many ms. Search/crawl can take 60-100s+ for large num_results. */
  timeoutMs?: number;
  /** Retry on 429/5xx this many times with exponential backoff. */
  retries?: number;
};

async function sgaiFetch(path: string, body: unknown, opts: FetchOpts = {}): Promise<any> {
  const { timeoutMs = 120_000, retries = 2 } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "SGAI-APIKEY": getApiKey(),
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`ScrapeGraphAI ${path} failed: ${res.status} ${await res.text()}`);
        if (attempt < retries) {
          await sleep(2 ** attempt * 1000);
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ScrapeGraphAI ${path} failed: ${res.status} ${text}`);
      }

      return res.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries && !(err instanceof Error && err.name === "AbortError")) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Suggest a num_results value that fits inside a credit budget.
 * ~5 credits per page scraped+extracted (confirm against your live dashboard rate).
 */
export function chooseNumResults(creditBudget: number, creditsPerPage = 5, max = 20): number {
  return Math.max(3, Math.min(max, Math.floor(creditBudget / creditsPerPage)));
}

// ---------- Search (web search + optional structured extraction per result) ----------

export interface SearchParams {
  /** The search query, e.g. "Airbnb property managers in Orlando FL with contact email". */
  userPrompt: string;
  /** How many result pages to scrape. 3-20. Drives credit cost — see chooseNumResults(). */
  numResults?: number;
  /** Natural-language instruction for what to pull out of each page. */
  extractionPrompt?: string;
  /** JSON Schema for structured output. When set, the response's `result` field matches it. */
  outputSchema?: Record<string, unknown>;
  timeRange?: "day" | "week" | "month" | "year" | "any";
}

export async function search(params: SearchParams, opts?: FetchOpts) {
  return sgaiFetch(
    "/searchscraper",
    {
      user_prompt: params.userPrompt,
      num_results: params.numResults ?? 5,
      extraction_prompt: params.extractionPrompt,
      output_schema: params.outputSchema,
      time_range: params.timeRange,
    },
    opts
  );
}

// ---------- Extract (structured data from one or more known URLs) ----------

export interface ExtractParams {
  urls: string[];
  userPrompt: string;
  outputSchema?: Record<string, unknown>;
}

export async function extract(params: ExtractParams, opts?: FetchOpts) {
  return sgaiFetch(
    "/smartscraper",
    {
      website_url: params.urls.length === 1 ? params.urls[0] : undefined,
      website_urls: params.urls.length > 1 ? params.urls : undefined,
      user_prompt: params.userPrompt,
      output_schema: params.outputSchema,
    },
    opts
  );
}

// ---------- Scrape (raw markdown/HTML from one URL, no LLM extraction) ----------

export async function scrape(url: string, opts?: FetchOpts) {
  return sgaiFetch("/scrape", { website_url: url }, opts);
}

// ---------- Crawl (follow links on a site and extract from each page) ----------

export interface CrawlParams {
  url: string;
  userPrompt: string;
  maxPages?: number;
  outputSchema?: Record<string, unknown>;
}

export async function crawl(params: CrawlParams, opts?: FetchOpts) {
  return sgaiFetch(
    "/crawl",
    {
      url: params.url,
      user_prompt: params.userPrompt,
      max_pages: params.maxPages ?? 10,
      output_schema: params.outputSchema,
    },
    opts
  );
}
