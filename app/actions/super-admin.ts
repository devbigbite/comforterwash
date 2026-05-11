"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import type { Location } from "@/lib/location"

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAllLocations(): Promise<(Location & { created_at: string })[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, custom_domain, status, plan, created_at")
    .order("created_at", { ascending: true })
  return (data ?? []) as (Location & { created_at: string })[]
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createLocation(
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  const name        = (formData.get("name") as string ?? "").trim()
  const slug        = (formData.get("slug") as string ?? "").toLowerCase().trim()
  const customDomain = (formData.get("custom_domain") as string ?? "").trim() || null
  const plan        = (formData.get("plan") as string ?? "").trim() || null

  if (!name || !slug) return { error: "Name and slug are required." }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug can only contain lowercase letters, numbers, and hyphens." }
  }

  const { error } = await supabase.from("locations").insert({
    name,
    slug,
    custom_domain: customDomain,
    plan,
    status: "active",
  })

  if (error) {
    if (error.code === "23505") return { error: "A location with that slug already exists." }
    return { error: error.message }
  }

  revalidatePath("/super-admin")
  return {}
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateLocation(
  id: string,
  updates: {
    name?: string
    slug?: string
    custom_domain?: string | null
    status?: "active" | "inactive" | "suspended"
    plan?: string | null
  }
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("locations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/super-admin")
  return {}
}
