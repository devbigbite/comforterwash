import type { MetadataRoute } from "next"
import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"

const SERVICE_SLUGS = ["wash-fold", "comforter-wash", "wash-only"] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("host") ?? "comforterwash.com"
  const base = `${proto}://${host}`

  const locationId = await getLocationId()
  const supabase = createAdminClient()
  const { data: areas } = await supabase
    .from("service_areas")
    .select("zip_code")
    .eq("location_id", locationId)
    .eq("active", true)

  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/service-areas`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/commercial`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ]

  const serviceEntries: MetadataRoute.Sitemap = SERVICE_SLUGS.map(slug => ({
    url: `${base}/services/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.9,
  }))

  const areaEntries: MetadataRoute.Sitemap = (areas ?? []).map(a => ({
    url: `${base}/service-areas/${a.zip_code}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  return [...staticEntries, ...serviceEntries, ...areaEntries]
}
