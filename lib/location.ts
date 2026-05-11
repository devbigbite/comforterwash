/**
 * lib/location.ts
 *
 * Helpers for resolving the current tenant location in server components,
 * server actions, and API routes.
 *
 * The middleware sets x-location-id on every request after resolving the
 * subdomain / custom domain. All server-side code reads from that header.
 */

import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"

// ── Fallback: WashFold Orlando (the original location) ───────────────────────
// Used during local dev and as a safe default when no header is present.
export const ORLANDO_LOCATION_ID = "8b95bcee-d145-4d74-974c-ff3745aeff01"

export interface Location {
  id: string
  slug: string
  name: string
  custom_domain: string | null
  status: "active" | "inactive" | "suspended"
  plan: string | null
}

// ── Get just the location_id (most common use case) ──────────────────────────
export async function getLocationId(): Promise<string> {
  const h = await headers()
  return h.get("x-location-id") ?? ORLANDO_LOCATION_ID
}

// ── Get the full location object ─────────────────────────────────────────────
export async function getLocation(): Promise<Location | null> {
  const locationId = await getLocationId()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, custom_domain, status, plan")
    .eq("id", locationId)
    .single()
  return data as Location | null
}

// ── Used in middleware (edge-safe, no next/headers) ───────────────────────────
// Resolves a hostname to a location_id by slug or custom_domain.
// Returns null if no match found.
export async function resolveLocationFromHost(
  hostname: string,
  platformDomain: string, // e.g. "washfold.com"
): Promise<{ id: string; slug: string; name: string } | null> {
  const supabase = createAdminClient()

  // Strip www
  const host = hostname.replace(/^www\./, "").toLowerCase()

  // Check if it's a subdomain: orlando.washfold.com → slug = "orlando"
  const subdomainMatch = host.match(new RegExp(`^([a-z0-9-]+)\\.${platformDomain.replace(".", "\\.")}$`))

  let query = supabase.from("locations").select("id, slug, name").eq("status", "active")

  if (subdomainMatch) {
    query = query.eq("slug", subdomainMatch[1])
  } else {
    // Try custom domain match
    query = query.eq("custom_domain", host)
  }

  const { data } = await query.single()
  return data ?? null
}
