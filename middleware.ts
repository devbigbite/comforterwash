import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { resolveLocationFromHost, ORLANDO_LOCATION_ID, WASHFOLD_DEMO_LOCATION_ID, isDemoExpired } from "@/lib/location"
import { createClient as createEdgeAdminClient } from "@supabase/supabase-js"

// ── Platform domain (set in env or fallback) ─────────────────────────────────
// e.g. "washfoldclean.com" → subdomains like perfect-spin.washfoldclean.com
// are resolved. Must match the actual wildcard domain registered on Vercel —
// "washfold.com" was never registered and is not a live tenant domain.
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfoldclean.com"

// ── Simple in-memory location cache (avoids a DB hit on every request) ───────
// Carries demoExpired alongside the id so the 7-day demo self-expiry check
// (see lib/location.ts's isDemoExpired) doesn't need its own DB round trip.
const locationCache = new Map<string, { id: string; demoExpired: boolean; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// A second small cache keyed by location id, for the /admin path -- there the
// tenant is known via the admin_location_id cookie (not the hostname), so it
// needs its own lookup rather than reusing the host-keyed cache above.
const demoStatusByIdCache = new Map<string, { demoExpired: boolean; expiresAt: number }>()

async function isDemoExpiredForLocationId(locationId: string): Promise<boolean> {
  const cached = demoStatusByIdCache.get(locationId)
  if (cached && cached.expiresAt > Date.now()) return cached.demoExpired

  const supabase = createEdgeAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase.from("locations").select("plan, created_at").eq("id", locationId).maybeSingle()
  const demoExpired = isDemoExpired(data?.plan, data?.created_at)
  demoStatusByIdCache.set(locationId, { demoExpired, expiresAt: Date.now() + CACHE_TTL_MS })
  return demoExpired
}

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

async function getLocationIdForHost(hostname: string): Promise<{ id: string; demoExpired: boolean }> {
  const host = hostname.split(":")[0] // strip port for local dev

  // Local development: always use Orlando
  if (host === "localhost" || host === "127.0.0.1") {
    return { id: ORLANDO_LOCATION_ID, demoExpired: false }
  }

  // Check cache
  const cached = locationCache.get(host)
  if (cached && cached.expiresAt > Date.now()) {
    return { id: cached.id, demoExpired: cached.demoExpired }
  }

  // Resolve from DB
  const location = await resolveLocationFromHost(host, PLATFORM_DOMAIN)

  let id: string
  let demoExpired = false
  if (location) {
    id = location.id
    demoExpired = isDemoExpired(location.plan, location.created_at)
  } else {
    // No matching tenant. A *subdomain* of the platform domain that doesn't
    // match any real slug (e.g. a stale/mistyped or made-up demo link) falls
    // back to the internal WashFoldDemo sandbox — never to Orlando's real,
    // paying-customer site. The bare platform domain / an unmatched custom
    // domain still falls back to Orlando, same as before.
    const isUnmatchedSubdomain = new RegExp(`^[a-z0-9-]+\.${PLATFORM_DOMAIN.replace(".", "\.")}$`).test(host)
    id = isUnmatchedSubdomain ? WASHFOLD_DEMO_LOCATION_ID : ORLANDO_LOCATION_ID
  }

  // Cache the result
  locationCache.set(host, { id, demoExpired, expiresAt: Date.now() + CACHE_TTL_MS })

  return { id, demoExpired }
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
      const { id: tenantLocationId } = await getLocationIdForHost(rawHost)
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
  const { id: hostResolvedLocationId, demoExpired: hostDemoExpired } = await getLocationIdForHost(hostname)

  // Public-facing demo override — set by /demo (see app/demo/route.ts) so a
  // prospect exploring the sandbox sees the isolated WashFoldDemo tenant
  // instead of whatever real tenant this hostname would normally resolve to.
  // Never applies to /admin or /super-admin (those use admin_location_id).
  const demoLocationOverride = request.cookies.get("demo_location_id")?.value
  const locationId = demoLocationOverride || hostResolvedLocationId

  // ── 1b. Demo tenants self-expire after DEMO_TRIAL_DAYS ────────────────────
  // A prospect's demo (locations.plan === "demo", from the /platform
  // demo-request flow) is a time-boxed evaluation only -- see
  // lib/location.ts's isDemoExpired(). Once expired, every public page on
  // that tenant's subdomain/custom domain redirects to /demo-expired instead
  // of rendering, prompting them to /start for real (paid, no-trial)
  // access. Doesn't apply when a demo_location_id override is active (the
  // marketing site's own /demo sandbox is never itself expirable this way).
  if (hostDemoExpired && !demoLocationOverride && pathname !== "/demo-expired" && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/demo-expired", request.url))
  }

  // ── 2. Admin auth (cookie-based) ─────────────────────────────────────────
  // Under the canonical admin host, the hostname no longer tells us which
  // tenant we're in — admin_location_id (set above, or by the magic-link
  // callback / super-admin "Enter Admin") is the real source of truth here.
  const adminLocationOverride = request.cookies.get("admin_location_id")?.value
  // Deliberately falls back to hostResolvedLocationId, NOT locationId — locationId
  // folds in the public demo_location_id override (set by /demo for the
  // marketing site), which must never leak into /admin. Without this, a
  // visitor who'd previously clicked into the public demo would find their
  // own /admin/login (and /admin) silently resolving to the WashFoldDemo
  // tenant instead of their real one, purely because of a stray cookie set
  // on an unrelated page.
  const effectiveAdminLocationId = adminLocationOverride || hostResolvedLocationId

  // A demo tenant's admin dashboard is blocked the same way its public site
  // is (see 1b above) once the 7-day demo window has passed -- an expired
  // demo shouldn't stay usable just because someone still has an admin
  // session for it. Checked once here since both /admin/login and /admin
  // share it.
  if (
    (pathname.startsWith("/admin/login") || pathname.startsWith("/admin")) &&
    pathname !== "/demo-expired" &&
    (await isDemoExpiredForLocationId(effectiveAdminLocationId))
  ) {
    return NextResponse.redirect(new URL("/demo-expired", request.url))
  }

  if (pathname.startsWith("/admin/login")) {
    const res = NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(request.headers), "x-location-id": effectiveAdminLocationId, "x-pathname": pathname }) },
    })
    // A stray public demo_location_id cookie (from clicking /demo or a
    // tenant's public demo link) must never make the /admin demo banner
    // show up on a real tenant's dashboard — it already can't affect which
    // tenant's data loads (see effectiveAdminLocationId above), but the
    // cookie itself was still sitting in the browser for layout.tsx's
    // isDemo check to pick up. Clear it the moment /admin is reached.
    res.cookies.delete("demo_location_id")
    return res
  }
  if (pathname.startsWith("/admin")) {
    const authCookie = request.cookies.get("admin_auth")
    if (!authCookie || authCookie.value !== "authenticated") {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
    // Forward location header into admin too
    const res = NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(request.headers), "x-location-id": effectiveAdminLocationId, "x-pathname": pathname }) },
    })
    // See note above — same stray-cookie fix.
    res.cookies.delete("demo_location_id")
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
