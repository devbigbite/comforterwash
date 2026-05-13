"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { getLocationId } from "@/lib/location"

export interface StorageSpace {
  id: string
  location_id: string
  facility_id: string
  name: string
  address: string | null
  unit: string | null
  city: string | null
  state: string | null
  zip: string | null
  sq_ft: number | null
  capacity_bags: number | null
  notes: string | null
  phone: string | null
  manager: string | null
  office_hours: string | null
  entry_hours: string | null
  active: boolean
  created_at: string
}

export async function getStorageSpacesForFacility(facilityId: string): Promise<StorageSpace[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("storage_spaces")
    .select("*")
    .eq("facility_id", facilityId)
    .order("active", { ascending: false })
    .order("name")
  return (data ?? []) as StorageSpace[]
}

export async function getAllStorageSpaces(): Promise<StorageSpace[]> {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const { data } = await supabase
    .from("storage_spaces")
    .select("*")
    .eq("location_id", locationId)
    .order("active", { ascending: false })
    .order("name")
  return (data ?? []) as StorageSpace[]
}

function pickFields(formData: FormData) {
  return {
    name:         (formData.get("name") as string)?.trim(),
    address:      (formData.get("address") as string)?.trim() || null,
    unit:         (formData.get("unit") as string)?.trim() || null,
    city:         (formData.get("city") as string)?.trim() || null,
    state:        (formData.get("state") as string)?.trim() || "FL",
    zip:          (formData.get("zip") as string)?.trim() || null,
    sq_ft:        parseFloat(formData.get("sq_ft") as string) || null,
    capacity_bags:parseInt(formData.get("capacity_bags") as string) || null,
    notes:        (formData.get("notes") as string)?.trim() || null,
    phone:        (formData.get("phone") as string)?.trim() || null,
    manager:      (formData.get("manager") as string)?.trim() || null,
    office_hours: (formData.get("office_hours") as string)?.trim() || null,
    entry_hours:  (formData.get("entry_hours") as string)?.trim() || null,
  }
}

function revalidate(facilityId: string) {
  revalidatePath(`/admin/facilities`)
  revalidatePath(`/admin/facilities/${facilityId}`)
}

export async function addStorageSpace(formData: FormData) {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const facilityId = formData.get("facility_id") as string
  const fields = pickFields(formData)
  if (!fields.name || !facilityId) return { error: "Name and facility required" }

  const { error } = await supabase.from("storage_spaces").insert({
    location_id: locationId,
    facility_id: facilityId,
    active: true,
    ...fields,
  })
  if (error) return { error: error.message }
  revalidate(facilityId)
  return { success: true }
}

export async function updateStorageSpace(formData: FormData) {
  const supabase = createAdminClient()
  const id         = formData.get("id") as string
  const facilityId = formData.get("facility_id") as string
  const fields = pickFields(formData)
  if (!id || !fields.name) return { error: "Missing fields" }

  const { error } = await supabase.from("storage_spaces").update(fields).eq("id", id)
  if (error) return { error: error.message }
  revalidate(facilityId)
  return { success: true }
}

export async function toggleStorageSpaceActive(formData: FormData) {
  const supabase = createAdminClient()
  const id         = formData.get("id") as string
  const facilityId = formData.get("facility_id") as string
  const current    = formData.get("active") === "true"
  await supabase.from("storage_spaces").update({ active: !current }).eq("id", id)
  revalidate(facilityId)
}

export async function deleteStorageSpace(formData: FormData) {
  const supabase = createAdminClient()
  const id         = formData.get("id") as string
  const facilityId = formData.get("facility_id") as string
  await supabase.from("storage_spaces").delete().eq("id", id)
  revalidate(facilityId)
}
