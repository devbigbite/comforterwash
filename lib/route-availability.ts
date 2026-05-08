/**
 * Pure functions for computing booking calendar availability from active routes.
 *
 * Route recurrence semantics:
 *   "weekly"   — route runs every week (biweekly_start_date ignored)
 *   "biweekly" — route runs every other week; biweekly_start_date is the reference
 *                date (any date in an ON week). If null, treated as weekly.
 *   "both"     — route accepts both weekly and biweekly customers; runs every week.
 */

export type TimeWindow = {
  id: string
  route_id: string
  start_time: string    // "09:00" (24-hour)
  end_time: string      // "13:00" (24-hour)
  label: string         // "9:00 AM – 1:00 PM" (admin-set display label)
  max_bookings: number | null
  is_private: boolean
  sort_order: number
  /** Controls whether this window appears for pickup, delivery, or both.
   *  'both' (default) — shown on pickup AND delivery date pickers
   *  'pickup_only'    — shown only when selecting a pickup time slot
   *  'delivery_only'  — shown only when selecting a delivery time slot */
  window_type: 'both' | 'pickup_only' | 'delivery_only'
}

export type Route = {
  id: string
  name: string
  pickup_days: string[]            // ["monday", "tuesday", ...]
  delivery_days: string[]          // ["thursday", "friday", ...]
  recurrence: "weekly" | "biweekly" | "both"
  biweekly_start_date: string | null  // "YYYY-MM-DD" reference date for biweekly
  turnaround_days: number          // minimum days between pickup and delivery
  active: boolean
  time_windows: TimeWindow[]       // windows attached to this route
  facility_id: string | null       // home facility/warehouse for this route
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

/** Return the Monday (week start) of the week containing `d`. */
function getWeekStart(d: Date): Date {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const dow = day.getDay()
  day.setDate(day.getDate() - (dow === 0 ? 6 : dow - 1))
  return day
}

/**
 * True if `date` falls in an ON week for the given route.
 * "weekly" and "both" are always ON.
 * "biweekly" alternates: ON week = same parity as biweekly_start_date week.
 */
function isOnWeek(route: Route, date: Date): boolean {
  if (route.recurrence !== "biweekly") return true
  if (!route.biweekly_start_date) return true

  const ref = new Date(route.biweekly_start_date + "T00:00:00")
  const refMonday    = getWeekStart(ref)
  const targetMonday = getWeekStart(date)

  const diffMs    = targetMonday.getTime() - refMonday.getTime()
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))

  // Even diff = ON week; negative-safe mod
  return ((diffWeeks % 2) + 2) % 2 === 0
}

// ── Public: day availability ─────────────────────────────────────────────────

/** True if any active route serves pickups on this date. */
export function isPickupDay(date: Date, routes: Route[]): boolean {
  const dayName = DAY_NAMES[date.getDay()]
  return routes.some(r =>
    r.active &&
    (r.pickup_days ?? []).includes(dayName) &&
    isOnWeek(r, date)
  )
}

/** True if any active route serves deliveries on this date. */
export function isDeliveryDay(date: Date, routes: Route[]): boolean {
  const dayName = DAY_NAMES[date.getDay()]
  return routes.some(r =>
    r.active &&
    (r.delivery_days ?? []).includes(dayName) &&
    isOnWeek(r, date)
  )
}

// ── Public: time windows ──────────────────────────────────────────────────────

const FALLBACK_WINDOWS: TimeWindow[] = [
  { id: "fallback-am", route_id: "", start_time: "09:00", end_time: "13:00", label: "9:00 AM – 1:00 PM", max_bookings: null, is_private: false, sort_order: 0 },
  { id: "fallback-pm", route_id: "", start_time: "15:00", end_time: "19:00", label: "3:00 PM – 7:00 PM", max_bookings: null, is_private: false, sort_order: 1 },
]

/**
 * Returns the time windows available for a given date, based on which routes
 * serve that date as a pickup day (or delivery day).
 *
 * - Unions windows from all matching routes
 * - Deduplicates by start_time + end_time
 * - Excludes private windows
 * - Sorts by sort_order then start_time
 * - Falls back to standard 9am–1pm / 3pm–7pm if no windows are configured
 */
