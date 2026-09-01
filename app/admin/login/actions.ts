"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getLocationId, ORLANDO_LOCATION_ID } from "@/lib/location"
import { isAdminForCurrentLocation } from "@/lib/auth-guard"

// ── Simple in-memory rate limiter (resets on cold start — fine for small app)
const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000 // 15 minutes

function getClientIp(): Promise<string> {
  return headers().then(h =>
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  )
}

// ── Legacy password login — kept working for the original WashFold Orlando
// admin only (see lib/auth-guard.ts). New tenants never use this path.
export async function loginAction(formData: FormData) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) throw new Error("ADMIN_PASSWORD env var not set")

  const ip  = await getClientIp()
  const now = Date.now()

  // Check lockout
  const prev = failedAttempts.get(ip)
  if (prev && prev.resetAt > now && prev.count >= MAX_ATTEMPTS) {
    redirect("/admin/login?error=locked&wfo=1")
  }

  const password = formData.get("password") as string

  if (password !== adminPassword) {
    // Record failure
    const entry = failedAttempts.get(ip) ?? { count: 0, resetAt: now + LOCKOUT_MS }
    entry.count++
    if (entry.count === 1) entry.resetAt = now + LOCKOUT_MS // start window on first failure
    failedAttempts.set(ip, entry)
    redirect("/admin/login?error=1&wfo=1")
  }

  // Success — clear any recorded failures
  failedAttempts.delete(ip)

  const cookieStore = await cookies()
  cookieStore.set("admin_auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  // Clear any leftover tenant override — admin_location_id gets set to a
  // DIFFERENT tenant's id whenever /admin is visited on a non-canonical host
  // (middleware.ts, "-1. Pin /admin...") or via super-admin "Enter Tenant
  // Admin" (enterTenantAdmin in app/actions/super-admin.ts), and persists for
  // 30 days. The legacy password login below is Orlando-only — if that
  // cookie is still pointing at some other tenant from an earlier visit,
  // requireAdmin() keeps failing even after a fresh, successful login,
  // because it resolves the wrong location_id and the legacy check only
  // passes for Orlando. Logging in as the password admin always means "take
  // me back to my own site," so any stale override needs to go.
  cookieStore.delete("admin_location_id")
  cookieStore.delete("super_admin_impersonating")

  // Single sign-on: logging into the original WashFold Orlando admin (the
  // owner's own operational login) also grants super-admin/SaaS-platform
  // access — no separate password to manage. Gated to the Orlando location
  // specifically so this can't grant super-admin from any other tenant's
  // subdomain even if they somehow guessed ADMIN_PASSWORD.
  if ((await getLocationId()) === ORLANDO_LOCATION_ID) {
    cookieStore.set("super_admin_auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days — match admin_auth
      path: "/",
    })
  }

  redirect("/admin")
}

// ── Real per-tenant login: email + password ──────────────────────────────
// Replaces the magic-link flow. That depended on outbound email actually
// landing, and on nothing else fetching the link before a human clicked it
// -- link-preview scanners and "safe links" proxies do exactly that, and
// silently burned at least one tenant admin's one-time token before they
// ever saw it. A password works the instant it's set and needs no email
// round-trip at all.
export async function signInWithPassword(formData: FormData): Promise<{ error?: string }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase()
  const password = formData.get("password") as string
  if (!email || !password) return { error: "Enter your email and password." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return { error: "Incorrect email or password." }
  }

  // Deliberately NOT derived from the request's hostname. This form can be
  // reached after a subdomain -> canonical-host redirect (see middleware.ts
  // "-1. Pin /admin..."), and a cookie set while responding from
  // perfect-spin.washfoldclean.com never reaches comforterwash.com -- two
  // different root domains don't share cookies. Host-based resolution here
  // silently fell back to Orlando and rejected every other tenant's admin
  // ("This account isn't an admin for this location") even with a correct
  // password. Instead, look up which tenant(s) this now-authenticated user
  // actually belongs to directly -- no host, no cookie, no redirect needed.
  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from("location_users")
    .select("location_id, is_super_admin")
    .eq("user_id", data.user.id)

  if (!memberships?.length) {
    await supabase.auth.signOut()
    return { error: "This account isn't an admin for any location." }
  }

  const isSuperAdmin = memberships.some(m => m.is_super_admin)
  // Prefer an ordinary tenant membership (what a tenant admin actually wants
  // to land on); a pure super admin with no tenant of their own falls back
  // to whichever location their row is attached to.
  const membership = memberships.find(m => !m.is_super_admin) ?? memberships[0]
  const locationId = membership.location_id

  const cookieStore = await cookies()
  cookieStore.set("admin_auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
  cookieStore.set("admin_location_id", locationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  })

  if (isSuperAdmin) {
    cookieStore.set("super_admin_auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
  }

  redirect("/admin")
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_auth")
  cookieStore.delete("super_admin_auth")
  cookieStore.delete("admin_location_id")
  cookieStore.delete("super_admin_impersonating")
  redirect("/admin/login")
}

