/**
 * lib/geocoding.ts
 *
 * Thin wrapper around the Google Geocoding API — used to turn a driver's
 * route starting address and customers' street addresses into lat/lng so
 * getDriverQueue() (app/actions/driver-queue.ts) can sort a driver's stops
 * by actual driving-relevant distance instead of just pickup/delivery date.
 *
 * Reuses the same Google Maps key already used client-side for Places
 * Autocomplete (components/address-autocomplete.tsx). If that key is
 * restricted to browser/referrer use only, or missing, or the API call
 * fails for any reason, every function here returns null rather than
 * throwing — callers must treat geocoding as best-effort and fall back to
 * their existing (date-based) ordering. This is not a required dependency;
 * distance sorting is a bonus when it's available.
 */

export interface LatLng {
  lat: number
  lng: number
}

const GEOCODE_TIMEOUT_MS = 4000

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key || !address?.trim()) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) return null

    const { lat, lng } = data.results[0].geometry.location
    return { lat, lng }
  } catch {
    return null
  }
}

// Haversine distance in miles — sufficient for ordering nearby stops within
// a metro area; doesn't need to be actual driving distance for that purpose.
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
