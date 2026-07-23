"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { getLocationId } from "@/lib/location"
import { DEFAULT_OFFERS, type LandingOffer } from "@/lib/offers-config"
import { DEFAULT_IMAGES, type SiteImages } from "@/lib/site-images-config"
import { DEFAULT_TEXT, type SiteText } from "@/lib/site-text-config"
import { requireAdmin } from "@/lib/auth-guard"

// ── Internal helper: upsert a setting key for the current location ────────────
async function upsertSetting(key: string, value: string, locationId: string) {
  const supabase = createAdminClient()
  await supabase.from("settings").upsert(
    { key, value, location_id: locationId, updated_at: new Date().toISOString() },
    { onConflict: "location_id,key" }
  )
}

// ── Comforter Promo ───────────────────────────────────────────────────────────

export async function getComforterPromo(): Promise<boolean> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("location_id", locationId)
      .eq("key", "comforter_flat_rate_promo")
      .single()
    return data?.value === "true"
  } catch {
    return false
  }
}

export async function setComforterPromo(active: boolean): Promise<void> {
  await requireAdmin()

  const locationId = await getLocationId()
  await upsertSetting("comforter_flat_rate_promo", active ? "true" : "false", locationId)
  revalidatePath("/admin/promos")
  revalidatePath("/admin/settings")
}

// ── Landing Offers ────────────────────────────────────────────────────────────

export async function getLandingOffers(): Promise<LandingOffer[]> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("location_id", locationId)
      .like("key", "landing_offer_%")
    const offers: LandingOffer[] = DEFAULT_OFFERS.map(o => ({ ...o }))
    if (data) {
      data.forEach(({ key, value }: { key: string; value: string }) => {
        const match = key.match(/^landing_offer_(\d+)_(.+)$/)
        if (!match) return
        const idx = parseInt(match[1]) - 1
        const field = match[2]
        if (idx < 0 || idx > 2) return
        if (field === "enabled") offers[idx].enabled = value === "true"
        else if (field === "badge") offers[idx].badge = value
        else if (field === "title") offers[idx].title = value
        else if (field === "desc") offers[idx].desc = value
      })
    }
    return offers
  } catch {
    return DEFAULT_OFFERS.map(o => ({ ...o }))
  }
}

export async function setLandingOffer(index: number, offer: LandingOffer): Promise<void> {
  await requireAdmin()

  const locationId = await getLocationId()
  const n = index + 1
  const supabase = createAdminClient()
  await supabase.from("settings").upsert(
    [
      { key: `landing_offer_${n}_enabled`, value: offer.enabled ? "true" : "false", location_id: locationId },
      { key: `landing_offer_${n}_badge`,   value: offer.badge,   location_id: locationId },
      { key: `landing_offer_${n}_title`,   value: offer.title,   location_id: locationId },
      { key: `landing_offer_${n}_desc`,    value: offer.desc,    location_id: locationId },
    ],
    { onConflict: "location_id,key" }
  )
  revalidatePath("/")
  revalidatePath("/admin/promos")
}

// ── Site Images ───────────────────────────────────────────────────────────────

export async function getSiteImages(): Promise<SiteImages> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("location_id", locationId)
      .like("key", "img_%")
    const images: SiteImages = { ...DEFAULT_IMAGES }
    if (data) {
      data.forEach(({ key, value }: { key: string; value: string }) => {
        const imgKey = key.replace(/^img_/, "") as keyof SiteImages
        if (imgKey in images && value) images[imgKey] = value
      })
    }
    return images
  } catch {
    return { ...DEFAULT_IMAGES }
  }
}

