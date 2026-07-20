"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-guard"
import { getLocationId } from "@/lib/location"
import { revalidatePath } from "next/cache"

export async function addAccessWindow(formData: FormData) {
  await requireAdmin()
  const locationId = await getLocationId()
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
    .insert({ facility_id: facilityId, location_id: locationId, label, days_of_week: days, start_time: startTime, end_time: endTime, overnight, notes })
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
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("facility_access_windows").delete().eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/facilities")
}

export async function getFacilityAccessWindows(facilityId: string) {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("facility_access_windows")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("location_id", locationId)
    .eq("active", true)
    .order("start_time")
  return data ?? []
}

export async function getAllFacilityWindows() {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("facility_access_windows")
    .select("*")
    .eq("location_id", locationId)
    .eq("active", true)
    .order("facility_id")
  return data ?? []
}
