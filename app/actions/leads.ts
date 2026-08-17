"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

// ── Lead Finder ────────────────────────────────────────────────────────────
// Prospecting tool for commercial-account outreach (spas, gyms, Airbnb
// property managers, mom groups, etc.) backed by ScrapeGraphAI's
// v2 /search API. Deliberately separate from commercial-accounts.ts:
// commercial_accounts is a signed-up, billing customer; a "lead" here is
// just a prospect pulled from a web search, most of which never convert.
//
// NOTE: this used to target ScrapeGraphAI's v1 "searchScraper" endpoint
// (api.scrapegraphai.com/v1/searchscraper), which was an async job you'd
// poll by request_id. That endpoint now rejects v2-issued API keys with
// "Invalid API key" + a v1 deprecation notice. The current API
// (confirmed against ScrapeGraphAI's official SDK source, since the
// hosted docs pages 404 for the v2 reference) is a single SYNCHRONOUS
// call to v2-api.scrapegraphai.com/api/search — no request_id, no
// polling endpoint. We hold the request open for the duration of the
// search (searches have taken 60-90+ seconds in manual testing) and rely
// on `maxDuration` below to keep Vercel from timing the function out.
// checkLeadSearchStatus() is kept only so the existing client-side
// polling UI still works — it just reads back whatever startLeadSearch
// already wrote to Supabase, no external call.

// `maxDuration` can't live here — a "use server" file may only export async
// functions. It's set instead on app/admin/leads/page.tsx, which Next.js
// applies to Server Actions invoked from that route segment.

const SGAI_BASE = "https://v2-api.scrapegraphai.com/api/search"

type LeadResult = {
  business_name?: string
  contact_name?: string
  email?: string
  phone?: string
  website?: string
  service_area?: string
  source_url?: string
}

export interface LeadSearch {
  id: string
  category: string
  geo_area: string
  num_results: number
  status: "queued" | "processing" | "completed" | "failed"
  error: string | null
  created_at: string
  completed_at: string | null
  lead_count: number
}

export interface CommercialLead {
  id: string
  search_id: string | null
  category: string | null
  business_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  service_area: string | null
  source_url: string | null
  status: "new" | "contacted" | "responded" | "won" | "not_interested"
  notes: string | null
  created_at: string
}

function sgaiKey(): string {
  // Matches the name already set in Vercel project settings.
  const key = process.env.SCRAPEGRAPHAI_API_KEY
  if (!key) throw new Error("SCRAPEGRAPHAI_API_KEY env var not set — add it in Vercel project settings.")
  return key
}

// The exact shape we ask ScrapeGraphAI to return — an array of leads, each
// with the fields the admin UI displays. Sent as `schema` on the search
// request (v2 field name; was `output_schema` under v1) so extraction
// comes back pre-structured instead of us having to parse markdown/prose.
// v2 requires `prompt` to be set whenever `schema` is set.
const LEADS_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    leads: {
      type: "array",
      items: {
        type: "object",
        properties: {
          business_name: { type: "string", description: "Name of the business" },
          contact_name:  { type: "string", description: "Owner or manager's name, if listed" },
          email:         { type: "string", description: "A contact email address, if listed" },
          phone:         { type: "string", description: "A contact phone number, if listed" },
          website:       { type: "string", description: "The business's website URL" },
          service_area:  { type: "string", description: "The geographic area they serve, if stated" },
        },
      },
    },
  },
  required: ["leads"],
}