export async function uploadSiteImage(key: string, formData: FormData): Promise<string> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const file = formData.get("file") as File
  if (!file || file.size === 0) throw new Error("No file provided")

  const ext = file.name.split(".").pop() ?? "jpg"
  const storagePath = `${key}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from("site-images")
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from("site-images").getPublicUrl(storagePath)
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

  await supabase.from("settings").upsert(
    { key: `img_${key}`, value: publicUrl, location_id: locationId, updated_at: new Date().toISOString() },
    { onConflict: "location_id,key" }
  )

  revalidatePath("/")
  revalidatePath("/admin/images")
  return publicUrl
}

export async function resetSiteImage(key: string): Promise<void> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("settings").delete().eq("location_id", locationId).eq("key", `img_${key}`)
  revalidatePath("/")
  revalidatePath("/admin/images")
}

// ── Site Text ─────────────────────────────────────────────────────────────────

export async function getSiteText(): Promise<SiteText> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("location_id", locationId)
      .like("key", "txt_%")
    const text: SiteText = { ...DEFAULT_TEXT }
    if (data) {
      data.forEach(({ key, value }: { key: string; value: string }) => {
        const textKey = key.replace(/^txt_/, "") as keyof SiteText
        if (textKey in text && value) text[textKey] = value
      })
    }
    return text
  } catch {
    return { ...DEFAULT_TEXT }
  }
}

export async function setSiteTextValue(key: keyof SiteText, value: string): Promise<void> {
  await requireAdmin()

  const locationId = await getLocationId()
  await upsertSetting(`txt_${key}`, value, locationId)
  revalidatePath("/")
  revalidatePath("/admin/images")
}

export async function resetSiteText(key: keyof SiteText): Promise<void> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("settings").delete().eq("location_id", locationId).eq("key", `txt_${key}`)
  revalidatePath("/")
  revalidatePath("/admin/images")
}

// ── Service Area Polygon ──────────────────────────────────────────────────────

export async function getServiceAreaPolygon(): Promise<object | null> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("location_id", locationId)
      .eq("key", "service_area_polygon")
      .single()
    if (!data?.value) return null
    return JSON.parse(data.value)
  } catch {
    return null
  }
}

export async function setServiceAreaPolygon(geojson: object): Promise<void> {
  await requireAdmin()

  const locationId = await getLocationId()
  await upsertSetting("service_area_polygon", JSON.stringify(geojson), locationId)
  revalidatePath("/service-areas")
  revalidatePath("/admin/service-area")
}

export async function deleteServiceAreaPolygon(): Promise<void> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("settings").delete().eq("location_id", locationId).eq("key", "service_area_polygon")
  revalidatePath("/service-areas")
  revalidatePath("/admin/service-area")
}

// ── Delivery Fee (per service) ────────────────────────────────────────────────

export interface DeliveryFeeSettings {
  comforterCents: number   // flat fee for comforter wash (0 = no fee)
  washFoldCents:  number   // flat fee for wash & fold   (0 = no fee)
  washOnlyCents:  number   // flat fee for wash only     (0 = no fee)
}

const DELIVERY_FEE_KEYS = [
  "delivery_fee_comforter_cents",
  "delivery_fee_washfold_cents",
  "delivery_fee_washonly_cents",
] as const

export async function getDeliveryFeeSettings(): Promise<DeliveryFeeSettings> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("location_id", locationId)
      .in("key", [...DELIVERY_FEE_KEYS])
    const map: Record<string, string> = {}
    data?.forEach(({ key, value }: { key: string; value: string }) => { map[key] = value })
    return {
      comforterCents: parseInt(map["delivery_fee_comforter_cents"] ?? "0"),
      washFoldCents:  parseInt(map["delivery_fee_washfold_cents"]  ?? "0"),
      washOnlyCents:  parseInt(map["delivery_fee_washonly_cents"]   ?? "0"),
    }
  } catch {
    return { comforterCents: 0, washFoldCents: 0, washOnlyCents: 0 }
  }
}

export async function setDeliveryFeeSettings(settings: DeliveryFeeSettings): Promise<void> {
  await requireAdmin()

  const locationId = await getLocationId()
  const supabase = createAdminClient()
  await supabase.from("settings").upsert(
    [
      { key: "delivery_fee_comforter_cents", value: String(settings.comforterCents), location_id: locationId, updated_at: new Date().toISOString() },
      { key: "delivery_fee_washfold_cents",  value: String(settings.washFoldCents),  location_id: locationId, updated_at: new Date().toISOString() },
      { key: "delivery_fee_washonly_cents",  value: String(settings.washOnlyCents),  location_id: locationId, updated_at: new Date().toISOString() },
    ],
    { onConflict: "location_id,key" }
  )
  revalidatePath("/admin/pricing")
}

// ── Services Enabled ──────────────────────────────────────────────────────────

export interface ServicesConfig {
  comforter_wash: boolean
  wash_fold:      boolean
  wash_only:      boolean
}

export async function getServicesConfig(): Promise<ServicesConfig> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("location_id", locationId)
      .in("key", ["service_comforter_wash", "service_wash_fold", "service_wash_only"])
    const map: Record<string, string> = {}
    data?.forEach(({ key, value }: { key: string; value: string }) => { map[key] = value })
    return {
      comforter_wash: map["service_comforter_wash"] !== "false",
      wash_fold:      map["service_wash_fold"]      !== "false",
      wash_only:      map["service_wash_only"]      !== "false",
    }
  } catch {
    return { comforter_wash: true, wash_fold: true, wash_only: true }
  }
}

export async function setServicesConfig(config: ServicesConfig): Promise<void> {
  await requireAdmin()

  const locationId = await getLocationId()
  const supabase = createAdminClient()
  await supabase.from("settings").upsert(
    [
      { key: "service_comforter_wash", value: config.comforter_wash ? "true" : "false", location_id: locationId, updated_at: new Date().toISOString() },
      { key: "service_wash_fold",      value: config.wash_fold      ? "true" : "false", location_id: locationId, updated_at: new Date().toISOString() },
      { key: "service_wash_only",      value: config.wash_only      ? "true" : "false", location_id: locationId, updated_at: new Date().toISOString() },
    ],
    { onConflict: "location_id,key" }
  )
  revalidatePath("/")
  revalidatePath("/admin/pricing")
}

// ── Warehouse ─────────────────────────────────────────────────────────────────

export interface WarehouseSettings {
  name: string
  address: string
}

export async function getWarehouseSettings(): Promise<WarehouseSettings> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("location_id", locationId)
      .in("key", ["warehouse_name", "warehouse_address"])
    const map: Record<string, string> = {}
    data?.forEach(({ key, value }: { key: string; value: string }) => { map[key] = value })
    return {
      name:    map["warehouse_name"]    ?? "WashFold Warehouse",
      address: map["warehouse_address"] ?? "",
    }
  } catch {
    return { name: "WashFold Warehouse", address: "" }
  }
}

export async function setWarehouseSettings(name: string, address: string): Promise<void> {
  await requireAdmin()

  const locationId = await getLocationId()
  const supabase = createAdminClient()
  await supabase.from("settings").upsert(
    [
      { key: "warehouse_name",    value: name,    location_id: locationId, updated_at: new Date().toISOString() },
      { key: "warehouse_address", value: address, location_id: locationId, updated_at: new Date().toISOString() },
    ],
    { onConflict: "location_id,key" }
  )
  revalidatePath("/admin/settings")
  revalidatePath("/driver")
  revalidatePath("/operator")
}

// ─── Monthly Plan toggle ──────────────────────────────────────────────────────

export async function getMonthlyPlanEnabled(): Promise<boolean> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "monthly_plan_enabled")
    .eq("location_id", locationId)
    .maybeSingle()
  return data?.value !== "false"   // default true
}

export async function setMonthlyPlanEnabled(enabled: boolean): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()
  const locationId = await getLocationId()
  await supabase.from("settings").upsert(
    { key: "monthly_plan_enabled", value: String(enabled), location_id: locationId, updated_at: new Date().toISOString() },
    { onConflict: "location_id,key" }
  )
  revalidatePath("/admin/settings")
  revalidatePath("/pricing")
}

export async function getFreePickupDeliveryLineEnabled(): Promise<boolean> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "free_pickup_delivery_line_enabled")
    .eq("location_id", locationId)
    .maybeSingle()
  return data?.value !== "false"   // default true
}

export async function setFreePickupDeliveryLineEnabled(enabled: boolean): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()
  const locationId = await getLocationId()
  await supabase.from("settings").upsert(
    { key: "free_pickup_delivery_line_enabled", value: String(enabled), location_id: locationId, updated_at: new Date().toISOString() },
    { onConflict: "location_id,key" }
  )
  revalidatePath("/admin/settings")
}

export async function getTipsEnabled(): Promise<boolean> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "tips_enabled")
    .eq("location_id", locationId)
    .maybeSingle()
  return data?.value !== "false"   // default true
}

export async function setTipsEnabled(enabled: boolean): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()
  const locationId = await getLocationId()
  await supabase.from("settings").upsert(
    { key: "tips_enabled", value: String(enabled), location_id: locationId, updated_at: new Date().toISOString() },
    { onConflict: "location_id,key" }
  )
  revalidatePath("/admin/pricing")
}

// ── Public zip-code check (used by the landing-page ZipChecker widget) ────────
// This used to run as a raw anon-client query directly from the browser with
// no location_id filter — since the underlying RLS policy on service_areas is
// "public read, no restriction", that meant a customer on any tenant's site
// could get a false "yes we serve you" based on ANY tenant's zip list. Routing
// it through a server action scopes the lookup to the current request's
// tenant via getLocationId().
export async function checkZipServiceable(zip: string): Promise<boolean> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("service_areas")
    .select("zip_code")
    .eq("zip_code", zip)
    .eq("location_id", locationId)
    .eq("active", true)
    .maybeSingle()
  return !!data
}
