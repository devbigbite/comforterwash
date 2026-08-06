import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const requestedLocationId = searchParams.get("location_id")

  // Links generated via supabase.auth.admin.generateLink() come back as a
  // token_hash, not a ?code= — their raw action_link delivers tokens as a
  // URL hash fragment that never reaches the server, so they must be
  // redeemed here via verifyOtp() instead (see /login/callback for the
  // customer-facing equivalent of this fix, confirmed broken 2026-08-06).
  if (code || (tokenHash && type)) {
    const supabase = await createClient()
    const { data, error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash as string })
    if (!error && data.user) {
      const res = NextResponse.redirect(`${origin}/admin`)

      // This is what actually lets a real (magic-link) admin session pass the
      // middleware's /admin gate — it currently only checks this one shared
      // cookie, regardless of auth mechanism. Without setting it here, every
      // real per-tenant login would bounce straight back to /admin/login.
      res.cookies.set("admin_auth", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })

      // Scope this session to the tenant the link was generated for — but
      // only if the now-authenticated user actually belongs to it, so a
      // tampered query param can't point a session at the wrong tenant.
      if (requestedLocationId) {
        const admin = createAdminClient()
        const { data: membership } = await admin
          .from("location_users")
          .select("id")
          .eq("user_id", data.user.id)
          .or(`location_id.eq.${requestedLocationId},is_super_admin.eq.true`)
          .limit(1)
          .maybeSingle()

        if (membership) {
          res.cookies.set("admin_location_id", requestedLocationId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
          })
        }
      }

      return res
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`)
}
