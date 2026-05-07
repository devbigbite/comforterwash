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
