import type { MetadataRoute } from "next"
import { headers } from "next/headers"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("host") ?? "comforterwash.com"
  const base = `${proto}://${host}`

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/super-admin", "/staff", "/operator", "/driver", "/partner", "/track"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
