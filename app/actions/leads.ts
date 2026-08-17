"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

// ── Lead Finder ────────────────────────────────────────────────────────────
// Prospecting tool for commercial-account outreach (spas, gyms, Airbnb
// property managers, mom groups, etc.) backed by ScrapeGraphAI's
// searchScraper API. Deliberately separate from commercial-accounts.ts:
// commercial_accounts is a signed-up, billing customer; a "lead" here is
// just a prospect pulled from a web search, most of which never convert.
//
// searchScraper is async — POSTing a search returns a request_id in
// "queued"/"processing" state, not the results themselves. We store that
// request_id and let the admin UI poll checkLeadSearchStatus() every few
// seconds until it flips to "completed" (or "failed"), rather than holding
// a single serverless function open for however long the search takes
// (searches have taken 60-90+ seconds in manual testing — well past a
// typical Vercel function timeout).

const SGAI_BASE = "https://api.scrapegraphai.com/v1/searchscraper"

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
  const key = process.env.SGAI_API_KEY
  if (!key) throw new Error("SGAI_API_KEY env var not set — add it in Vercel project settings.")
  return key
}

// The exact shape we ask ScrapeGraphAI to return — an array of leads, each
// with the fields the admin UI displays. Sent as output_schema on the
// search request so extraction comes back pre-structured instead of us
// having to parse markdown/prose.
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
        user_prompt: `Find local ${cleanCategory} businesses in ${cleanGeoArea}. For each one, find the business name, an owner or manager's name if listed, a contact email address, a phone number, their website, and the geographic area they serve.`,
        num_results: clampedResults,
        extraction_mode: true,
        output_schema: LEADS_OUTPUT_SCHEMA,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      await supabase.from("lead_searches").update({ status: "failed", error: `ScrapeGraphAI ${res.status}: ${body.slice(0, 300)}` }).eq("id", searchRow.id)
      return { error: "The search failed to start. Check the ScrapeGraphAI API key and credit balance." }
    }

    const data = await res.json() as { request_id?: string; status?: string }
    await supabase
      .from("lead_searches")
      .update({ request_id: data.request_id ?? null, status: (data.status as string) ?? "processing" })
      .eq("id", searchRow.id)
  } catch (err) {
    await supabase.from("lead_searches").update({ status: "failed", error: String(err).slice(0, 300) }).eq("id", searchRow.id)
    return { error: "Couldn't reach ScrapeGraphAI. Try again in a moment." }
  }

  revalidatePath("/admin/leads")
  return { searchId: searchRow.id }
}

// ── Poll a search's status; parses + saves leads once completed ───────────
export async function checkLeadSearchStatus(searchId: string): Promise<{
  status: LeadSearch["status"]
  error?: string
  leadCount?: number
}> {
  await requireAdmin()

  const supabase = createAdminClient()
  const { data: search } = await supabase
    .from("lead_searches")
    .select("id, request_id, status, error")
    .eq("id", searchId)
    .single()

  if (!search) return { status: "failed", error: "Search not found." }
  if (search.status === "completed" || search.status === "failed") {
    return { status: search.status, error: search.error ?? undefined }
  }
  if (!search.request_id) return { status: "processing" }

  try {
    const res = await fetch(`${SGAI_BASE}/${search.request_id}`, {
      headers: { "SGAI-APIKEY": sgaiKey() },
    })
    if (!res.ok) return { status: "processing" } // transient — keep polling

    const data = await res.json() as {
      status?: string
      result?: { leads?: LeadResult[] }
      reference_urls?: string[]
      error?: string
    }

    if (data.status === "failed") {
      await supabase.from("lead_searches").update({ status: "failed", error: data.error ?? "Unknown error", completed_at: new Date().toISOString() }).eq("id", searchId)
      return { status: "failed", error: data.error ?? "Unknown error" }
    }

    if (data.status !== "completed") {
      await supabase.from("lead_searches").update({ status: "processing" }).eq("id", searchId)
      return { status: "processing" }
    }

    // Completed — parse + save leads, then mark the search done.
    const { data: searchMeta } = await supabase
      .from("lead_searches")
      .select("location_id, category")
      .eq("id", searchId)
      .single()

    const leads = data.result?.leads ?? []
    const refUrls = data.reference_urls ?? []
    if (leads.length && searchMeta) {
      const rows = leads
        .filter(l => l.business_name || l.email || l.phone)
        .map((l, i) => ({
          location_id: searchMeta.location_id,
          search_id: searchId,
          category: searchMeta.category,
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

    await supabase.from("lead_searches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", searchId)
    revalidatePath("/admin/leads")
    return { status: "completed", leadCount: leads.length }
  } catch (err) {
    return { status: "processing" } // network hiccup — keep polling, don't fail the whole search over it
  }
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
