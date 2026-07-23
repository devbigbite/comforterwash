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

// ── Fallback branding — only used when getLocationId() can't resolve a row
// at all (shouldn't happen once middleware is set up). Deliberately generic,
// NOT WashFold-specific, so a new tenant never silently inherits WashFold
// Orlando's name/phone/email if something's misconfigured.
export const DEFAULT_BRANDING = {
  business_name: "WashFoldClean",
  tagline: null as string | null,
  logo_url: null as string | null,
  primary_color: "#0D2240",
  accent_color: "#E8726A",
  support_phone: null as string | null,
  support_email: null as string | null,
  address: null as string | null,
}

// ── Get just the location_id (most common use case) ──────────────────────────
export async function getLocationId(): Promise<string> {
  const h = await headers()
  return h.get("x-location-id") ?? ORLANDO_LOCATION_ID
}

// ── Get the full location object ─────────────────────────────────────────────
// Pass an explicit `overrideLocationId` when resolving branding for a tenant
// OTHER than the one the current request is scoped to — e.g. super-admin
// sending an invite email for a tenant it isn't currently browsing as.
// Without it, this falls back to the ambient request's location (the normal
// case for every customer/tenant-facing page).
export async function getLocation(overrideLocationId?: string): Promise<Location | null> {
  const locationId = overrideLocationId ?? (await getLocationId())
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, custom_domain, status, plan, business_name, tagline, logo_url, primary_color, accent_color, support_phone, support_email, address")
    .eq("id", locationId)
    .single()
  if (!data) return null
  // business_name falls back to the location's own `name` (always set at
  // creation) — never to another tenant's branding defaults.
  return {
    ...data,
    business_name: data.business_name ?? data.name,
    primary_color: data.primary_color ?? DEFAULT_BRANDING.primary_color,
    accent_color:  data.accent_color  ?? DEFAULT_BRANDING.accent_color,
  } as Location
}

// ── Get just the branding subset (cheap, for headers/footers/emails) ─────────
export async function getBranding(overrideLocationId?: string) {
  const loc = await getLocation(overrideLocationId)
  if (!loc) return DEFAULT_BRANDING
  return {
    business_name: loc.business_name ?? loc.name,
    tagline:       loc.tagline,
    logo_url:      loc.logo_url,
    primary_color: loc.primary_color,
    accent_color:  loc.accent_color,
    support_phone: loc.support_phone,
    support_email: loc.support_email,
    address:       loc.address,
  }
}

// ── Per-tenant Shipday credentials + facility contact info ───────────────────
// Each tenant brings their own Shipday account (their own API key) so driver
// dispatch/tracking is fully isolated per business — no shared account across
// tenants. Orlando is the one exception: until its own row is filled in via
// the admin settings UI, it keeps working off the original global env vars
// it's always used, so nothing breaks for the existing business.
export interface ShipdayConfig {
  apiKey: string | null
  facilityAddress: string
  facilityPhone: string
}

export async function getShipdayConfig(): Promise<ShipdayConfig> {
  const locationId = await getLocationId()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("shipday_api_key, business_address, business_phone")
    .eq("id", locationId)
    .single()

  const isOrlando = locationId === ORLANDO_LOCATION_ID

  return {
    apiKey: data?.shipday_api_key ?? (isOrlando ? process.env.SHIPDAY_API_KEY ?? null : null),
    facilityAddress: data?.business_address ?? (isOrlando ? process.env.BUSINESS_ADDRESS ?? "Orlando, FL" : "Orlando, FL"),
    facilityPhone: data?.business_phone ?? (isOrlando ? process.env.BUSINESS_PHONE ?? "" : ""),
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
