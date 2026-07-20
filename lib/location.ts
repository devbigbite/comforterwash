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
  business_name: string | null
  tagline: string | null
  logo_url: string | null
  primary_color: string
  accent_color: string
  support_phone: string | null
  support_email: string | null
  address: string | null
}

// ── Fallback branding — used only if a location row is somehow missing these
// fields (should never happen once seeded, but keeps pages from breaking) ────
export const DEFAULT_BRANDING = {
  business_name: "WashFold Orlando",
  tagline: null as string | null,
  logo_url: null as string | null,
  primary_color: "#0D2240",
  accent_color: "#E8726A",
  support_phone: "+14073002999",
  support_email: "hello@washfoldorlando.com",
  address: "10524 Moss Park Rd, Ste 204177, Orlando, FL 32832",
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
    .select("id, slug, name, custom_domain, status, plan, business_name, tagline, logo_url, primary_color, accent_color, support_phone, support_email, address")
    .eq("id", locationId)
    .single()
  if (!data) return null
  return {
    ...data,
    business_name: data.business_name ?? DEFAULT_BRANDING.business_name,
    primary_color: data.primary_color ?? DEFAULT_BRANDING.primary_color,
    accent_color:  data.accent_color  ?? DEFAULT_BRANDING.accent_color,
    support_phone: data.support_phone ?? DEFAULT_BRANDING.support_phone,
    support_email: data.support_email ?? DEFAULT_BRANDING.support_email,
    address:       data.address       ?? DEFAULT_BRANDING.address,
  } as Location
}

// ── Get just the branding subset (cheap, for headers/footers/emails) ─────────
export async function getBranding() {
  const loc = await getLocation()
  if (!loc) return DEFAULT_BRANDING
  return {
    business_name: loc.business_name ?? DEFAULT_BRANDING.business_name,
    tagline:       loc.tagline,
    logo_url:      loc.logo_url,
    primary_color: loc.primary_color,
    accent_color:  loc.accent_color,
    support_phone: loc.support_phone ?? DEFAULT_BRANDING.support_phone,
    support_email: loc.support_email ?? DEFAULT_BRANDING.support_email,
    address:       loc.address ?? DEFAULT_BRANDING.address,
  }
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
