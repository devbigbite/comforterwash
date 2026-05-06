/**
 * Pickup date cutoff logic for WashFold Orlando.
 * Timezone: America/New_York (Eastern)
 * Rule: orders placed before 3 PM ET can choose tomorrow.
 *       orders placed at or after 3 PM ET must choose the day after tomorrow
 *       (or the next applicable service day).
 */

const TZ = "America/New_York"
const CUTOFF_HOUR = 15  // 3 PM

/**
 * Returns today's date string (YYYY-MM-DD) in Eastern time.
 * Safe to call on the server (Node) or client.
 */
export function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
  // en-CA locale produces YYYY-MM-DD which matches our DB date strings
}

/**
 * True if the current Eastern time is at or past the 3 PM cutoff.
 */
export function isPastCutoff(): boolean {
  const eastern = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }))
  return eastern.getHours() >= CUTOFF_HOUR
}

/**
 * Returns the earliest Date object a customer may select for pickup.
 * - Before 3 PM ET: tomorrow (local midnight)
 * - At/after 3 PM ET: the day after tomorrow (local midnight)
 */
export function minPickupDate(): Date {
  const eastern = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }))
  eastern.setHours(0, 0, 0, 0)
  const daysAhead = isPastCutoff() ? 2 : 1
  eastern.setDate(eastern.getDate() + daysAhead)
  return eastern
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
 * True if `d` is on or after `minPickupDate()`.
 */
export function isOnOrAfterMinPickup(d: Date): boolean {
  const min = minPickupDate()
  // Strip time for comparison
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  const mDay = new Date(min); mDay.setHours(0, 0, 0, 0)
  return dDay >= mDay
}
