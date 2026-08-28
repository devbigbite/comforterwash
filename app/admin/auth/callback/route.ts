import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EmailOtpType } from "@supabase/supabase-js"

// Redeeming a one-time sign-in token as a side effect of a plain GET is
// exactly what link-preview scanners, "safe links" email proxies, and
// messaging-app unfurlers do automatically -- they fetch the URL to render
// a preview or check it for safety, which silently consumes the token
// before the human ever clicks it. That's a real incident: a tenant admin's
// magic link showed as "used" (last_sign_in_at set) minutes after it was
// generated, before either the sender or the recipient had clicked it.
//
// Fix: GET renders a plain "Continue" button with no automatic network
// call -- nothing happens until a real user gesture fires the POST below,
// which is what a prefetcher never does. See app/login/callback/route.ts
// for the customer-facing equivalent, which has the same weakness and
// should get the same fix.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const locationId = searchParams.get("location_id")

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`)
  }

  const params = new URLSearchParams()
  if (code) params.set("code", code)
  if (tokenHash) params.set("token_hash", tokenHash)
  if (type) params.set("type", type)
  if (locationId) params.set("location_id", locationId)

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Sign in — WashFold Admin</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0D2240; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
  .card { background:#fff; border-radius:20px; padding:40px 36px; max-width:380px; width:calc(100% - 32px); text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.3); }
  h1 { font-size:20px; color:#0D2240; margin:0 0 8px; }
  p { color:#6b7280; font-size:14px; line-height:1.5; margin:0 0 24px; }
  button { width:100%; background:#0D2240; color:#fff; border:none; border-radius:12px; padding:14px 20px; font-size:15px; font-weight:700; cursor:pointer; }
  button:disabled { opacity:0.6; cursor:default; }
  .err { color:#dc2626; font-size:13px; margin-top:16px; display:none; }
  a { color:#0D2240; }
</style>
</head>
<body>
  <div class="card">
    <h1>Sign in to your admin dashboard</h1>
    <p>Click below to finish signing in. This confirms it's really you, not an automated link check.</p>
    <button id="go">Continue &rarr;</button>
    <p class="err" id="err">This link has already been used or has expired. <a href="/admin/login">Request a new one</a>.</p>
  </div>
  <script>
    document.getElementById('go').addEventListener('click', async function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      try {
        var res = await fetch('/admin/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: ${JSON.stringify(params.toString())},
        });
        var data = await res.json();
        if (data.ok) {
          window.location.href = '/admin';
        } else {
          document.getElementById('err').style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Continue →';
        }
      } catch (e) {
        document.getElementById('err').style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Continue →';
      }
    });
  </script>
</body>
</html>`

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } })
}

// Actually redeems the token -- only reachable via the button click above,
// never by a plain link fetch/prefetch.
export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null)
  const params = formData
    ? new URLSearchParams(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]))
    : new URLSearchParams(await request.text())

  const code = params.get("code")
  const tokenHash = params.get("token_hash")
  const type = params.get("type") as EmailOtpType | null
  const requestedLocationId = params.get("location_id")

  const supabase = await createClient()
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash as string })

  if (error || !data.user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })

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
