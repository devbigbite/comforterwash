/** Pure utility — NO "use server" directive.
 *  Importing this from a "use server" file is safe because it exports only
 *  a regular synchronous function, not a Server Action. */

export function isWithinAccessWindow(
  windows: { days_of_week: number[]; start_time: string; end_time: string; overnight: boolean }[],
  date: Date = new Date()
): boolean {
  if (windows.length === 0) return true

  const dayOfWeek = date.getDay()
  const timeStr   = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`

  for (const w of windows) {
    if (!w.days_of_week.includes(dayOfWeek)) continue

    if (w.overnight) {
      // e.g. 21:00 – 06:00  → valid if time >= 21:00 OR time <= 06:00
      if (timeStr >= w.start_time || timeStr <= w.end_time) return true
    } else {
      if (timeStr >= w.start_time && timeStr <= w.end_time) return true
    }
  }
  return false
}
