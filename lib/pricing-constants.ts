// ── Shared billing constants ──────────────────────────────────────────────
// Pulled out of app/actions/weigh-in.ts because that file has "use server" —
// Next.js Server Actions files may only export async functions, so plain
// constants (FALLBACK_MIN_LBS, DEFAULT_RATE_CENTS) can't live there even
// though weigh-in.ts is their main consumer. This file has no directive, so
// both server code (weigh-in.ts, transport-runs.ts) and the driver order
// page can import it safely.

// Fallback order minimum, in pounds. The REAL minimum is admin-configurable
// per location and per service type in the `settings` table
// (wash_fold_min_lbs / wash_only_min_lbs — see app/actions/pricing.ts) and is
// resolved at billing time by resolveMinLbs() in lib/order-minimum.ts. This
// constant is only the safety net for when that settings read fails.
//
// History: this used to be `CUSTOMER_MIN_LBS = 20`, hardcoded, and it was the
// only minimum the billing path knew about — while checkout quoted customers
// off the settings value of 18. The two silently disagreed, so a light order
// was quoted at 18 lb but any recalculation billed it (and paid the facility)
// at 20 lb. Do not reintroduce a hardcoded minimum here; change it in admin.
export const FALLBACK_MIN_LBS = 18

// Fallback only — used when a booking has no locked-in price_per_lb_cents
// (shouldn't normally happen for a real consumer booking; kept as a safety
// net so weighing never hard-fails on a data gap). Keep this in sync with
// the live settings-table rates (wash_fold_one_time_cents, etc. — see
// app/actions/pricing.ts) whenever pricing changes; a stale value here only
// bites the rare booking that reaches weigh-in with no locked-in rate, but
// when it does it silently undercharges (this is what happened on order
// 714600: price_per_lb_cents was null, so this fallback billed $2.50/lb
// instead of the real $2.55/lb rate).
export const DEFAULT_RATE_CENTS: Record<string, number> = { wash_fold: 255, wash_only: 199, comforter_wash: 0 }
