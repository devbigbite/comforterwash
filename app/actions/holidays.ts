"use server"

import { createAdminClient } from "@/lib/supabase/admin"

// Returns Set of excluded date strings "YYYY-MM-DD" — called once per booking form load
export async function getExcludedDates(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("holiday_exclusions")
    .select("date")
    .gte("date", new Date().toISOString().split("T")[0])
  return (data ?? []).map(d => d.date as string)
}
