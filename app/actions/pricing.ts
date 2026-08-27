"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export interface PricingConfig {
  // Wash & Fold
  washFoldOneTimeCents: number   // default 240
  washFoldSubCents:     number   // default 215
  washFoldMinLbs:       number   // default 18
  // Wash Only
  washOnlyCents:        number   // default 199
  washOnlyMinLbs:       number   // default 18
  // Comforter — customer-facing prices. These are the "real" prices shown
  // struck-through on the promo page; comforterPromoCents is what's charged
  // while the flat-rate promo (see getComforterPromo) is active.
  comforterTwinCents:   number   // default 3500
  comforterFullCents:   number   // default 3700
  comforterQueenCents:  number   // default 3900
  comforterKingCents:   number   // default 4300
  comforterPromoCents:  number   // default 3300
  // Comforter — what the processing facility is paid per comforter
  // (app/actions/bookings.ts / facility-routing.ts, via
  // lib/facility-comforter-cost.ts). Independent of the customer prices
  // above — changing one does not change the other.
  comforterFacilityTwinCents:  number   // default 1300
  comforterFacilityFullCents:  number   // default 1360
  comforterFacilityQueenCents: number   // default 1440
  comforterFacilityKingCents:  number   // default 1590
  comforterFacilityPromoCents: number   // default 1300
}

const DEFAULTS: PricingConfig = {
  washFoldOneTimeCents: 255,
  washFoldSubCents:     245,
  washFoldMinLbs:       18,
  washOnlyCents:        219,
  washOnlyMinLbs:       18,
  comforterTwinCents:   3500,
  comforterFullCents:   3700,
  comforterQueenCents:  3900,
  comforterKingCents:   4300,
  comforterPromoCents:  3300,
  comforterFacilityTwinCents:  1300,
  comforterFacilityFullCents:  1360,
  comforterFacilityQueenCents: 1440,
  comforterFacilityKingCents:  1590,
  comforterFacilityPromoCents: 1300,
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
  comforterFacilityTwinCents:  "facility_comforter_twin_cents",
  comforterFacilityFullCents:  "facility_comforter_full_cents",
  comforterFacilityQueenCents: "facility_comforter_queen_cents",
  comforterFacilityKingCents:  "facility_comforter_king_cents",
  comforterFacilityPromoCents: "facility_comforter_promo_cents",
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

    const result = { ...DEFAULTS }
    for (const [field, dbKey] of Object.entries(KEY_MAP) as [keyof PricingConfig, string][]) {
      if (map[dbKey] !== undefined) {
        result[field] = parseInt(map[dbKey], 10) as never
      }
    }
    return result
  } catch {
    return DEFAULTS
  }
}

export async function setPricingConfig(config: PricingConfig): Promise<void> {
  await requireAdmin()
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
