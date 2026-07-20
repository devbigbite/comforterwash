"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, ORLANDO_LOCATION_ID } from "@/lib/location"

/**
 * Call at the top of any server action that requires admin authentication
 * for the CURRENT tenant (location).
 *
 * Real path: a Supabase-authenticated user with a location_users row for
 * the current location_id (role admin, or is_super_admin).
 *
 * Legacy path: the original single-password admin_auth cookie, kept working
 * ONLY for the original WashFold Orlando location so the existing login
 * doesn't break mid-migration. New tenants never get this fallback — they
 * only exist via the real per-tenant auth path.
 */
export async function isAdminForCurrentLocation(): Promise<boolean> {
  const locationId = await getLocationId()

  // ── Real path: Supabase session + location_users ──────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from("location_users")
      .select("role, is_super_admin")
      .eq("user_id", user.id)
      .eq("location_id", locationId)
      .maybeSingle()

    if (membership && (membership.role === "admin" || membership.is_super_admin)) {
      return true
    }

    // Super admins can manage any location regardless of a location_users row
    // for that specific tenant (mirrors requireSuperAdmin's platform-wide reach).
    const { data: anySuperAdmin } = await admin
      .from("location_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_super_admin", true)
      .limit(1)
      .maybeSingle()
    if (anySuperAdmin) return true
  }

  // ── Legacy path: shared password, Orlando only ─────────────────────────────
  if (locationId === ORLANDO_LOCATION_ID) {
    const cookieStore = await cookies()
    if (cookieStore.get("admin_auth")?.value === "authenticated") return true
  }

  return false
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminForCurrentLocation())) {
    throw new Error("Unauthorized: admin access required")
  }
}

/**
 * Call at the top of any server action that requires super-admin (platform
 * owner) access — spans all tenants, e.g. creating new locations.
 */
export async function requireSuperAdmin(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const admin = createAdminClient()
    const { data } = await admin
      .from("location_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_super_admin", true)
      .limit(1)
      .maybeSingle()
    if (data) return
  }

  // Legacy fallback — same shared super_admin_auth cookie as before.
  const cookieStore = await cookies()
  if (cookieStore.get("super_admin_auth")?.value === "authenticated") return

  throw new Error("Unauthorized: super-admin access required")
}
