"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { todayET } from "@/lib/date-et"

/**
 * Returns a flat array of excluded date strings "YYYY-MM-DD".
 * Single-day entries map to one string; range entries (with date_to)
 * are expanded into every individual date in the span, inclusive.
 * Called once per booking form load.
 */
export async function getExcludedDates(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("holiday_exclusions")
    .select("date, date_to")
    .gte("date", todayET())

  if (!data) return []

  const excluded: string[] = []

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

  return excluded
}
