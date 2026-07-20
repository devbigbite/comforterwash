"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import type { Location } from "@/lib/location"
import { requireSuperAdmin } from "@/lib/auth-guard"

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAllLocations(): Promise<(Location & { created_at: string })[]> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, custom_domain, status, plan, created_at")
    .order("created_at", { ascending: true })
  return (data ?? []) as (Location & { created_at: string })[]
}

// ── Create ────────────────────────────────────────────────────────────────────

// Sensible starter catalog for a brand-new tenant — mirrors what WashFold
// Orlando actually uses day-to-day. Every other setting (pricing, which
// services are active, site text/images) already falls back to hardcoded
// defaults when a location has no rows yet (see app/actions/settings.ts,
// app/actions/pricing.ts) — service_options is the one table with no
// graceful default, so a new tenant would otherwise see empty detergent/
// extras/accessory pickers on every booking form until they configured it
// themselves.
const STARTER_SERVICE_OPTIONS: {
  type: "detergent" | "extra" | "accessory"
  name: string
  description: string
  price_cents: number
  enabled: boolean
  sort_order: number
  is_hypoallergenic: boolean
  requires_comforter: boolean
}[] = [
  { type: "detergent", name: "Standard Detergent", description: "Our regular, all-purpose detergent", price_cents: 0, enabled: true, sort_order: 0, is_hypoallergenic: false, requires_comforter: false },
  { type: "detergent", name: "Fragrance-Free / Hypoallergenic", description: "Gentle on sensitive skin, no added fragrance", price_cents: 100, enabled: true, sort_order: 1, is_hypoallergenic: true, requires_comforter: false },
  { type: "extra", name: "Fabric Softener", description: "Adds softness and a light scent", price_cents: 0, enabled: false, sort_order: 0, is_hypoallergenic: false, requires_comforter: false },
  { type: "extra", name: "OxyClean", description: "Extra stain-fighting boost", price_cents: 0, enabled: false, sort_order: 1, is_hypoallergenic: false, requires_comforter: false },
  { type: "accessory", name: "Premium Laundry Bag", description: "Reusable branded laundry bag", price_cents: 1000, enabled: true, sort_order: 0, is_hypoallergenic: false, requires_comforter: false },
  { type: "accessory", name: "Premium Comforter Bag", description: "Reusable branded comforter storage bag", price_cents: 700, enabled: true, sort_order: 1, is_hypoallergenic: false, requires_comforter: true },
]

async function seedNewLocation(locationId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from("service_options").insert(
    STARTER_SERVICE_OPTIONS.map(o => ({ ...o, location_id: locationId, pricing_unit: "per_order" }))
  )
}

export async function createLocation(
  formData: FormData
): Promise<{ error?: string }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()

  const name         = (formData.get("name") as string ?? "").trim()
  const slug         = (formData.get("slug") as string ?? "").toLowerCase().trim()
  const customDomain = (formData.get("custom_domain") as string ?? "").trim() || null
  const plan         = (formData.get("plan") as string ?? "").trim() || null

  if (!name || !slug) return { error: "Name and slug are required." }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug can only contain lowercase letters, numbers, and hyphens." }
  }

  const { data, error } = await supabase.from("locations").insert({
    name,
    slug,
    custom_domain: customDomain,
    plan,
    status: "active",
  }).select("id").single()

  if (error) {
    if (error.code === "23505") return { error: "A location with that slug already exists." }
    return { error: error.message }
  }

  if (data?.id) {
    await seedNewLocation(data.id)
  }

  revalidatePath("/super-admin")
  return {}
}

// ── Update ────────────────────────────────────────────────────────────────────

// ── Invite a tenant's first admin ─────────────────────────────────────────────
// Creates (or reuses) a Supabase Auth user for the given email, links them to
// this location via location_users with role "admin", and emails them a
// magic sign-in link scoped to /admin/auth/callback. This is the actual
// "onboard a new tenant" action — without it, createLocation() above just
// makes an orphaned location nobody can log into.
export async function inviteLocationAdmin(
  locationId: string,
  email: string,
): Promise<{ error?: string; success?: boolean }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes("@")) return { error: "Enter a valid email address." }

  // Find or create the auth user
  const { data: userList } = await supabase.auth.admin.listUsers()
  let userId = userList?.users.find(u => u.email?.toLowerCase() === cleanEmail)?.id

  if (!userId) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
    })
    if (createError || !created?.user) {
      return { error: createError?.message ?? "Failed to create user" }
    }
    userId = created.user.id
  }

  // Link to this location as admin (idempotent — unique on location_id+user_id)
  const { error: linkError } = await supabase
    .from("location_users")
    .upsert(
      { location_id: locationId, user_id: userId, role: "admin", is_super_admin: false },
      { onConflict: "location_id,user_id" }
    )
  if (linkError) return { error: linkError.message }

  // Send them a magic sign-in link
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const { data: linkData, error: linkGenError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: cleanEmail,
    options: { redirectTo: `${siteUrl}/admin/auth/callback` },
  })
  if (linkGenError) return { error: linkGenError.message }

  const magicLink = (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link
  if (magicLink) {
    const { sendAdminMagicLinkEmail } = await import("@/lib/email")
    await sendAdminMagicLinkEmail(cleanEmail, magicLink)
  }

  revalidatePath("/super-admin")
  return { success: true }
}

// ── Remove an admin's access to a location ────────────────────────────────────
export async function removeLocationAdmin(locationId: string, userId: string): Promise<{ error?: string }> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  await supabase.from("location_users").delete().eq("location_id", locationId).eq("user_id", userId)
  revalidatePath("/super-admin")
  return {}
}

// ── List admins for a location ────────────────────────────────────────────────
export async function getLocationAdmins(locationId: string): Promise<{ user_id: string; email: string; role: string; is_super_admin: boolean }[]> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data: memberships } = await supabase
    .from("location_users")
    .select("user_id, role, is_super_admin")
    .eq("location_id", locationId)
  if (!memberships?.length) return []

  const { data: userList } = await supabase.auth.admin.listUsers()
  return memberships.map(m => ({
    user_id: m.user_id,
    email: userList?.users.find(u => u.id === m.user_id)?.email ?? "(unknown)",
    role: m.role,
    is_super_admin: m.is_super_admin,
  }))
}

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
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("locations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/super-admin")
  return {}
}