// ── Start a search ───────────────────────────────────────────────────────
export async function startLeadSearch(
  category: string,
  geoArea: string,
  numResults: number,
): Promise<{ searchId: string } | { error: string }> {
  await requireAdmin()

  const cleanCategory = category.trim()
  const cleanGeoArea  = geoArea.trim()
  if (!cleanCategory) return { error: "Enter a lead category (e.g. \"local spas\")." }
  if (!cleanGeoArea) return { error: "Enter a geographic area (e.g. \"Orlando, FL\")." }
  const clampedResults = Math.min(20, Math.max(3, Math.round(numResults) || 10))

  const locationId = await getLocationId()
  const supabase = createAdminClient()

  const { data: searchRow, error: insertError } = await supabase
    .from("lead_searches")
    .insert({
      location_id: locationId,
      category: cleanCategory,
      geo_area: cleanGeoArea,
      num_results: clampedResults,
      status: "queued",
    })
    .select("id")
    .single()

  if (insertError || !searchRow) return { error: "Couldn't save the search. Try again." }

  try {
    const res = await fetch(SGAI_BASE, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "SGAI-APIKEY": sgaiKey(),
      },
      body: JSON.stringify({
        // v2 field names — `query` is the short search query, `prompt` is
        // the extraction instruction paired with `schema`. (v1 used a
        // single `user_prompt` + `output_schema` + `extraction_mode`,
        // none of which the v2 endpoint accepts.)
        query: `local ${cleanCategory} businesses in ${cleanGeoArea}`,
        prompt: `Find local ${cleanCategory} businesses in ${cleanGeoArea}. For each one, find the business name, an owner or manager's name if listed, a contact email address, a phone number, their website, and the geographic area they serve.`,
        num_results: clampedResults,
        schema: LEADS_OUTPUT_SCHEMA,
        location_geo_code: "us",
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      await supabase.from("lead_searches").update({ status: "failed", error: `ScrapeGraphAI ${res.status}: ${body.slice(0, 300)}`, completed_at: new Date().toISOString() }).eq("id", searchRow.id)
      return { error: "The search failed to start. Check the ScrapeGraphAI API key and credit balance." }
    }

    // v2 /search is synchronous — the full result comes back in this same
    // response, not via a request_id you poll later.
    const data = await res.json() as {
      json_data?: { leads?: LeadResult[] }
      json?: { leads?: LeadResult[] }
      results?: { url?: string }[]
    }
    const leads = data.json_data?.leads ?? data.json?.leads ?? []
    const refUrls = (data.results ?? []).map(r => r.url).filter((u): u is string => !!u)

    if (leads.length) {
      const rows = leads
        .filter(l => l.business_name || l.email || l.phone)
        .map((l, i) => ({
          location_id: locationId,
          search_id: searchRow.id,
          category: cleanCategory,
          business_name: l.business_name ?? null,
          contact_name: l.contact_name ?? null,
          email: l.email ?? null,
          phone: l.phone ?? null,
          website: l.website ?? null,
          service_area: l.service_area ?? null,
          source_url: l.source_url ?? refUrls[i] ?? null,
        }))
      if (rows.length) await supabase.from("commercial_leads").insert(rows)
    }

    await supabase
      .from("lead_searches")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", searchRow.id)
  } catch (err) {
    await supabase.from("lead_searches").update({ status: "failed", error: String(err).slice(0, 300), completed_at: new Date().toISOString() }).eq("id", searchRow.id)
    return { error: "Couldn't reach ScrapeGraphAI. Try again in a moment." }
  }

  revalidatePath("/admin/leads")
  return { searchId: searchRow.id }
}

// ── Check a search's status ────────────────────────────────────────────
// startLeadSearch() above now runs synchronously and writes the final
// status (completed/failed) before returning, so this no longer calls out
// to ScrapeGraphAI or polls by request_id — it just reads back what's in
// Supabase. Kept as-is so the existing client-side polling UI in
// lead-search-form.tsx (which calls this every few seconds after
// submitting) keeps working without changes; it'll just see "completed"
// or "failed" on its first check.
export async function checkLeadSearchStatus(searchId: string): Promise<{
  status: LeadSearch["status"]
  error?: string
  leadCount?: number
}> {
  await requireAdmin()

  const supabase = createAdminClient()
  const { data: search } = await supabase
    .from("lead_searches")
    .select("id, status, error")
    .eq("id", searchId)
    .single()

  if (!search) return { status: "failed", error: "Search not found." }

  if (search.status === "completed") {
    const { count } = await supabase
      .from("commercial_leads")
      .select("id", { count: "exact", head: true })
      .eq("search_id", searchId)
    return { status: "completed", leadCount: count ?? 0 }
  }

  return { status: search.status as LeadSearch["status"], error: search.error ?? undefined }
}

// ── Reads ───────────────────────────────────────────────────────────────
export async function getLeadSearches(): Promise<LeadSearch[]> {
  await requireAdmin()
  const locationId = await getLocationId()
  const supabase = createAdminClient()

  const { data: searches } = await supabase
    .from("lead_searches")
    .select("id, category, geo_area, num_results, status, error, created_at, completed_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (!searches?.length) return []

  const { data: counts } = await supabase
    .from("commercial_leads")
    .select("search_id")
    .in("search_id", searches.map(s => s.id))

  const countBySearch = new Map<string, number>()
  for (const row of counts ?? []) {
    if (!row.search_id) continue
    countBySearch.set(row.search_id, (countBySearch.get(row.search_id) ?? 0) + 1)
  }

  return searches.map(s => ({ ...s, lead_count: countBySearch.get(s.id) ?? 0 })) as LeadSearch[]
}

export async function getLeads(searchId?: string): Promise<CommercialLead[]> {
  await requireAdmin()
  const locationId = await getLocationId()
  const supabase = createAdminClient()

  let query = supabase
    .from("commercial_leads")
    .select("id, search_id, category, business_name, contact_name, email, phone, website, service_area, source_url, status, notes, created_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })

  if (searchId) query = query.eq("search_id", searchId)

  const { data } = await query.limit(500)
  return (data ?? []) as CommercialLead[]
}

export async function updateLeadStatus(leadId: string, status: CommercialLead["status"]): Promise<void> {
  await requireAdmin()
  const supabase = createAdminClient()
  await supabase.from("commercial_leads").update({ status }).eq("id", leadId)
  revalidatePath("/admin/leads")
}
