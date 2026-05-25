"use server"

import { cookies } from "next/headers"

/**
 * Call at the top of any server action that requires admin authentication.
 * Throws an error (which Next.js surfaces as a 500) if the caller is not
 * an authenticated admin.  Cookie is set by app/admin/login/actions.ts.
 */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get("admin_auth")?.value !== "authenticated") {
    throw new Error("Unauthorized: admin access required")
  }
}

/**
 * Call at the top of any server action that requires super-admin access.
 * Uses a separate cookie from regular admin so super-admin pages can
 * require a second, independent password.
 */
export async function requireSuperAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get("super_admin_auth")?.value !== "authenticated") {
    throw new Error("Unauthorized: super-admin access required")
  }
}
