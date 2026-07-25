// Locale-aware short date formatting for the booking forms' date strips and
// summaries. date-fns' `format()` always renders English day/month names
// unless you pass a date-fns locale object — several booking forms were
// calling format(d, "EEE, MMM d") with no locale (always English) while
// others hardcoded a Spanish-only abbreviation array (always Spanish),
// so the displayed language didn't track the site's EN/ES toggle at all.
// This file is the single source of truth going forward.

import type { Locale } from "./i18n"

const DAY_ABBR: Record<Locale, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
}

const MON_ABBR: Record<Locale, string[]> = {
  en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  es: ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"],
}

const WEEKDAY_FULL: Record<Locale, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
}

export function dayAbbr(locale: Locale, dayOfWeek: number): string {
  return DAY_ABBR[locale][dayOfWeek]
}

export function monthAbbr(locale: Locale, monthIndex: number): string {
  return MON_ABBR[locale][monthIndex]
}

export function weekdayFull(locale: Locale, dayOfWeek: number): string {
  return WEEKDAY_FULL[locale][dayOfWeek]
}

// Matches the date-fns "EEE, MMM d" format used throughout the booking forms
// (e.g. "Wed, Jul 30" / "Mié, Jul 30"), but respects the active locale.
export function formatShortDate(d: Date, locale: Locale): string {
  return `${dayAbbr(locale, d.getDay())}, ${monthAbbr(locale, d.getMonth())} ${d.getDate()}`
}
