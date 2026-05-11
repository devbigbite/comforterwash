/**
 * Returns today's date as "YYYY-MM-DD" in America/New_York (Eastern Time).
 * Use this on the server instead of new Date().toISOString().split("T")[0],
 * which returns UTC and will be "tomorrow" for Orlando users after ~8pm ET.
 */
export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
}
