import { NextResponse, type NextRequest } from "next/server"

// Isolated demo tenant — the id of the internal "WashFoldDemo" location
// (grandfathered out of the Stripe Connect requirement, see
// lib/stripe-connect.ts, so prospects never hit a payment gate).
const DEMO_LOCATION_ID = "832b1605-cb3c-48d6-b8bc-125125834e19"

// Visiting /demo drops a cookie that makes middleware.ts resolve every
// subsequent request to the WashFoldDemo tenant instead of whatever real
// tenant the hostname would normally resolve to — so prospects exploring a
// demo never land on (or accidentally interact with) a real customer's site.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = "/"
  url.search = ""

  const res = NextResponse.redirect(url)
  res.cookies.set("demo_location_id", DEMO_LOCATION_ID, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 6, // 6 hours — a demo session shouldn't linger forever
    path: "/",
  })
  return res
}
