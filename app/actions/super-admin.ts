"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/default-email-templates"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { Location } from "@/lib/location"
import { requireSuperAdmin } from "@/lib/auth-guard"

// ── Enter / exit a tenant's admin area as the super admin ────────────────────
// Lets the platform owner view and operate any tenant's /admin without a
// separate password or account for that tenant — sets the same override
// cookie the real per-tenant login path uses (see middleware.ts + the
// /admin/auth/callback route), plus a marker cookie so the admin UI can show
// a "you're viewing as X — exit" banner instead of looking like a normal login.
export async function enterTenantAdmin(locationId: string): Promise<void> {
  await requireSuperAdmin()
  const cookieStore = await cookies()
  // The /admin gate itself just checks for this cookie regardless of auth
  // mechanism — requireSuperAdmin() above is the real check, this just lets
  // the already-verified super admin through the same gate a real tenant
  // admin passes.
  cookieStore.set("admin_auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  })
  cookieStore.set("admin_location_id", locationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours — same lifetime as the super-admin session
    path: "/",
  })
  cookieStore.set("super_admin_impersonating", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  })
  redirect("/admin")
}

export async function exitTenantAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("admin_location_id")
  cookieStore.delete("super_admin_impersonating")
  redirect("/super-admin")
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAllLocations(): Promise<(Location & { created_at: string; billing_status: string; plan_price_cents: number | null; plan_name: string | null })[]> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, custom_domain, status, plan, created_at, billing_status, plan_price_cents, plan_name")
    .order("created_at", { ascending: true })
  return (data ?? []) as (Location & { created_at: string; billing_status: string; plan_price_cents: number | null; plan_name: string | null })[]
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
  { type: "extra", name: "Stain Removal", description: "Extra stain treatment for visible stains — no guarantee on deep-set or old stains", price_cents: 900, enabled: true, sort_order: 12, is_hypoallergenic: false, requires_comforter: false },
  { type: "accessory", name: "Premium Laundry Bag", description: "Reusable branded laundry bag", price_cents: 1000, enabled: true, sort_order: 0, is_hypoallergenic: false, requires_comforter: false },
  { type: "accessory", name: "Premium Comforter Bag", description: "Reusable branded comforter storage bag", price_cents: 700, enabled: true, sort_order: 1, is_hypoallergenic: false, requires_comforter: true },
]

export async function seedNewLocation(locationId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from("service_options").insert(
    STARTER_SERVICE_OPTIONS.map(o => ({ ...o, location_id: locationId, pricing_unit: "per_order" }))
  )

  // Editable copies of the transactional emails. Without these rows the
  // tenant's /admin/templates page is empty on every tab — their email still
  // sends using the hardcoded defaults in lib/email-templates.ts, but they
  // have no way to change any of the wording. Seeded on a fresh location only,
  // so re-running never clobbers a tenant's edits.
  const { data: existing } = await supabase
    .from("email_templates")
    .select("key")
    .eq("location_id", locationId)
    .limit(1)

  if (!existing?.length) {
    const { error } = await supabase.from("email_templates").insert(
      DEFAULT_EMAIL_TEMPLATES.map(t => ({ ...t, location_id: locationId })),
    )
    if (error) console.error("[seedNewLocation] email_templates seed failed:", error.message)
  }
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
  const result = await _inviteLocationAdminCore(locationId, email)
  revalidatePath("/super-admin")
  return result
}

