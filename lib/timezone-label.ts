/**
 * Turns an IANA timezone string (e.g. "America/Chicago") into a friendly
 * label customers/staff actually recognize. Uses Intl.DateTimeFormat's
 * long-form timezone name, which resolves the current name correctly
 * (handles DST -- "Central Standard Time" vs "Central Daylight Time" --
 * automatically) for any valid IANA zone, not just a hardcoded list.
 */

const ABBR_OVERRIDES: Record<string, string> = {
  // Intl's short form is inconsistent about DST for some zones (e.g. always
  // "CST" even mid-summer for some environments) -- these are the zones
  // ComforterWash tenants actually use, kept simple and correct.
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Phoenix": "MST",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AKT",
  "Pacific/Honolulu": "HT",
}

/** e.g. "Central Time" */
export function getTimezoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date())
    const name = parts.find(p => p.type === "timeZoneName")?.value
    if (!name) return tz
    // "Central Standard Time" / "Central Daylight Time" -> "Central Time"
    return name.replace(/ (Standard|Daylight) Time$/, " Time")
  } catch {
    return tz
  }
}

/** e.g. "CT" -- short form for SMS and compact UI, where space is tight. */
export function getTimezoneAbbr(tz: string): string {
  if (ABBR_OVERRIDES[tz]) return ABBR_OVERRIDES[tz]
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date())
    return parts.find(p => p.type === "timeZoneName")?.value ?? tz
  } catch {
    return tz
  }
}
