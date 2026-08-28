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

// ── Wash & Fold — By-the-Bag pricing (alternative to per-pound) ───────────────
// Some tenants (e.g. WashFold Orlando's Cassie) charge a flat price per bag
// size instead of per pound. This is a per-location toggle: washFoldPricingMode
// "per_lb" keeps the existing $/lb behavior above unchanged; "per_bag" uses the
// flat-priced bag sizes below instead. Up to 5 bag sizes can be configured,
// each with a label (e.g. "Small", "Medium", "Large"), a flat price, and an
// `enabled` flag -- a tenant can define more sizes than they currently offer
// and just uncheck the ones that aren't active without losing the pricing
// they set up for them.
export type WashFoldPricingMode = "per_lb" | "per_bag"
// NOTE: kept as a literal (not an exported const) because this file has
// "use server" -- Next.js only allows async function exports from such
// files, so a plain exported constant fails the build. Mirror this value
// in app/admin/pricing/page.tsx's MAX_BAG_SIZES if it ever changes.
const MAX_BAG_SIZES = 5

export interface BagSize {
  id: string           // stable id so reordering/editing doesn't reshuffle rows
  label: string         // e.g. "Small Bag"
  priceCents: number    // flat price for this bag size
  enabled: boolean      // whether customers currently see/can pick this size
}

export interface WashFoldBagConfig {
  mode: WashFoldPricingMode
  bagSizes: BagSize[]
}

const DEFAULT_BAG_SIZES: BagSize[] = [
  { id: "small",  label: "Small Bag",  priceCents: 2500, enabled: true },
  { id: "medium", label: "Medium Bag", priceCents: 3500, enabled: true },
  { id: "large",  label: "Large Bag",  priceCents: 4500, enabled: true },
]

const WASH_FOLD_MODE_KEY = "wash_fold_pricing_mode"
const WASH_FOLD_BAG_SIZES_KEY = "wash_fold_bag_sizes"

export async function getWashFoldBagConfig(): Promise<WashFoldBagConfig> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .eq("location_id", locationId)
      .in("key", [WASH_FOLD_MODE_KEY, WASH_FOLD_BAG_SIZES_KEY])

    const map: Record<string, string> = {}
    for (const row of data ?? []) map[row.key] = row.value

    const mode: WashFoldPricingMode = map[WASH_FOLD_MODE_KEY] === "per_bag" ? "per_bag" : "per_lb"
    let bagSizes = DEFAULT_BAG_SIZES
    if (map[WASH_FOLD_BAG_SIZES_KEY]) {
      try {
        const parsed = JSON.parse(map[WASH_FOLD_BAG_SIZES_KEY])
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Backfill `enabled: true` for rows saved before that field existed.
          bagSizes = parsed.map((b: Partial<BagSize>) => ({
            id: b.id ?? `bag_${Math.random().toString(36).slice(2)}`,
            label: b.label ?? "",
            priceCents: b.priceCents ?? 0,
            enabled: b.enabled ?? true,
          }))
        }
      } catch {
        // fall back to defaults on malformed JSON
      }
    }
    return { mode, bagSizes }
  } catch {
    return { mode: "per_lb", bagSizes: DEFAULT_BAG_SIZES }
  }
}

export async function setWashFoldBagConfig(config: WashFoldBagConfig): Promise<void> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  // Cap bag sizes so the booking form's picker doesn't grow unbounded.
  const bagSizes = config.bagSizes.slice(0, MAX_BAG_SIZES)
  await supabase.from("settings").upsert(
    [
      { key: WASH_FOLD_MODE_KEY, value: config.mode, location_id: locationId, updated_at: new Date().toISOString() },
      { key: WASH_FOLD_BAG_SIZES_KEY, value: JSON.stringify(bagSizes), location_id: locationId, updated_at: new Date().toISOString() },
    ],
    { onConflict: "location_id,key" }
  )
  revalidatePath("/admin/pricing")
  revalidatePath("/book/wash-fold")
}