export async function checkIsAdmin(): Promise<boolean> {
  return isAdminForCurrentLocation()
}

// ── Real per-tenant login: email magic link ──────────────────────────────────
// Only sends a link if the email is actually a location_users admin for the
// CURRENT tenant (or a super admin) — doesn't leak whether an email exists.
export async function requestAdminMagicLink(email: string): Promise<{ error?: string; sent?: boolean }> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes("@")) return { error: "Enter a valid email address." }

  const admin = createAdminClient()
  const locationId = await getLocationId()

  const { data: userList } = await admin.auth.admin.listUsers()
  const user = userList?.users.find(u => u.email?.toLowerCase() === cleanEmail)

  // Don't reveal whether the email matches an admin — same response either way.
  if (user) {
    const { data: membership } = await admin
      .from("location_users")
      .select("id, is_super_admin")
      .eq("user_id", user.id)
      .or(`location_id.eq.${locationId},is_super_admin.eq.true`)
      .limit(1)
      .maybeSingle()

    if (membership) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: cleanEmail,
        options: { redirectTo: `${siteUrl}/admin/auth/callback?location_id=${locationId}` },
      })
      // Build our own link from hashed_token rather than sending the raw
      // action_link — that delivers tokens as a URL hash fragment, which
      // never reaches the server and silently fails to sign anyone in.
      const tokenHash = (linkData as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token
      const magicLink = tokenHash
        ? `${siteUrl}/admin/auth/callback?token_hash=${tokenHash}&type=magiclink&location_id=${locationId}`
        : undefined
      if (magicLink) {
        const { sendAdminMagicLinkEmail } = await import("@/lib/email")
        await sendAdminMagicLinkEmail(cleanEmail, magicLink)
      }
    }
  }

  return { sent: true }
}


// ── Multi-city switcher ─────────────────────────────────────────────────────
// A single login can hold a location_users row for more than one location
// (e.g. a tenant who runs more than one city) -- this lists all of them so
// the admin nav can offer a switcher only when there's actually more than
// one to switch between, and lets the user actually switch which one
// admin_location_id (the cookie that decides which tenant's data every
// /admin page loads) points at.
export interface MyLocationOption {
  id: string
  name: string
}

export async function getMyLocations(): Promise<MyLocationOption[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from("location_users")
    .select("location_id")
    .eq("user_id", user.id)

  const locationIds = Array.from(new Set((memberships ?? []).map(m => m.location_id)))
  if (locationIds.length < 2) return []

  const { data: locations } = await admin
    .from("locations")
    .select("id, business_name, name")
    .in("id", locationIds)
    .order("name")

  return (locations ?? []).map(l => ({ id: l.id, name: l.business_name ?? l.name }))
}

export async function switchAdminLocation(locationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in." }

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from("location_users")
    .select("id")
    .eq("user_id", user.id)
    .eq("location_id", locationId)
    .maybeSingle()
  if (!membership) return { error: "You don't have access to that location." }

  const cookieStore = await cookies()
  cookieStore.set("admin_location_id", locationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  })

  redirect("/admin")
}
