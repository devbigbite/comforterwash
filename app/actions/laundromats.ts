"use server"

// A deliberately lightweight view over the same `facilities` table used by
// /admin/facilities — but scoped to what a home-based operator actually
// needs: a short personal list of laundromats they sometimes drive to for
// large orders or comforters (which don't do well on a home machine). None
// of the partner-attendant/Stripe-payout/storage-space machinery on the full
// Facilities page applies here — it's the same person doing the whole order,
// just occasionally at a different address. If a tenant later grows into
// "facility" mode, this same data is already sitting in the real table.

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export interface Laundromat {
  id: string
  name: string
  address: string | null
  phone: string | null
  active: boolean
}

export async function getMyLaundromats(): Promise<Laundromat[]> {
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data } = await supabase
    .from("facilities")
    .select("id, name, address, phone, active")
    .eq("location_id", locationId)
    .eq("active", true)
    .order("name")
  return data ?? []
}

export async function addLaundromat(name: string, address: string, phone: string): Promise<{ error?: string }> {
  await requireAdmin()
  const cleanName = name.trim()
  if (!cleanName) return { error: "Name is required" }

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { error } = await supabase.from("facilities").insert({
    location_id: locationId,
    name: cleanName,
    address: address.trim() || null,
    phone: phone.trim() || null,
  })
  if (error) return { error: error.message }

  revalidatePath("/admin/laundromats")
  return {}
}

export async function updateLaundromat(id: string, name: string, address: string, phone: string): Promise<{ error?: string }> {
  await requireAdmin()
  const cleanName = name.trim()
  if (!cleanName) return { error: "Name is required" }

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { error } = await supabase
    .from("facilities")
    .update({ name: cleanName, address: address.trim() || null, phone: phone.trim() || null })
    .eq("id", id)
    .eq("location_id", locationId)
  if (error) return { error: error.message }

  revalidatePath("/admin/laundromats")
  return {}
}

export async function removeLaundromat(id: string): Promise<{ error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  // Soft-delete (matches the full Facilities page's active flag) rather than
  // a hard delete, so past orders that reference this laundromat still
  // resolve correctly.
  const { error } = await supabase.from("facilities").update({ active: false }).eq("id", id).eq("location_id", locationId)
  if (error) return { error: error.message }

  revalidatePath("/admin/laundromats")
  return {}
}
