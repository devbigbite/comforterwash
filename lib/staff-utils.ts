/** Duration in minutes between two ISO timestamps (or now if end is null) */
export function minutesBetween(start: string, end: string | null): number {
  const from = new Date(start).getTime()
  const to   = end ? new Date(end).getTime() : Date.now()
  return Math.floor((to - from) / 60000)
}

/** Format minutes as "Xh Ym" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Same duration as a decimal hours figure, which is what payroll actually
 * multiplies by an hourly rate: 20h 32m → "20.53". Two decimal places, since
 * one (20.5) loses up to 3 minutes per line and the error compounds across a
 * timesheet.
 */
export function decimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2)
}
