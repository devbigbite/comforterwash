"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { DEFAULT_OFFERS, type LandingOffer } from "@/lib/offers-config"

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
