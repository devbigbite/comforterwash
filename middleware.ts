import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { resolveLocationFromHost, ORLANDO_LOCATION_ID } from "@/lib/location"

// ── Platform domain (set in env or fallback) ─────────────────────────────────
// e.g. "washfold.com" → subdomains like orlando.washfold.com are resolved
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfold.com"

// ── Simple in-memory location cache (avoids a DB hit on every request) ───────
const locationCache = new Map<string, { id: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function getLocationIdForHost(hostname: string): Promise<string> {
  const host = hostname.split(":")[0] // strip port for local dev

  // Local development: always use Orlando
  if (host === "localhost" || host === "127.0.0.1") {
    return ORLANDO_LOCATION_ID
  }

  // Check cache
  const cached = locationCache.get(host)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id
  }

  // Resolve from DB
  const location = await resolveLocationFromHost(host, PLATFORM_DOMAIN)
  const id = location?.id ?? ORLANDO_LOCATION_ID

  // Cache the result
  locationCache.set(host, { id, expiresAt: Date.now() + CACHE_TTL_MS })

  return id
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Resolve location from hostname ────────────────────────────────────
  const hostname = request.headers.get("host") ?? "localhost"
  const locationId = await getLocationIdForHost(hostname)

  // ── 2. Admin auth (cookie-based) ─────────────────────────────────────────
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next()
  }
  if (pathname.startsWith("/admin")) {
    const authCookie = request.cookies.get("admin_auth")
    if (!authCookie || authCookie.value !== "authenticated") {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
    // Forward location header into admin too
    const res = NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(request.headers), "x-location-id": locationId }) },
    })
    return res
  }

  // ── 3. Supabase session refresh + location header ────────────────────────
  // Clone headers and inject x-location-id so server components can read it
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-location-id", locationId)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

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
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── 4. Protect /account ──────────────────────────────────────────────────
  if (pathname.startsWith("/account") && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/account", request.url))
  }

  return response
}

export const config = {
  // Run on all routes so every request gets the x-location-id header
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
