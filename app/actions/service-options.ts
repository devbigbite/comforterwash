"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"

export interface ServiceOption {
  id: string
  type: "detergent" | "extra"
  name: string
  description: string
  price_cents: number
  enabled: boolean
  sort_order: number
}

export async function getServiceOptions(type?: "detergent" | "extra"): Promise<ServiceOption[]> {
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

export async function getAllServiceOptions(type?: "detergent" | "extra"): Promise<ServiceOption[]> {
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

export async function upsertServiceOption(option: Partial<ServiceOption> & { type: "detergent" | "extra"; name: string }): Promise<void> {
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
