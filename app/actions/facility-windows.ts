"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export async function addAccessWindow(formData: FormData) {
  await requireAdmin()
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
  await requireAdmin()
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
