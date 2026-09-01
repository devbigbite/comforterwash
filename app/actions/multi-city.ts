"use server"

// ── Multi-city (Option B): one tenant, multiple location rows ────────────────
// A tenant that operates in more than one city gets a separate `locations`
// row per city (fully isolated data, same as any two unrelated tenants),
// tied together only by the SAME login having a location_users row for each
// one (see getMyLocations/switchAdminLocation in app/admin/login/actions.ts
// for the switcher that lets them move between cities without logging out).
//
// Billing is deliberately NOT set up here. Every tenant's plan price is set
// by the platform owner (requireSuperAdmin-gated setLocationPlanPrice /
// createBillingCheckoutLink in app/actions/platform-billing.ts) -- a new
// city is no different, so this just creates the location and alerts the
// owner to set its price and send a checkout link, the same manual step
// already used for every first-time tenant signup.

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getBranding } from "@/lib/location"
import { seedNewLocation } from "@/app/actions/super-admin"
import { sendNewCityAddedAlert } from "@/lib/email"

export async function addCityToMyAccount(
  formData: FormData
): Promise<{ error?: string; locationId?: string }> {
  await requireAdmin()

  const cityName = (formData.get("city_name") as string ?? "").trim()
  const slug = (formData.get("slug") as string ?? "").toLowerCase().trim()
  const address = (formData.get("address") as string ?? "").trim() || null
  const timezone = (formData.get("timezone") as string ?? "").trim() || "America/New_York"

  if (!cityName || !slug) return { error: "City name and slug are required." }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug can only contain lowercase letters, numbers, and hyphens." }
  }

  const supabase = createAdminClient()
  const authed = await createClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return { error: "Not signed in." }

  // Seed the new city from the parent tenant's own branding -- same
  // business, different city, not a blank slate the tenant has to
  // re-configure from scratch.
  const parentBranding = await getBranding()

  const { data: newLoc, error } = await supabase
    .from("locations")
    .insert({
      name: cityName,
      slug,
      business_name: parentBranding.business_name,
      primary_color: parentBranding.primary_color,
      accent_color: parentBranding.accent_color,
      support_phone: parentBranding.support_phone,
      support_email: parentBranding.support_email,
      address,
      timezone,
      status: "active",
      billing_status: "none",
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") return { error: "That slug is already taken." }
    return { error: error.message }
  }
  if (!newLoc?.id) return { error: "Something went wrong creating the city." }

  await seedNewLocation(newLoc.id)

  // Give this SAME login access to the new city -- this is one tenant
  // adding a second city to their own account, not inviting a new admin.
  const { error: linkError } = await supabase.from("location_users").insert({
    user_id: user.id,
    location_id: newLoc.id,
    role: "admin",
    is_super_admin: false,
  })
  if (linkError) return { error: `City created, but couldn't link your login to it: ${linkError.message}` }

  await sendNewCityAddedAlert({
    businessName: parentBranding.business_name,
    newCityName: cityName,
    newLocationId: newLoc.id,
  }).catch(() => {})

  return { locationId: newLoc.id }
}
