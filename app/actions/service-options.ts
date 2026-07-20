"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"

export type PricingUnit = "per_order" | "per_pound" | "per_item" | "per_load"

export interface ServiceOption {
  id: string
  type: "detergent" | "extra" | "accessory"
  name: string
  description: string
  name_es?: string | null
  description_es?: string | null
  price_cents: number
  sale_price_cents?: number | null
  sale_ends_at?: string | null
  enabled: boolean
  sort_order: number
  is_hypoallergenic: boolean
  requires_comforter: boolean
  location_id?: string
  pricing_unit: PricingUnit
}


export async function getServiceOptions(type?: "detergent" | "extra" | "accessory"): Promise<ServiceOption[]> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    let query = supabase
      .from("service_options")
      .select("*")
      .eq("location_id", locationId)
      .eq("enabled", true)
      .order("sort_order")
    if (type) query = query.eq("type", type)
    const { data } = await query
    return (data ?? []) as ServiceOption[]
  } catch {
    return []
  }
}

export async function getAllServiceOptions(type?: "detergent" | "extra" | "accessory"): Promise<ServiceOption[]> {
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    let query = supabase
      .from("service_options")
      .select("*")
      .eq("location_id", locationId)
      .order("sort_order")
    if (type) query = query.eq("type", type)
    const { data } = await query
    return (data ?? []) as ServiceOption[]
  } catch {
    return []
  }
}

export async function upsertServiceOption(option: Partial<ServiceOption> & { type: "detergent" | "extra" | "accessory"; name: string }): Promise<void> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  // If editing an existing row, scope the upsert to this tenant so an id
  // collision can't let one tenant overwrite another tenant's option.
  if (option.id) {
    const { data: existing } = await supabase
      .from("service_options")
      .select("location_id")
      .eq("id", option.id)
      .maybeSingle()
    if (existing && existing.location_id !== locationId) return
  }
  await supabase.from("service_options").upsert({
    ...option,
    price_cents: option.price_cents ?? 0,
    enabled: option.enabled ?? true,
    location_id: option.location_id ?? locationId,
    pricing_unit: option.pricing_unit ?? "per_order",
  })
  revalidatePath("/admin/pricing")
}

export async function deleteServiceOption(id: string): Promise<void> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("service_options").delete().eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/pricing")
}

export async function toggleServiceOption(id: string, enabled: boolean): Promise<void> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("service_options").update({ enabled }).eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/pricing")
}

export async function setHypoallergenic(id: string, is_hypoallergenic: boolean): Promise<void> {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("service_options").update({ is_hypoallergenic }).eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/pricing")
}
