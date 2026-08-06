"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// ── Get profile data for the currently authenticated user ─────────────────────
export async function getAuthenticatedProfile(): Promise<{
  fullName: string
  phone: string
  savedAddress: string
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone, saved_address")
    .eq("id", user.id)
    .single()

  return {
    fullName: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
    phone:    profile?.phone     || user.user_metadata?.phone     || "",
    savedAddress: profile?.saved_address || "",
  }
}

// ── Auto-create account for a new recurring subscriber ───────────────────────
// Called server-side after a successful subscription payment.
// Creates user (or finds existing), upserts profile, sends magic-link access email.
export async function createAccountForSubscriber(
  email: string,
  name: string,
  phone: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient()

  // Attempt to create auth user (email_confirm skips the verification email)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name, phone },
  })

  const isAlreadyExists = createError?.message?.toLowerCase().includes("already registered")
    || createError?.message?.toLowerCase().includes("already been registered")
    || createError?.status === 422

  if (createError && !isAlreadyExists) {
    console.error("[customer-auth] createAccountForSubscriber:", createError.message)
    return { success: false, error: createError.message }
  }

  // Upsert profile with name + phone if we got a userId
  const userId = created?.user?.id
  if (userId) {
    await admin.from("profiles").upsert({
      id: userId,
      full_name: name,
      phone,
      updated_at: new Date().toISOString(),
    })
  }

  // Generate a magic link so the customer can access their account (no password needed).
  // NOTE: we deliberately do NOT send Supabase's own action_link — that delivers
  // the session as a URL hash fragment (#access_token=...), which never reaches
  // our server and silently fails to sign anyone in (confirmed broken 2026-08-06).
  // Instead we build our own link pointed at /login/callback, which redeems the
  // token_hash server-side via verifyOtp() — the same proven path /login uses.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/account` },
  })

  if (linkError) {
    console.error("[customer-auth] generateLink:", linkError.message)
    return { success: true } // Account exists, just link failed
  }

  const tokenHash = (linkData as any)?.properties?.hashed_token as string | undefined
  if (tokenHash) {
    const magicLink = `${siteUrl}/login/callback?token_hash=${tokenHash}&type=magiclink&next=/account`
    const { sendAccountReadyEmail } = await import("@/lib/email")
    await sendAccountReadyEmail(email, name, magicLink, true)
  }

  return { success: true }
}

// ── Optional account creation for one-time customers (post-payment prompt) ────
export async function createOptionalAccount(
  email: string,
  name: string,
  phone: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name, phone },
  })

  const isAlreadyExists = createError?.message?.toLowerCase().includes("already registered")
    || createError?.message?.toLowerCase().includes("already been registered")
    || createError?.status === 422

  if (createError && !isAlreadyExists) {
    console.error("[customer-auth] createOptionalAccount:", createError.message)
    return { success: false, error: createError.message }
  }

  const userId = created?.user?.id
  if (userId) {
    await admin.from("profiles").upsert({
      id: userId,
      full_name: name,
      phone,
      updated_at: new Date().toISOString(),
    })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/account` },
  })

  if (linkError) {
    return { success: true }
  }

  const tokenHash = (linkData as any)?.properties?.hashed_token as string | undefined
  if (tokenHash) {
    const magicLink = `${siteUrl}/login/callback?token_hash=${tokenHash}&type=magiclink&next=/account`
    const { sendAccountReadyEmail } = await import("@/lib/email")
    await sendAccountReadyEmail(email, name, magicLink, false)
  }

  return { success: true }
}
