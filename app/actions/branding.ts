"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, DEFAULT_BRANDING } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export interface BrandingSettings {
  business_name: string
  tagline: string | null
  logo_url: string | null
  primary_color: string
  accent_color: string
  support_phone: string
  support_email: string
  address: string
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("locations")
    .select("business_name, tagline, logo_url, primary_color, accent_color, support_phone, support_email, address")
    .eq("id", locationId)
    .single()

  if (!data) {
    return {
      business_name: DEFAULT_BRANDING.business_name,
      tagline: null,
      logo_url: null,
      primary_color: DEFAULT_BRANDING.primary_color,
      accent_color: DEFAULT_BRANDING.accent_color,
      support_phone: DEFAULT_BRANDING.support_phone,
      support_email: DEFAULT_BRANDING.support_email,
      address: DEFAULT_BRANDING.address,
    }
  }

  return {
    business_name: data.business_name ?? DEFAULT_BRANDING.business_name,
    tagline: data.tagline,
    logo_url: data.logo_url,
    primary_color: data.primary_color ?? DEFAULT_BRANDING.primary_color,
    accent_color: data.accent_color ?? DEFAULT_BRANDING.accent_color,
    support_phone: data.support_phone ?? DEFAULT_BRANDING.support_phone,
    support_email: data.support_email ?? DEFAULT_BRANDING.support_email,
    address: data.address ?? DEFAULT_BRANDING.address,
  }
}

export async function setBrandingSettings(settings: BrandingSettings): Promise<{ error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const hexPattern = /^#[0-9a-fA-F]{6}$/
  if (!hexPattern.test(settings.primary_color) || !hexPattern.test(settings.accent_color)) {
    return { error: "Colors must be valid hex codes (e.g. #0D2240)" }
  }
  if (!settings.business_name?.trim()) {
    return { error: "Business name is required" }
  }

  const { error } = await supabase
    .from("locations")
    .update({
      business_name: settings.business_name.trim(),
      tagline: settings.tagline?.trim() || null,
      logo_url: settings.logo_url?.trim() || null,
      primary_color: settings.primary_color,
      accent_color: settings.accent_color,
      support_phone: settings.support_phone?.trim() || null,
      support_email: settings.support_email?.trim() || null,
      address: settings.address?.trim() || null,
    })
    .eq("id", locationId)

  if (error) return { error: error.message }

  revalidatePath("/admin/branding")
  revalidatePath("/", "layout")
  return {}
}

// ── Delivery dispatch (Shipday) ───────────────────────────────────────────────
// Each tenant brings their own Shipday account for driver dispatch/tracking —
// isolated per business, no shared account across tenants.
export interface DispatchSettings {
  shipday_api_key: string
  business_address: string
  business_phone: string
}

export async function getDispatchSettings(): Promise<DispatchSettings> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("locations")
    .select("shipday_api_key, business_address, business_phone")
    .eq("id", locationId)
    .single()

  return {
    shipday_api_key: data?.shipday_api_key ?? "",
    business_address: data?.business_address ?? "",
    business_phone: data?.business_phone ?? "",
  }
}

export async function setDispatchSettings(settings: DispatchSettings): Promise<{ error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  const { error } = await supabase
    .from("locations")
    .update({
      shipday_api_key: settings.shipday_api_key?.trim() || null,
      business_address: settings.business_address?.trim() || null,
      business_phone: settings.business_phone?.trim() || null,
    })
    .eq("id", locationId)

  if (error) return { error: error.message }

  revalidatePath("/admin/branding")
  return {}
}

// ── Custom sending domain (Resend) ────────────────────────────────────────────
// A tenant can verify their own domain so booking/reminder emails come from
// their own brand (e.g. hello@theirbusiness.com) instead of the shared
// clean@washfoldorlando.com address. Verification happens with Resend via
// standard DNS records (SPF/DKIM/DMARC) the tenant adds at their own
// registrar — same one Resend account/API key is used for every tenant,
// this only concerns which domains are verified to send from it.
export interface EmailDomainStatus {
  domain: string | null
  status: "not_configured" | "not_started" | "pending" | "verified" | "failed" | "temporary_failure"
  records: { record: string; name: string; type: string; value: string; priority?: number; status?: string }[]
  fromEmail: string | null
}

export async function getEmailDomainStatus(): Promise<EmailDomainStatus> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("locations")
    .select("sending_domain, sending_domain_status, sending_domain_records, sending_email_local_part")
    .eq("id", locationId)
    .single()

  if (!data?.sending_domain) {
    return { domain: null, status: "not_configured", records: [], fromEmail: null }
  }

  return {
    domain: data.sending_domain,
    status: data.sending_domain_status ?? "not_configured",
    records: (data.sending_domain_records as EmailDomainStatus["records"]) ?? [],
    fromEmail: `${data.sending_email_local_part || "hello"}@${data.sending_domain}`,
  }
}

