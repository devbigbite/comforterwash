"use server"

// Creates a REAL, isolated tenant site for a prospect who requested a demo —
// their own row in `locations`, their own subdomain under washfoldclean.com,
// seeded starter content, and their own admin login — not a shared sandbox.
// If they sign up for real later, this same location just keeps being used
// (upgrade the plan / connect Stripe / add a custom domain); nothing needs
// to be migrated.
//
// This is intentionally NOT gated behind requireSuperAdmin(): it's invoked
// automatically right after a prospect submits the public /platform demo
// form (see requestPlatformDemo in platform-contact.ts), so there's no admin
// session yet. It only ever acts on an existing platform_demo_requests row
// (not arbitrary attacker-supplied name/email), and is idempotent — calling
// it twice for the same request just reuses the tenant it already created.

import { createAdminClient } from "@/lib/supabase/admin"
import { seedNewLocation } from "@/app/actions/super-admin"
import { sendPlatformDemoGuideEmail } from "@/app/actions/platform-demo-email"

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfoldclean.com"

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

async function findAvailableSlug(supabase: ReturnType<typeof createAdminClient>, base: string): Promise<string> {
  const cleanBase = slugify(base) || "demo"
  let candidate = cleanBase
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.from("locations").select("id").eq("slug", candidate).maybeSingle()
    if (!data) return candidate
    candidate = `${cleanBase}-${Math.random().toString(36).slice(2, 6)}`
  }
  return `${cleanBase}-${Date.now()}`
}

export interface DemoSiteResult {
  error?: string
  success?: boolean
  demoUrl?: string
  locationId?: string
}

// Idempotent — safe to call more than once for the same request.
export async function createDemoTenantForRequest(requestId: string): Promise<DemoSiteResult> {
  const supabase = createAdminClient()

  const { data: reqRow } = await supabase
    .from("platform_demo_requests")
    .select("id, name, email, business, demo_location_id")
    .eq("id", requestId)
    .maybeSingle()

  if (!reqRow) return { error: "Demo request not found." }

  // Already created for this request — just recompute the URL and return it.
  if (reqRow.demo_location_id) {
    const { data: existing } = await supabase
      .from("locations")
      .select("slug")
      .eq("id", reqRow.demo_location_id)
      .maybeSingle()
    if (existing) {
      return { success: true, demoUrl: `https://${existing.slug}.${PLATFORM_DOMAIN}`, locationId: reqRow.demo_location_id }
    }
  }

  const displayName = reqRow.business?.trim() || `${reqRow.name.trim()}'s Laundry`
  const slug = await findAvailableSlug(supabase, reqRow.business?.trim() || reqRow.name)

  const { data: location, error: insertError } = await supabase
    .from("locations")
    .insert({
      name: displayName,
      slug,
      business_name: displayName,
      status: "active",
      plan: "demo",
    })
    .select("id")
    .single()

  if (insertError || !location) {
    return { error: insertError?.message ?? "Failed to create demo site." }
  }

  await seedNewLocation(location.id)

  await supabase
    .from("platform_demo_requests")
    .update({ demo_location_id: location.id })
    .eq("id", requestId)

  const demoUrl = `https://${slug}.${PLATFORM_DOMAIN}`

  // Give them their own admin login (magic link, no password) — mirrors the
  // real tenant onboarding path in inviteLocationAdmin(), just without the
  // super-admin gate since there's no admin session at this point.
  await grantDemoAdminAccess(location.id, reqRow.email)

  // Send the "here's your demo" email pointing at their real subdomain.
  await sendPlatformDemoGuideEmail({
    name: reqRow.name,
    email: reqRow.email,
    business: reqRow.business,
    demoUrl,
  })
  await supabase
    .from("platform_demo_requests")
    .update({ demo_email_sent_at: new Date().toISOString() })
    .eq("id", requestId)

  return { success: true, demoUrl, locationId: location.id }
}

// Shared with inviteLocationAdmin's approach, duplicated here (rather than
// imported) because that function is requireSuperAdmin()-gated and this path
// runs with no admin session yet.
async function grantDemoAdminAccess(locationId: string, email: string): Promise<void> {
  const supabase = createAdminClient()
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes("@")) return

  const { data: userList } = await supabase.auth.admin.listUsers()
  let userId = userList?.users.find(u => u.email?.toLowerCase() === cleanEmail)?.id

  if (!userId) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
    })
    if (createError || !created?.user) {
      console.error("[platform-demo-site] createUser failed:", createError)
      return
    }
    userId = created.user.id
  }

  await supabase
    .from("location_users")
    .upsert(
      { location_id: locationId, user_id: userId, role: "admin", is_super_admin: false },
      { onConflict: "location_id,user_id" }
    )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const { data: linkData, error: linkGenError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: cleanEmail,
    options: { redirectTo: `${siteUrl}/admin/auth/callback?location_id=${locationId}` },
  })
  if (linkGenError) {
    console.error("[platform-demo-site] generateLink failed:", linkGenError)
    return
  }

  const magicLink = (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link
  if (magicLink) {
    const { sendAdminMagicLinkEmail } = await import("@/lib/email")
    await sendAdminMagicLinkEmail(cleanEmail, magicLink, locationId)
  }
}

// Manual trigger from /super-admin/demo-requests, for requests submitted
// before this feature existed or where auto-creation failed.
export async function manuallyCreateDemoSite(requestId: string): Promise<DemoSiteResult> {
  const { requireSuperAdmin } = await import("@/lib/auth-guard")
  await requireSuperAdmin()
  return createDemoTenantForRequest(requestId)
}
