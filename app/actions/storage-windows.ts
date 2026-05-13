"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export interface StorageEntryWindow {
  id: string
  storage_space_id: string
  label: string | null
  days_of_week: number[]
  start_time: string
  end_time: string
  overnight: boolean
  notes: string | null
}

export async function addStorageEntryWindow(formData: FormData) {
  const storageSpaceId = formData.get("storageSpaceId") as string
  const facilityId     = formData.get("facilityId") as string
  const label          = (formData.get("label") as string)?.trim() || null
  const daysRaw        = formData.get("days_of_week") as string
  const startTime      = formData.get("start_time") as string
  const endTime        = formData.get("end_time") as string
  const overnight      = formData.get("overnight") === "true"
  const notes          = (formData.get("notes") as string)?.trim() || null

  if (!storageSpaceId || !startTime || !endTime) return { error: "Missing fields" }

  const days: number[] = JSON.parse(daysRaw || "[]")
  if (days.length === 0) return { error: "Select at least one day" }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("storage_entry_windows")
    .insert({ storage_space_id: storageSpaceId, label, days_of_week: days, start_time: startTime, end_time: endTime, overnight, notes })
    .select()
    .single()

  if (error) return { error: "Failed to save window" }

  revalidatePath("/admin/facilities")
  if (facilityId) revalidatePath(`/admin/facilities/${facilityId}`)
  return { window: data }
}

export async function deleteStorageEntryWindow(id: string) {
  const supabase = createAdminClient()
  await supabase.from("storage_entry_windows").delete().eq("id", id)
  revalidatePath("/admin/facilities")
}

export async function getStorageEntryWindows(storageSpaceId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("storage_entry_windows")
    .select("*")
    .eq("storage_space_id", storageSpaceId)
    .eq("active", true)
    .order("start_time")
  return (data ?? []) as StorageEntryWindow[]
}
