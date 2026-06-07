"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { revalidatePath } from "next/cache"

export interface PricingConfig {
  // Wash & Fold
  washFoldOneTimeCents: number   // default 240
  washFoldSubCents:     number   // default 215
  washFoldMinLbs:       number   // default 20
  // Wash Only
  washOnlyCents:        number   // default 199
  washOnlyMinLbs:       number   // default 20
  // Comforter
  comforterTwinCents:   number   // default 2900
  comforterFullCents:   number   // default 3300
  comforterQueenCents:  number   // default 3800
  comforterKingCents:   number   // default 4300
  comforterPromoCents:  number   // default 3300
}

export const PRICING_DEFAULTS: PricingConfig = {
  washFoldOneTimeCents: 255,
  washFoldSubCents:     245,
  washFoldMinLbs:       20,
  washOnlyCents:        199,
  washOnlyMinLbs:       20,
  comforterTwinCents:   2900,
  comforterFullCents:   3300,
  comforterQueenCents:  3800,
  comforterKingCents:   4300,
  comforterPromoCents:  3300,
}

const KEY_MAP: Record<keyof PricingConfig, string> = {
  washFoldOneTimeCents: "wash_fold_one_time_cents",
  washFoldSubCents:     "wash_fold_sub_cents",
  washFoldMinLbs:       "wash_fold_min_lbs",
  washOnlyCents:        "wash_only_cents",
  washOnlyMinLbs:       "wash_only_min_lbs",
  comforterTwinCents:   "comforter_twin_cents",
  comforterFullCents:   "comforter_full_cents",
  comforterQueenCents:  "comforter_queen_cents",
  comforterKingCents:   "comforter_king_cents",
  comforterPromoCents:  "comforter_promo_cents",
}

export async function getPricingConfig(): Promise<PricingConfig> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const keys = Object.values(KEY_MAP)
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .eq("location_id", locationId)
      .in("key", keys)

    const map: Record<string, string> = {}
    for (const row of data ?? []) map[row.key] = row.value

    const result = { ...PRICING_DEFAULTS }
    for (const [field, dbKey] of Object.entries(KEY_MAP) as [keyof PricingConfig, string][]) {
      if (map[dbKey] !== undefined) {
        result[field] = parseInt(map[dbKey], 10) as never
      }
    }
    return result
  } catch {
    return PRICING_DEFAULTS
  }
}

export async function setPricingConfig(config: PricingConfig): Promise<void> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const rows = (Object.entries(KEY_MAP) as [keyof PricingConfig, string][]).map(
    ([field, dbKey]) => ({
      key: dbKey,
      value: String(config[field]),
      location_id: locationId,
      updated_at: new Date().toISOString(),
    })
  )
  await supabase.from("settings").upsert(rows, { onConflict: "location_id,key" })
  revalidatePath("/admin/pricing")
  revalidatePath("/book/wash-fold")
  revalidatePath("/book/wash-only")
  revalidatePath("/book/comforter-wash")
}
