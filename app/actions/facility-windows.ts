"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function addAccessWindow(formData: FormData) {
  const facilityId = formData.get("facilityId") as string
  const label      = (formData.get("label") as string)?.trim() || null
  const daysRaw    = formData.get("days_of_week") as string
  const startTime  = formData.get("start_time") as string
  const endTime    = formData.get("end_time") as string
  const overnight  = formData.get("overnight") === "true"
  const notes      = (formData.get("notes") as string)?.trim() || null

  if (!facilityId || !startTime || !endTime) return { error: "Missing fields" }

  const days: number[] = JSON.parse(daysRaw || "[]")
  if (days.length === 0) return { error: "Select at least one day" }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("facility_access_windows")
    .insert({ facility_id: facilityId, label, days_of_week: days, start_time: startTime, end_time: endTime, overnight, notes })
    .select()
    .single()

  if (error) {
    console.error("[facility-windows] insert error:", error)
    return { error: "Failed to save window" }
  }

  revalidatePath("/admin/facilities")
  return { window: data }
}

export async function deleteAccessWindow(id: string) {
  const supabase = createAdminClient()
  await supabase.from("facility_access_windows").delete().eq("id", id)
  revalidatePath("/admin/facilities")
}

export async function getFacilityAccessWindows(facilityId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("facility_access_windows")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("active", true)
    .order("start_time")
  return data ?? []
}

export async function getAllFacilityWindows() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("facility_access_windows")
    .select("*")
    .eq("active", true)
    .order("facility_id")
  return data ?? []
}

/** Returns true if the given Date falls inside any access window for the facility.
 *  If no windows are defined, returns true (always accessible). */
export function isWithinAccessWindow(
  windows: { days_of_week: number[]; start_time: string; end_time: string; overnight: boolean }[],
  date: Date = new Date()
): boolean {
  if (windows.length === 0) return true

  const dayOfWeek = date.getDay()
  const timeStr   = `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`

  for (const w of windows) {
    if (!w.days_of_week.includes(dayOfWeek)) continue

    if (w.overnight) {
      // e.g. 21:00 – 06:00  → valid if time >= 21:00 OR time <= 06:00
      if (timeStr >= w.start_time || timeStr <= w.end_time) return true
    } else {
      if (timeStr >= w.start_time && timeStr <= w.end_time) return true
    }
  }
  return false
}
