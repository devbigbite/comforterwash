"use server"

import { createClient } from "@/lib/supabase/server"

// Lets the currently signed-in admin change their own password -- no admin
// privileges needed, just an authenticated session (already required to
// reach /admin/settings at all -- see middleware.ts's admin_auth gate).
// Uses the regular session-scoped Supabase client (updateUser operates on
// "whoever this session belongs to"), not the service-role admin client
// used by super-admin's "Set password" for OTHER accounts.
export async function changeOwnPassword(newPassword: string): Promise<{ error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You need to be signed in to change your password." }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }

  return {}
}
