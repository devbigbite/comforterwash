"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export interface SameDayConfig {
  enabled: boolean
  feeCents: number      // e.g. 1000 = $10
  cutoffHour: number    // 24-hour, tenant-local; order must be placed before this hour to get same-day
}

const DEFAULTS: SameDayConfig = {
  enabled: false,
  feeCents: 1000,
  cutoffHour: 12,  // noon -- leaves the rest of the day for processing + delivery
}

const KEYS = {
  enabled: "same_day_enabled",
  feeCents: "same_day_fee_cents",
  cutoffHour: "same_day_cutoff_hour",
} as const

export async function getSameDayConfig(): Promise<SameDayConfig> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .eq("location_id", locationId)
      .in("key", Object.values(KEYS))

    const map: Record<string, string> = {}
    for (const row of data ?? []) map[row.key] = row.value

    return {
      enabled: map[KEYS.enabled] !== undefined ? map[KEYS.enabled] === "true" : DEFAULTS.enabled,
      feeCents: map[KEYS.feeCents] !== undefined ? parseInt(map[KEYS.feeCents], 10) : DEFAULTS.feeCents,
      cutoffHour: map[KEYS.cutoffHour] !== undefined ? parseInt(map[KEYS.cutoffHour], 10) : DEFAULTS.cutoffHour,
    }
  } catch {
    return DEFAULTS
  }
}

export async function setSameDayConfig(config: SameDayConfig): Promise<void> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const rows = [
    { key: KEYS.enabled, value: String(config.enabled) },
    { key: KEYS.feeCents, value: String(Math.max(0, config.feeCents)) },
    { key: KEYS.cutoffHour, value: String(Math.min(23, Math.max(0, config.cutoffHour))) },
  ].map(r => ({ ...r, location_id: locationId, updated_at: new Date().toISOString() }))

  await supabase.from("settings").upsert(rows, { onConflict: "location_id,key" })
  revalidatePath("/admin/pricing")
  revalidatePath("/admin/routes")
  revalidatePath("/book/wash-fold")
  revalidatePath("/book/wash-only")
  revalidatePath("/book/comforter-wash")
}