export function getTimeWindowsForDate(
  date: Date,
  routes: Route[],
  type: "pickup" | "delivery"
): TimeWindow[] {
  const dayName = DAY_NAMES[date.getDay()]

  const matchingRoutes = routes.filter(r => {
    if (!r.active) return false
    const days = type === "pickup" ? r.pickup_days : r.delivery_days
    return (days ?? []).includes(dayName) && isOnWeek(r, date)
  })

  if (matchingRoutes.length === 0) return FALLBACK_WINDOWS

  const seen = new Set<string>()
  const windows: TimeWindow[] = []

  for (const route of matchingRoutes) {
    for (const w of (route.time_windows ?? [])) {
      if (w.is_private) continue
      // Filter by window_type: 'both' always included; type-specific only match their side
      const wt = w.window_type ?? 'both'
      if (wt === 'pickup_only'   && type !== 'pickup')   continue
      if (wt === 'delivery_only' && type !== 'delivery') continue
      const key = `${w.start_time}-${w.end_time}`
      if (!seen.has(key)) {
        seen.add(key)
        windows.push(w)
      }
    }
  }

  // If routes exist but none have windows configured yet, fall back
  if (windows.length === 0) return FALLBACK_WINDOWS

  return windows.sort((a, b) =>
    a.sort_order !== b.sort_order
      ? a.sort_order - b.sort_order
      : a.start_time.localeCompare(b.start_time)
  )
}

/**
 * Returns all non-private time windows across all active routes, deduplicated.
 * Use this for recurring schedule pickers where no specific date is known.
 * Pass `type` to filter to pickup-only or delivery-only windows; omit for all.
 */
export function getAllTimeWindows(routes: Route[], type?: "pickup" | "delivery"): TimeWindow[] {
  const seen = new Set<string>()
  const windows: TimeWindow[] = []

  for (const route of routes) {
    if (!route.active) continue
    for (const w of (route.time_windows ?? [])) {
      if (w.is_private) continue
      // Filter by window_type when a type is specified
      const wt = w.window_type ?? 'both'
      if (wt === 'pickup_only'   && type !== 'pickup')   continue
      if (wt === 'delivery_only' && type !== 'delivery') continue
      const key = `${w.start_time}-${w.end_time}`
      if (!seen.has(key)) {
        seen.add(key)
        windows.push(w)
      }
    }
  }

  if (windows.length === 0) return FALLBACK_WINDOWS

  return windows.sort((a, b) =>
    a.sort_order !== b.sort_order
      ? a.sort_order - b.sort_order
      : a.start_time.localeCompare(b.start_time)
  )
}

// ── Public: earliest delivery ─────────────────────────────────────────────────

/**
 * Returns the minimum turnaround_days across all routes that serve the given
 * pickup date. Falls back to `defaultGap` (3) if no routes are configured.
 */
function getMinTurnaround(pickupDate: Date, routes: Route[], defaultGap = 3): number {
  const dayName = DAY_NAMES[pickupDate.getDay()]
  const servingRoutes = routes.filter(r =>
    r.active &&
    (r.pickup_days ?? []).includes(dayName) &&
    isOnWeek(r, pickupDate)
  )
  if (servingRoutes.length === 0) return defaultGap
  return Math.min(...servingRoutes.map(r => r.turnaround_days ?? defaultGap))
}

/**
 * Returns the earliest delivery date given a pickup date and active routes.
 * Uses the minimum turnaround_days from the routes serving the pickup date,
 * then finds the next date where isDeliveryDay is true.
 */
export function getEarliestRouteDelivery(pickup: Date, routes: Route[]): Date {
  const minGap = getMinTurnaround(pickup, routes)

  if (routes.length === 0) {
    // No routes yet — fall back to old Mon/Tue/Wed logic
    const d = new Date(pickup)
    d.setDate(d.getDate() + minGap)
    while ([0, 4, 5, 6].includes(d.getDay())) d.setDate(d.getDate() + 1)
    return d
  }

  const d = new Date(pickup)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + minGap)

  for (let i = 0; i < 60; i++) {
    if (isDeliveryDay(d, routes)) return new Date(d)
    d.setDate(d.getDate() + 1)
  }

  // Absolute fallback
  const fallback = new Date(pi