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

export async function addStorageSpace(formData: FormData) {
  const supabase = createAdminClient()
  const locationId = await getLocationId()
  const facilityId = formData.get("facility_id") as string

  const name    = (formData.get("name") as string)?.trim()
  if (!name || !facilityId) return { error: "Name and facility required" }

  const { error } = await supabase.from("storage_spaces").insert({
    location_id:   locationId,
    facility_id:   facilityId,
    name,
    address:       (formData.get("address") as string)?.trim() || null,
    unit:          (formData.get("unit") as string)?.trim() || null,
    city:          (formData.get("city") as string)?.trim() || null,
    state:         (formData.get("state") as string)?.trim() || "FL",
    zip:           (formData.get("zip") as string)?.trim() || null,
    sq_ft:         parseFloat(formData.get("sq_ft") as string) || null,
    capacity_bags: parseInt(formData.get("capacity_bags") as string) || null,
    notes:         (formData.get("notes") as string)?.trim() || null,
    active:        true,
  })

  if (error) return { error: error.message }
  revalidatePath(`/admin/facilities/${facilityId}`)
  return { success: true }
}

export async function updateStorageSpace(formData: FormData) {
  const supabase = createAdminClient()
  const id         = formData.get("id") as string
  const facilityId = formData.get("facility_id") as string
  const name       = (formData.get("name") as string)?.trim()
  if (!id || !name) return { error: "Missing fields" }

  const { error } = await supabase.from("storage_spaces").update({
    name,
    address:       (formData.get("address") as string)?.trim() || null,
    unit:          (formData.get("unit") as string)?.trim() || null,
    city:          (formData.get("city") as string)?.trim() || null,
    state:         (formData.get("state") as string)?.trim() || "FL",
    zip:           (formData.get("zip") as string)?.trim() || null,
    sq_ft:         parseFloat(formData.get("sq_ft") as string) || null,
    capacity_bags: parseInt(formData.get("capacity_bags") as string) || null,
    notes:         (formData.get("notes") as string)?.trim() || null,
  }).eq("id", id)

  if (error) return { error: error.message }
  revalidatePath(`/admin/facilities/${facilityId}`)
  return { success: true }
}

export async function toggleStorageSpaceActive(id: string, facilityId: string, active: boolean) {
  const supabase = createAdminClient()
  await supabase.from("storage_spaces").update({ active }).eq("id", id)
  revalidatePath(`/admin/facilities/${facilityId}`)
}

export async function deleteStorageSpace(id: string, facilityId: string) {
  const supabase = createAdminClient()
  await supabase.from("storage_spaces").delete().eq("id", id)
  revalidatePath(`/admin/facilities/${facilityId}`)
}
