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
import { WASHFOLD_DEMO_LOCATION_ID } from "@/lib/location"

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfoldclean.com"

// New tenants otherwise fall back to the same generic /hero-banner.jpg for all
// 3 hero slides (see lib/site-images-config.ts's DEFAULT_IMAGES) — repeated,
// obviously-a-placeholder-looking hero, with generic "Comforter Wash &
// Delivery" copy underneath. Copying the WashFoldDemo tenant's own uploaded
// hero/offer photos AND its hero headline/subline/CTA text (settings keys
// "img_%" and "txt_slide_%") gives every prospect's demo site a polished,
// cohesive hero out of the box instead of that mismatched placeholder.
async function copyHeroContentFromWashFoldDemo(supabase: ReturnType<typeof createAdminClient>, newLocationId: string): Promise<void> {
  const { data: demoRows } = await supabase
    .from("settings")
    .select("key, value")
    .eq("location_id", WASHFOLD_DEMO_LOCATION_ID)
    .or("key.like.img_%,key.like.txt_slide_%")

  if (!demoRows?.length) return

  await supabase.from("settings").upsert(
    demoRows.map(({ key, value }) => ({ location_id: newLocationId, key, value })),
    { onConflict: "location_id,key" }
  )
}

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
    .select("id, name, email, business, demo_location_id, preferred_language")
    .eq("id", requestId)
    .maybeSingle()

  if (!reqRow) return { error: "Demo request not found." }

  // Site already exists for this request — skip re-provisioning, but still
  // actually (re)send the guide email. This branch is what "Resend guide"
  // hits for any lead whose demo site was already created, so it must not
  // just recompute the URL and bail — that previously made "Resend guide"
  // report success without sending anything.
  if (reqRow.demo_location_id) {
    const { data: existing } = await supabase
      .from("locations")
      .select("slug")
      .eq("id", reqRow.demo_location_id)
      .maybeSingle()
    if (existing) {
      const demoUrl = `https://${existing.slug}.${PLATFORM_DOMAIN}`
      const emailResult = await sendPlatformDemoGuideEmail({
        name: reqRow.name,
        email: reqRow.email,
        business: reqRow.business,
        demoUrl,
        language: reqRow.preferred_language,
      })
      if (emailResult.error) return { error: emailResult.error }
      await supabase
        .from("platform_demo_requests")
        .update({ demo_email_sent_at: new Date().toISOString() })
        .eq("id", requestId)
      const { logAutomatedActivity } = await import("@/app/actions/platform-demo-activities")
      await logAutomatedActivity(requestId, "email_sent", "Demo guide email resent")
      return { success: true, demoUrl, locationId: reqRow.demo_location_id }
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
      demo_started_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !location) {
    return { error: insertError?.message ?? "Failed to create demo site." }
  }

  await seedNewLocation(location.id)
  await copyHeroContentFromWashFoldDemo(supabase, location.id)

  await supabase
    .from("platform_demo_requests")
    .update({ demo_location_id: location.id })
    .eq("id", requestId)

  const demoUrl = `https://${slug}.${PLATFORM_DOMAIN}`

  // Give them their own admin login — mirrors the real tenant onboarding
  // path in inviteLocationAdmin(), just without the super-admin gate since
  // there's no admin session at this point. Returns the generated password
  // so it can go out in the SAME email as the demo link below, rather than
  // a separate send -- two independent sends were two independent chances
  // for one to silently fail, which is exactly how a real prospect got the
  // demo-site email but never got an admin login at all.
  const adminPassword = await grantDemoAdminAccess(location.id, reqRow.email)

  // Send the "here's your demo" email pointing at their real subdomain,
  // with the admin login included directly.
  await sendPlatformDemoGuideEmail({
    name: reqRow.name,
    email: reqRow.email,
    business: reqRow.business,
    demoUrl,
    language: reqRow.preferred_language,
    adminEmail: adminPassword ? reqRow.email : undefined,
    adminPassword: adminPassword ?? undefined,
  })
  await supabase
    .from("platform_demo_requests")
    .update({ demo_email_sent_at: new Date().toISOString() })
    .eq("id", requestId)
  {
    const { logAutomatedActivity } = await import("@/app/actions/platform-demo-activities")
    await logAutomatedActivity(requestId, "email_sent", "Demo guide email sent (auto-provisioned)")
  }

  return { success: true, demoUrl, locationId: location.id }
}

// Generates a random, human-typeable password -- avoids visually ambiguous
// characters (0/O, 1/l/I) since this often gets read off a phone screen or
// retyped by hand. Duplicated from super-admin.ts's identical helper rather
// than imported, same reason as below.
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let out = ""
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// Shared with inviteLocationAdmin's approach, duplicated here (rather than
// imported) because that function is requireSuperAdmin()-gated and this path
// runs with no admin session yet.
//
// Used to send a magic-link sign-in email here, same as
// _inviteLocationAdminCore in super-admin.ts did before that was fixed --
// but being a separate copy-pasted function, fixing that one didn't fix
// this one. This is actually the highest-volume of the three paths (every
// demo-request submission hits it, not just paying signups), which is
// exactly the one a real prospect hit and never got a working admin login
// from. Now emails a real password the same way the other two paths do --
// nothing for a scanner or link-preview fetch to consume.
// Returns the newly generated password (so the caller can fold it into the
// single combined email), or null if this admin already had an account --
// an existing account keeps its existing password rather than being reset
// and re-sent one it didn't ask for.
async function grantDemoAdminAccess(locationId: string, email: string): Promise<string | null> {
  const supabase = createAdminClient()
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes("@")) return null

  const { data: userList } = await supabase.auth.admin.listUsers()
  let userId = userList?.users.find(u => u.email?.toLowerCase() === cleanEmail)?.id
  let tempPassword: string | null = null

  if (!userId) {
    tempPassword = generateTempPassword()
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
    })
    if (createError || !created?.user) {
      console.error("[platform-demo-site] createUser failed:", createError)
      return null
    }
    userId = created.user.id
  }

  await supabase
    .from("location_users")
    .upsert(
      { location_id: locationId, user_id: userId, role: "admin", is_super_admin: false },
      { onConflict: "location_id,user_id" }
    )

  return tempPassword
}

// Manual trigger from /super-admin/demo-requests, for requests submitted
// before this feature existed or where auto-creation failed.
export async function manuallyCreateDemoSite(requestId: string): Promise<DemoSiteResult> {
  const { requireSuperAdmin } = await import("@/lib/auth-guard")
  await requireSuperAdmin()
  return createDemoTenantForRequest(requestId)
}
