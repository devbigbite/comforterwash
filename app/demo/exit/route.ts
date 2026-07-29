import { NextResponse, type NextRequest } from "next/server"

// Clears the demo_location_id override cookie set by /demo, returning the
// visitor to whatever tenant their actual hostname resolves to.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = "/"
  url.search = ""

  const res = NextResponse.redirect(url)
  res.cookies.set("demo_location_id", "", { maxAge: 0, path: "/" })
  return res
}
