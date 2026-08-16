# ScrapeGraphAI — shared client for BigBite Local projects

A small, dependency-light wrapper around ScrapeGraphAI's REST API (`scrapegraphai.ts` for
Next.js/TypeScript projects, `scrapegraphai_client.py` for Python scripts). Drop the relevant
file into any project's `lib/` folder and call it from server-side code.

## Why not the dashboard/browser playground?

That's how we ran today's Orlando prospect search, and it works for one-off exploration, but
it doesn't scale as "the scraping backbone for all our projects":

- It's manual — someone has to click through the UI per query.
- It can't be scheduled or triggered by app events (e.g. "re-check competitor pricing nightly").
- The playground UI got flaky past ~10-13 results per search in testing.
- It can't be called from bigbiteportal's own backend at request time.

Calling the REST API directly from your app's server code fixes all of that — this is the
standard way ScrapeGraphAI is meant to be used (their own docs only show server-side examples,
not browser calls; the API doesn't allow direct browser `fetch()` calls due to CORS).

## Setup (per project)

1. Copy `scrapegraphai.ts` (Next.js/TS) or `scrapegraphai_client.py` (Python) into the
   project's `lib/` folder.
2. Add the key to that project's env:
   - Locally: `.env.local` → `SCRAPEGRAPHAI_API_KEY=sgai-...`
   - Vercel: Project Settings → Environment Variables → add the same var for
     Production, Preview, and Development. **`.env.local` is git-ignored and never
     syncs to Vercel automatically** — you have to add it there separately, per project.
3. Never commit the key or hardcode it in source. It was shared in this chat in plaintext —
   treat it as already semi-exposed and consider rotating it from the ScrapeGraphAI dashboard
   (Overview → API Key → regenerate) once it's wired into env vars everywhere, so the old
   plaintext copy stops working.
4. Call `search()`, `extract()`, `scrape()`, or `crawl()` from a server action, API route, or
   script — never from client-side/browser code.

## Picking the right function

| Function | Use for | Cost driver |
|---|---|---|
| `search()` | "Find businesses/pages matching X" — runs a web search, then scrapes+extracts each result | `num_results` (pages returned) |
| `extract()` | You already have the URL(s) and just want structured data pulled from them | number of URLs |
| `scrape()` | Just want raw markdown/HTML, no AI extraction | 1 page |
| `crawl()` | Walk a whole site (e.g. every page of a competitor's menu) and extract from each | `max_pages` |

## Credit budgeting

Free plan starts at 500 credits. In today's testing, `search()` with `num_results=11` and an
extraction prompt cost ~55 credits (~5 credits/page) — confirm the exact current rate on your
dashboard's Usage page, since pricing can change. Use `chooseNumResults(budget)` /
`choose_num_results(budget)` to cap a call automatically instead of guessing.

For recurring/scheduled scraping (e.g. bigbiteportal re-checking prospects weekly), budget
credits like an API cost line item — log `numResults` and estimated cost per run so you can
see usage trends before hitting a plan limit.

## Structured output

Always pass `extractionPrompt`/`extraction_prompt` (or `output_schema` for a strict JSON
Schema) rather than parsing the raw markdown yourself — this is what gave us clean
`{company_name, contact_email, phone_number, ...}` objects in today's run instead of having to
regex company names out of page text.

## Known limitation of this setup session

I (Claude, in this cloud sandbox) could not execute a *live* test call against
`api.scrapegraphai.com` from here — this sandbox's outbound network is allowlisted to a small
set of domains and blocks arbitrary hosts, and the API itself blocks direct browser `fetch()`
calls (no CORS headers), which is expected since it's designed for server-side use. So this
code is written to the documented API contract and mirrors the exact request/response shape
seen through the dashboard, but it hasn't been run end-to-end from this environment. **Run one
test call** (e.g. `search({userPrompt: "test", numResults: 3})`) after deploying to confirm
the field names still match — ScrapeGraphAI is on "V2" per their homepage banner, so double
check `docs.scrapegraphai.com` for any endpoint renames before wiring this into production.

## Multi-project note (bigbiteportal)

This Cowork session is scoped to the ComforterWash project folder only — I can't see or edit
bigbiteportal from here. To wire this into bigbiteportal:

- Open (or start) a Cowork session with bigbiteportal's folder connected, and paste/copy
  `scrapegraphai.ts` (or the Python client) into its `lib/`, or
- If both projects live in folders the desktop app can connect simultaneously, connect both
  and I can work across them in one session.

The client files here are intentionally dependency-free and self-contained so they copy
straight across projects with no changes beyond the env var.
