// Auto-fetched ZIP Code Tabulation Area (ZCTA) boundary polygons, used as a
// fallback on the per-ZIP service area page when a tenant hasn't drawn their
// own custom delivery-zone shape in Admin > Service Area Map Editor. ZCTAs
// are the Census Bureau's standard polygon proxy for ZIP codes -- this is
// free, public, official government data, no API key required.
//
// Source: Census Bureau TIGERweb REST API (layer 2 = current ZCTAs).
// Boundaries essentially never change, so responses are cached for 30 days.
const TIGERWEB_ZCTA_QUERY_URL =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2/query"

const ZIP_RE = /^\d{5}$/

// Cap how many ZIPs go into a single request so the query string (and the
// upstream service) never gets pushed past a reasonable size.
const MAX_ZIPS_PER_REQUEST = 150

/**
 * Fetches the official Census ZCTA boundary polygon for a single ZIP code.
 * Returns null (never throws) if the ZIP is invalid, the request fails, or
 * the Census service has no boundary on file for it.
 */
export async function getZctaBoundary(zip: string): Promise<object | null> {
  return getZctaBoundariesForZips([zip])
}

/**
 * Fetches a combined GeoJSON FeatureCollection covering every ZIP in the
 * list (each ZIP stays its own polygon feature -- they are not merged into
 * one shape). Returns null (never throws) on any failure or if none of the
 * ZIPs have a boundary on file.
 */
export async function getZctaBoundariesForZips(zips: string[]): Promise<object | null> {
  const clean = Array.from(new Set(zips.filter(z => ZIP_RE.test(z)))).slice(0, MAX_ZIPS_PER_REQUEST)
  if (clean.length === 0) return null

  try {
    const where = `ZCTA5 IN (${clean.map(z => `'${z}'`).join(",")})`
    const url = `${TIGERWEB_ZCTA_QUERY_URL}?where=${encodeURIComponent(where)}&outFields=ZCTA5&f=geojson`
    const res = await fetch(url, {
      // Boundaries are effectively static -- cache aggressively.
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !Array.isArray(data.features) || data.features.length === 0) return null
    return data as object
  } catch {
    // Network error, Census outage, malformed response, etc. -- fall back
    // to the existing "coming soon" placeholder rather than breaking the page.
    return null
  }
}
