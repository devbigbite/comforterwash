"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
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
    redirect("/admin/login?error=locked")
  }

  const password = formData.get("password") as string

  if (password !== adminPassword) {
    // Record failure
    const entry = failedAttempts.get(ip) ?? { count: 0, resetAt: now + LOCKOUT_MS }
    entry.count++
    if (entry.count === 1) entry.resetAt = now + LOCKOUT_MS // start window on first failure
    failedAttempts.set(ip, entry)
    redirect("/admin/login?error=1")
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

  redirect("/admin")
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_auth")
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
        options: { redirectTo: `${siteUrl}/admin/auth/callback` },
      })
      const magicLink = (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link
      if (magicLink) {
        const { sendAdminMagicLinkEmail } = await import("@/lib/email")
        await sendAdminMagicLinkEmail(cleanEmail, magicLink)
      }
    }
  }

  return { sent: true }
}
