import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin auth (cookie-based, unchanged) ──────────────────────────
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next()
  }
  if (pathname.startsWith("/admin")) {
    const authCookie = request.cookies.get("admin_auth")
    if (!authCookie || authCookie.value !== "authenticated") {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
    return NextResponse.next()
  }

  // ── Supabase session refresh (required for SSR auth) ──────────────
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — don't destructure, just call getUser
  const { data: { user } } = await supabase.auth.getUser()

  // ── Protect /account ──────────────────────────────────────────────
  if (pathname.startsWith("/account") && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from /login
  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/account", request.url))
  }

  return response
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/login"],
}
