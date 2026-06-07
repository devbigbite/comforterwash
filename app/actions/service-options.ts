"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"

export interface ServiceOption {
  id: string
  type: "detergent" | "extra" | "accessory"
  name: string
  description: string
  price_cents: number
  sale_price_cents?: number | null
  sale_ends_at?: string | null
  enabled: boolean
  sort_order: number
  is_hypoallergenic: boolean
}

/** Returns the active price — sale price if set and not expired, otherwise regular price */
export function effectivePrice(opt: ServiceOption): number {
  if (
    opt.sale_price_cents != null &&
    (!opt.sale_ends_at || new Date(opt.sale_ends_at) > new Date())
  ) {
    return opt.sale_price_cents
  }
  return opt.price_cents
}

/** True if a sale is currently active */
export function isSaleActive(opt: ServiceOption): boolean {
  return (
    opt.sale_price_cents != null &&
    (!opt.sale_ends_at || new Date(opt.sale_ends_at) > new Date())
  )
}

export async function getServiceOptions(type?: "detergent" | "extra" | "accessory"): Promise<ServiceOption[]> {
  try {
    const supabase = createAdminClient()
    let query = supabase
      .from("service_options")
      .select("*")
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
    const supabase = createAdminClient()
    let query = supabase
      .from("service_options")
      .select("*")
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

  const supabase = createAdminClient()
  await supabase.from("service_options").upsert({
    ...option,
    price_cents: option.price_cents ?? 0,
    enabled: option.enabled ?? true,
  })
  revalidatePath("/admin/pricing")
}

export async function deleteServiceOption(id: string): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()
  await supabase.from("service_options").delete().eq("id", id)
  revalidatePath("/admin/pricing")
}

export async function toggleServiceOption(id: string, enabled: boolean): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()
  await supabase.from("service_options").update({ enabled }).eq("id", id)
  revalidatePath("/admin/pricing")
}

export async function setHypoallergenic(id: string, is_hypoallergenic: boolean): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()
  await supabase.from("service_options").update({ is_hypoallergenic }).eq("id", id)
  revalidatePath("/admin/pricing")
}
