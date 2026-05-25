"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000

function getClientIp(): Promise<string> {
  return headers().then(h =>
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  )
}

export async function superAdminLoginAction(formData: FormData) {
  const superPassword = process.env.SUPER_ADMIN_PASSWORD
  if (!superPassword) throw new Error("SUPER_ADMIN_PASSWORD env var not set")

  const ip  = await getClientIp()
  const now = Date.now()

  const prev = failedAttempts.get(ip)
  if (prev && prev.resetAt > now && prev.count >= MAX_ATTEMPTS) {
    redirect("/super-admin/login?error=locked")
  }

  const password = formData.get("password") as string

  if (password !== superPassword) {
    const entry = failedAttempts.get(ip) ?? { count: 0, resetAt: now + LOCKOUT_MS }
    entry.count++
    if (entry.count === 1) entry.resetAt = now + LOCKOUT_MS
    failedAttempts.set(ip, entry)
    redirect("/super-admin/login?error=1")
  }

  failedAttempts.delete(ip)

  const cookieStore = await cookies()
  cookieStore.set("super_admin_auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  })

  redirect("/super-admin")
}

export async function superAdminLogoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete("super_admin_auth")
  redirect("/super-admin/login")
}
