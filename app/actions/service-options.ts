"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
    const supabase = await createClient()
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
    const supabase = await createClient()
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
  const supabase = await createClient()
  await supabase.from("service_options").upsert({
    ...option,
    price_cents: option.price_cents ?? 0,
    enabled: option.enabled ?? true,
  })
  revalidatePath("/admin/pricing")
}

export async function deleteServiceOption(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from("service_options").delete().eq("id", id)
  revalidatePath("/admin/pricing")
}

export async function toggleServiceOption(id: string, enabled: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from("service_options").update({ enabled }).eq("id", id)
  revalidatePath("/admin/pricing")
}
