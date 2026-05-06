"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { DEFAULT_OFFERS, type LandingOffer } from "@/lib/offers-config"
import { DEFAULT_IMAGES, type SiteImages } from "@/lib/site-images-config"
import { DEFAULT_TEXT, type SiteText } from "@/lib/site-text-config"

export async function getComforterPromo(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "comforter_flat_rate_promo")
      .single()
    return data?.value === "true"
  } catch {
    return false
  }
}

export async function setComforterPromo(active: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from("settings").upsert({
    key: "comforter_flat_rate_promo",
    value: active ? "true" : "false",
    updated_at: new Date().toISOString(),
  })
  revalidatePath("/admin/promos")
  revalidatePath("/admin/settings")
}

export async function getLandingOffers(): Promise<LandingOffer[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("key,value")
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
  const supabase = await createClient()
  const n = index + 1
  await supabase.from("settings").upsert([
    { key: `landing_offer_${n}_enabled`, value: offer.enabled ? "true" : "false" },
    { key: `landing_offer_${n}_badge`, value: offer.badge },
    { key: `landing_offer_${n}_title`, value: offer.title },
    { key: `landing_offer_${n}_desc`, value: offer.desc },
  ])
  revalidatePath("/")
  revalidatePath("/admin/promos")
}

// ── Site Images ──────────────────────────────────────────────────────────────

export async function getSiteImages(): Promise<SiteImages> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("key,value")
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
  const supabase = await createClient()
  const file = formData.get("file") as File
  if (!file || file.size === 0) throw new Error("No file provided")

  const ext = file.name.split(".").pop() ?? "jpg"
  const filename = `${key}.${ext}?t=${Date.now()}`
  const storagePath = `${key}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from("site-images")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage
    .from("site-images")
    .getPublicUrl(storagePath)

  // Bust CDN cache with a timestamp query param
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

  await supabase.from("settings").upsert({
    key: `img_${key}`,
    value: publicUrl,
    updated_at: new Date().toISOString(),
  })

  revalidatePath("/")
  revalidatePath("/admin/images")
  void filename // silence unused var
  return publicUrl
}

export async function resetSiteImage(key: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from("settings").delete().eq("key", `img_${key}`)
  revalidatePath("/")
  revalidatePath("/admin/images")
}

// ── Site Text ────────────────────────────────────────────────────────────────

export async function getSiteText(): Promise<SiteText> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("key,value")
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
  const supabase = await createClient()
  await supabase.from("settings").upsert({
    key: `txt_${key}`,
    value,
    updated_at: new Date().toISOString(),
  })
  revalidatePath("/")
  revalidatePath("/admin/images")
}

export async function resetSiteText(key: keyof SiteText): Promise<void> {
  const supabase = await createClient()
  await supabase.from("settings").delete().eq("key", `txt_${key}`)
  revalidatePath("/")
  revalidatePath("/admin/images")
}

// ── Delivery Fee ─────────────────────────────────────────────────────────────

export interface DeliveryFeeSettings {
  enabled: boolean
  feeCents: number      // flat fee amount
  waiverCents: number   // free above this order subtotal (0 = always charge)
}

export async function getDeliveryFeeSettings(): Promise<DeliveryFeeSettings> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", ["delivery_fee_enabled", "delivery_fee_cents", "delivery_fee_waiver_cents"])
    const map: Record<string, string> = {}
    data?.forEach(({ key, value }: { key: string; value: string }) => { map[key] = value })
    return {
      enabled: map["delivery_fee_enabled"] === "true",
      feeCents: parseInt(map["delivery_fee_cents"] ?? "499"),
      waiverCents: parseInt(map["delivery_fee_waiver_cents"] ?? "0"),
    }
  } catch {
    return { enabled: false, feeCents: 499, waiverCents: 0 }
  }
}

export async function setDeliveryFeeSettings(settings: DeliveryFeeSettings): Promise<void> {
  const supabase = await createClient()
  await supabase.from("settings").upsert([
    { key: "delivery_fee_enabled", value: settings.enabled ? "true" : "false", updated_at: new Date().toISOString() },
    { key: "delivery_fee_cents", value: String(settings.feeCents), updated_at: new Date().toISOString() },
    { key: "delivery_fee_waiver_cents", value: String(settings.waiverCents), updated_at: new Date().toISOString() },
  ])
  revalidatePath("/admin/pricing")
}

// ── Staff PINs ────────────────────────────────────────────────────────────────
export async function getStaffPins(): Promise<{ driverPin: string; operatorPin: string }> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", ["driver_pin", "operator_pin"])
    const map: Record<string, string> = {}
    data?.forEach(({ key, value }: { key: string; value: string }) => { map[key] = value })
    return {
      driverPin:   map["driver_pin"]   ?? "1234",
      operatorPin: map["operator_pin"] ?? "1234",
    }
  } catch {
    return { driverPin: "1234", operatorPin: "1234" }
  }
}

export async function setStaffPin(role: "driver" | "operator", pin: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from("settings").upsert({
    key: `${role}_pin`,
    value: pin,
    updated_at: new Date().toISOString(),
  })
  revalidatePath("/admin/pricing")
}

export async function verifyStaffPin(role: "driver" | "operator", pin: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", `${role}_pin`)
      .single()
    const stored = data?.value ?? "1234"
    return pin === stored
  } catch {
    return pin === "1234"
  }
}
