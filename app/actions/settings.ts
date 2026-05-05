"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { DEFAULT_OFFERS, type LandingOffer } from "@/lib/offers-config"
import { DEFAULT_IMAGES, type SiteImages } from "@/lib/site-images-config"

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
