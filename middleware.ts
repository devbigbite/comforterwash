import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/admin")) {
    const authCookie = request.cookies.get("admin_auth")
    if (!authCookie || authCookie.value !== "authenticated") {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
  // /operator and /track are intentionally public — no auth required
}
