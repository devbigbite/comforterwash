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
