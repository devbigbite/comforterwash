import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { resolveLocationFromHost, ORLANDO_LOCATION_ID } from "@/lib/location"

// ── Platform domain (set in env or fallback) ─────────────────────────────────
// e.g. "washfold.com" → subdomains like orlando.washfold.com are resolved
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfold.com"

// ── Simple in-memory location cache (avoids a DB hit on every request) ───────
const locationCache = new Map<string, { id: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ── Rate limiting for /partner/ routes ──────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000  // 1-minute sliding window
const RATE_LIMIT_MAX       = 20      // max requests per IP per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now()

  // Prune stale entries when store grows large
  if (rateLimitStore.size > 10_000) {
    for (const [k, v] of rateLimitStore) {
      if (now - v.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(k)
    }
  }

  const entry = rateLimitStore.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

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

// Both domains point at this same deployment, but browser cookies can't be
// shared across two separate root domains — logging into /admin on one and
// then visiting /super-admin on the other silently drops the session. So
// admin/super-admin traffic is pinned to one canonical domain; visiting from
// the other domain redirects here first, before any cookie is ever checked.
const CANONICAL_ADMIN_HOST = "comforterwash.com"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── -1. Pin /admin and /super-admin to one canonical domain ──────────────
  // /admin also needs the *tenant* the visitor was actually on before we lose
  // that context by rewriting the hostname — otherwise every tenant's admin
  // silently resolves to Orlando (the canonical host's own location). We
  // resolve it from the original subdomain/custom-domain here and stash it in
  // admin_location_id, which the /admin block below honors in place of the
  // (now-useless) host-based lookup.
  const rawHost = (request.headers.get("host") ?? "").split(":")[0].replace(/^www\./, "")
  if (
    rawHost &&
    rawHost !== CANONICAL_ADMIN_HOST &&
    (pathname.startsWith("/admin") || pathname.startsWith("/super-admin"))
  ) {
    const url = request.nextUrl.clone()
    url.protocol = "https:"
    url.hostname = CANONICAL_ADMIN_HOST
    url.port = ""
    const res = NextResponse.redirect(url, 308)
    if (pathname.startsWith("/admin")) {
      const tenantLocationId = await getLocationIdForHost(rawHost)
      res.cookies.set("admin_location_id", tenantLocationId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      })
    }
    return res
  }

  // ── 0. Rate limit /partner/ routes ───────────────────────────────────────
  if (pathname.startsWith("/partner/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"
    if (!checkRateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      )
    }
  }

  // ── 1. Resolve location from hostname ────────────────────────────────────
  const hostname = request.headers.get("host") ?? "localhost"
  const locationId = await getLocationIdForHost(hostname)

  // ── 2. Admin auth (cookie-based) ─────────────────────────────────────────
  // Under the canonical admin host, the hostname no longer tells us which
  // tenant we're in — admin_location_id (set above, or by the magic-link
  // callback / super-admin "Enter Admin") is the real source of truth here.
  const adminLocationOverride = request.cookies.get("admin_location_id")?.value
  const effectiveAdminLocationId = adminLocationOverride || locationId

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(request.headers), "x-location-id": effectiveAdminLocationId }) },
    })
  }
  if (pathname.startsWith("/admin")) {
    const authCookie = request.cookies.get("admin_auth")
    if (!authCookie || authCookie.value !== "authenticated") {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
    // Forward location header into admin too
    const res = NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(request.headers), "x-location-id": effectiveAdminLocationId }) },
    })
    return res
  }

  // ── 2b. Super-admin auth (cookie-based) ──────────────────────────────────
  // Gated here (not in app/super-admin/layout.tsx) so /super-admin/login
  // itself is never wrapped by the same check that redirects to it —
  // avoids an ERR_TOO_MANY_REDIRECTS loop.
  if (pathname.startsWith("/super-admin/login")) {
    return NextResponse.next()
  }
  if (pathname.startsWith("/super-admin")) {
    const superAuthCookie = request.cookies.get("super_admin_auth")
    if (!superAuthCookie || superAuthCookie.value !== "authenticated") {
      return NextResponse.redirect(new URL("/super-admin/login", request.url))
    }
    return NextResponse.next()
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
