/**
 * Pickup date cutoff logic.
 *
 * Every function here takes an optional `tz` (IANA timezone string,
 * e.g. "America/Chicago") so a tenant's own configured timezone
 * (locations.timezone, via lib/location.ts's getLocationTimezone()) drives
 * what "today" and the cutoff hour mean for their customers. Defaults to
 * America/New_York (Eastern) when no tz is passed, so a caller that hasn't
 * been threaded through yet keeps today's existing behavior instead of
 * silently changing -- but every real call site should pass the tenant's
 * actual timezone.
 *
 * Rule: orders placed before 7 PM (tenant local time) can choose tomorrow.
 *       orders placed at or after 7 PM must choose the day after tomorrow
 *       (or the next applicable service day).
 */

const DEFAULT_TZ = "America/New_York"
const CUTOFF_HOUR = 19  // 7 PM, tenant local time

/**
 * Returns today's date string (YYYY-MM-DD) in the given timezone.
 * Safe to call on the server (Node) or client.
 */
export function todayET(tz: string = DEFAULT_TZ): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz })
  // en-CA locale produces YYYY-MM-DD which matches our DB date strings
}

/**
 * True if the current time, in the given timezone, is at or past the
 * 7 PM cutoff.
 */
export function isPastCutoff(tz: string = DEFAULT_TZ): boolean {
  const local = new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
  return local.getHours() >= CUTOFF_HOUR
}

/**
 * Returns the earliest Date object a customer may select for pickup, in
 * the given timezone.
 * - Before 7 PM local: tomorrow (local midnight)
 * - At/after 7 PM local: the day after tomorrow (local midnight)
 */
export function minPickupDate(tz: string = DEFAULT_TZ): Date {
  const local = new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
  local.setHours(0, 0, 0, 0)
  const daysAhead = isPastCutoff(tz) ? 2 : 1
  local.setDate(local.getDate() + daysAhead)
  return local
}

/**
 * Compares two dates by calendar day only (ignores time).
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * True if `d` is on or after `minPickupDate(tz)`.
 */
export function isOnOrAfterMinPickup(d: Date, tz: string = DEFAULT_TZ): boolean {
  const min = minPickupDate(tz)
  // Strip time for comparison
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  const mDay = new Date(min); mDay.setHours(0, 0, 0, 0)
  return dDay >= mDay
}
