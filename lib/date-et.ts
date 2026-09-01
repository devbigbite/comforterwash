/**
 * Returns today's date as "YYYY-MM-DD" in the given IANA timezone.
 * Use this on the server instead of new Date().toISOString().split("T")[0],
 * which returns UTC and will be "tomorrow" for a tenant after their local
 * evening.
 *
 * `tz` defaults to America/New_York for any caller that hasn't been updated
 * to pass a tenant's actual timezone (see lib/location.ts's
 * getLocationTimezone()) -- that default preserves today's behavior for
 * Orlando and any caller not yet migrated, rather than silently changing
 * what "today" means for them.
 */
export function todayET(tz: string = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date())
}