// Unexported core — the actual user-creation/link/magic-link logic, with no
// auth gate. Exists so the self-signup webhook (app/api/stripe/webhook/route.ts)
// can provision a brand-new tenant's first admin automatically, without a
// super-admin session (there isn't one — nobody's logged in, it's Stripe
// calling our server). Never export this directly; every caller needs its own
// trust boundary — requireSuperAdmin() above for the manual invite flow,
// Stripe's webhook signature verification for the self-signup flow.
async function _inviteLocationAdminCore(
  locationId: string,
  email: string,
): Promise<{ error?: string; success?: boolean }> {
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
    options: { redirectTo: `${siteUrl}/admin/auth/callback?location_id=${locationId}` },
  })
  if (linkGenError) return { error: linkGenError.message }

  // Build our own link from hashed_token rather than sending the raw
  // action_link — that delivers tokens as a URL hash fragment, which
  // never reaches the server and silently fails to sign anyone in.
  const tokenHash = (linkData as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token
  const magicLink = tokenHash
    ? `${siteUrl}/admin/auth/callback?token_hash=${tokenHash}&type=magiclink&location_id=${locationId}`
    : undefined
  if (magicLink) {
    const { sendAdminMagicLinkEmail } = await import("@/lib/email")
    await sendAdminMagicLinkEmail(cleanEmail, magicLink, locationId)
  }

  revalidatePath("/super-admin")
  return { success: true }
}

// ── Provision a brand-new tenant from a completed self-signup checkout ───────
// Called only from the Stripe webhook (app/api/stripe/webhook/route.ts) after
// a "platform_self_signup" checkout session completes — no auth gate, because
// there is no logged-in user at that point; trust comes from Stripe's webhook
// signature verification instead. Creates the location, seeds its starter
// catalog, links the signup email as its first admin, and emails them a
// magic sign-in link — the whole tenant is usable within seconds of payment,
// no super-admin involved.
export async function provisionSelfSignupTenant(params: {
  businessName: string
  slug: string
  contactEmail: string
  planName: string
  planPriceCents: number
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}): Promise<{ locationId?: string; error?: string }> {
  const supabase = createAdminClient()

  // Re-check slug uniqueness here too — the pre-checkout check in
  // self-signup.ts only prevents most collisions; two people could still
  // complete checkout for the same slug in a race. Whoever's webhook lands
  // second gets a de-duped slug rather than failing outright, since they've
  // already been charged at this point.
  let slug = params.slug
  const { data: clash } = await supabase.from("locations").select("id").eq("slug", slug).maybeSingle()
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const { data: location, error } = await supabase.from("locations").insert({
    name: params.businessName,
    slug,
    plan: params.planName,
    plan_name: params.planName,
    plan_price_cents: params.planPriceCents,
    status: "active",
    billing_status: "trialing",
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
  }).select("id").single()

  if (error || !location) {
    console.error("[provisionSelfSignupTenant] location insert failed:", error?.message)
    return { error: error?.message ?? "Failed to create location" }
  }

  await seedNewLocation(location.id)

  const inviteResult = await _inviteLocationAdminCore(location.id, params.contactEmail)
  if (inviteResult.error) {
    // Location and billing already exist at this point — don't fail the
    // whole provisioning over the invite email specifically. Log loudly so
    // it doesn't go unnoticed the way earlier silent failures did.
    console.error(`[provisionSelfSignupTenant] location ${location.id} created but admin invite failed:`, inviteResult.error)
  }

  return { locationId: location.id }
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

// ── Delete ────────────────────────────────────────────────────────────────────

export interface DeleteLocationResult {
  deleted: boolean
  blocked?: boolean
  error?: string
  counts?: { bookings: number; workers: number; subscriptions: number }
}

// Permanently removes a location and all its data (bookings, workers,
// facilities, settings, etc. — see admin_delete_location() in the DB).
// Blocked by default if the location has any real bookings/workers/
// subscriptions, unless `force` is passed — meant for cleaning up demo
// tenants that never actually subscribed, not for offboarding live customers.
export async function deleteLocation(
  locationId: string,
  force = false
): Promise<DeleteLocationResult> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("admin_delete_location", {
    target_location_id: locationId,
    force,
  })
  if (error) return { deleted: false, error: error.message }
  revalidatePath("/super-admin")
  return data as DeleteLocationResult
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