export async function addEmailDomain(domain: string): Promise<{ error?: string }> {
  await requireAdmin()
  const cleanDomain = domain.trim().toLowerCase()
  if (!cleanDomain || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(cleanDomain)) {
    return { error: "Enter a valid domain (e.g. mail.yourbusiness.com)" }
  }

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { createResendDomain } = await import("@/lib/resend-domains")

  try {
    const result = await createResendDomain(cleanDomain)
    await supabase
      .from("locations")
      .update({
        resend_domain_id: result.id,
        sending_domain: cleanDomain,
        sending_domain_status: result.status,
        sending_domain_records: result.records,
      })
      .eq("id", locationId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create domain with Resend" }
  }

  revalidatePath("/admin/branding")
  return {}
}

export async function checkEmailDomainVerification(): Promise<EmailDomainStatus & { error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("locations")
    .select("resend_domain_id, sending_domain, sending_email_local_part")
    .eq("id", locationId)
    .single()

  if (!data?.resend_domain_id || !data.sending_domain) {
    return { domain: null, status: "not_configured", records: [], fromEmail: null, error: "No domain configured yet" }
  }

  const { verifyResendDomain, getResendDomain } = await import("@/lib/resend-domains")

  try {
    await verifyResendDomain(data.resend_domain_id)
    const fresh = await getResendDomain(data.resend_domain_id)
    await supabase
      .from("locations")
      .update({ sending_domain_status: fresh.status, sending_domain_records: fresh.records })
      .eq("id", locationId)

    revalidatePath("/admin/branding")
    return {
      domain: data.sending_domain,
      status: fresh.status as EmailDomainStatus["status"],
      records: fresh.records,
      fromEmail: `${data.sending_email_local_part || "hello"}@${data.sending_domain}`,
    }
  } catch (err) {
    return {
      domain: data.sending_domain,
      status: "not_configured",
      records: [],
      fromEmail: null,
      error: err instanceof Error ? err.message : "Failed to check verification",
    }
  }
}

export async function removeEmailDomain(): Promise<{ error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("locations")
    .select("resend_domain_id")
    .eq("id", locationId)
    .single()

  if (data?.resend_domain_id) {
    const { deleteResendDomain } = await import("@/lib/resend-domains")
    try {
      await deleteResendDomain(data.resend_domain_id)
    } catch {
      // Continue clearing our own records even if Resend's side fails
      // (e.g. already deleted there) — don't leave the tenant stuck.
    }
  }

  await supabase
    .from("locations")
    .update({
      resend_domain_id: null,
      sending_domain: null,
      sending_domain_status: "not_configured",
      sending_domain_records: null,
    })
    .eq("id", locationId)

  revalidatePath("/admin/branding")
  return {}
}

export async function setEmailLocalPart(localPart: string): Promise<{ error?: string }> {
  await requireAdmin()
  const clean = localPart.trim().toLowerCase()
  if (!clean || !/^[a-z0-9._-]+$/.test(clean)) {
    return { error: "Enter a valid email prefix (letters, numbers, dots, hyphens only)" }
  }
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("locations").update({ sending_email_local_part: clean }).eq("id", locationId)
  revalidatePath("/admin/branding")
  return {}
}

// ── Admin view mode (Simple / Advanced) ───────────────────────────────────────
// Solo/home-based tenants can find the full admin overwhelming, so they land
// on a condensed "Simple" nav + dashboard by default. The full nav/dashboard
// (today's experience, unchanged) is always one click away as "Advanced".
// Persisted per-tenant on `locations` since each tenant has a single shared
// admin login, not per-user accounts.
export type AdminViewMode = "simple" | "advanced"

export async function getAdminViewMode(): Promise<AdminViewMode> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase.from("locations").select("admin_view_mode").eq("id", locationId).single()
  return (data?.admin_view_mode as AdminViewMode) ?? "simple"
}

export async function setAdminViewMode(mode: AdminViewMode): Promise<{ error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("locations").update({ admin_view_mode: mode }).eq("id", locationId)
  revalidatePath("/admin", "layout")
  return {}
}

// ── Operating mode (Facility / Home) ──────────────────────────────────────────
// Distinct from admin_view_mode (Simple/Advanced nav complexity) and
// fulfillment_mode (pickup-delivery vs walk-in) — this is about whether the
// business has a facility/staff/multiple drivers ("facility") or is one
// person working out of their own laundry room ("home"). Drives which nav
// sections show (Facility Board, Transfer Runs, Route Optimizer are
// meaningless with no facility) and whether a daily load cap applies.
export type OperatingMode = "facility" | "home"

export async function getOperatingMode(): Promise<OperatingMode> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase.from("locations").select("operating_mode").eq("id", locationId).single()
  return (data?.operating_mode as OperatingMode) ?? "facility"
}

export async function setOperatingMode(mode: OperatingMode): Promise<{ error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("locations").update({ operating_mode: mode, operating_mode_confirmed: true }).eq("id", locationId)
  revalidatePath("/admin", "layout")
  return {}
}

// Distinguishes "never asked" from "explicitly chose facility (the default)"
// so the Simple-hub setup checklist can nudge a tenant who never visited
// this setting at all, without falsely nagging one who deliberately kept it.
export async function getOperatingModeConfirmed(): Promise<boolean> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase.from("locations").select("operating_mode_confirmed").eq("id", locationId).single()
  return data?.operating_mode_confirmed ?? false
}

export async function getHomeDailyCapacity(): Promise<number | null> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase.from("locations").select("home_daily_capacity").eq("id", locationId).single()
  return data?.home_daily_capacity ?? null
}

export async function setHomeDailyCapacity(capacity: number | null): Promise<{ error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("locations").update({ home_daily_capacity: capacity }).eq("id", locationId)
  revalidatePath("/admin/branding")
  return {}
}

export async function uploadBrandLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const file = formData.get("file") as File
  if (!file || file.size === 0) return { error: "No file provided" }

  const ext = file.name.split(".").pop() ?? "png"
  const path = `logos/${locationId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from("site-images")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from("site-images").getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

  return { url: publicUrl }
}
