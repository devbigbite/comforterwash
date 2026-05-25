"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

// ── Simple in-memory rate limiter (resets on cold start — fine for small app)
const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000 // 15 minutes

function getClientIp(): Promise<string> {
  return headers().then(h =>
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  )
}

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
  const cookieStore = await cookies()
  return cookieStore.get("admin_auth")?.value === "authenticated"
}
