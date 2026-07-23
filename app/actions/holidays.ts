"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { todayET } from "@/lib/date-et"

/**
 * Returns a flat array of excluded date strings "YYYY-MM-DD".
 * Single-day entries map to one string; range entries (with date_to)
 * are expanded into every individual date in the span, inclusive.
 * Called once per booking form load.
 */
export async function getExcludedDates(): Promise<string[]> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("holiday_exclusions")
    .select("date, date_to")
    .eq("location_id", locationId)
    .gte("date", todayET())

  const excluded: string[] = []

  if (data) {
    for (const row of data) {
      const start = row.date as string
      const end   = row.date_to as string | null

      if (!end || end === start) {
        excluded.push(start)
      } else {
        // Expand range [start, end] inclusive
        const cur = new Date(start + "T00:00:00")
        const last = new Date(end + "T00:00:00")
        while (cur <= last) {
          excluded.push(cur.toISOString().split("T")[0])
          cur.setDate(cur.getDate() + 1)
        }
      }
    }
  }

  // Home-based operators have a hard daily load cap (one washer/dryer, one
  // person) — once a day hits that cap, it should stop being offered as a
  // pickup date entirely, same as a holiday would. Facility tenants have no
  // cap by default, so this is a no-op for them.
  const { data: loc } = await supabase
    .from("locations")
    .select("operating_mode, home_daily_capacity")
    .eq("id", locationId)
    .single()

  if (loc?.operating_mode === "home" && loc.home_daily_capacity) {
    const { data: counts } = await supabase
      .from("bookings")
      .select("pickup_date")
      .eq("location_id", locationId)
      .neq("status", "cancelled")
      .gte("pickup_date", todayET())

    if (counts) {
      const byDate = new Map<string, number>()
      for (const row of counts) {
        const d = row.pickup_date as string
        byDate.set(d, (byDate.get(d) ?? 0) + 1)
      }
      for (const [date, count] of byDate) {
        if (count >= loc.home_daily_capacity) excluded.push(date)
      }
    }
  }

  return excluded
}
