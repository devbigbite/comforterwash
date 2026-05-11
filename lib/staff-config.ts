/**
 * Staff clock configuration flags.
 * Adjust these constants to tune behaviour without touching logic.
 */

/** Minutes of leeway before a clock-in/out is flagged early or late. */
export const SCHEDULE_GRACE_MINUTES = 15

/**
 * Alert levels for schedule mismatches.
 *   Level 1 — passive flag visible in admin attendance view (always on)
 *   Level 2 — in-app warning shown to the worker at clock-in time (always on)
 *   Level 3 — real-time email to admin when an anomaly is detected
 */
export const SCHEDULE_ALERT_EMAIL_ENABLED = false   // Level 3 — flip to true to activate

/** Email address that receives Level 3 schedule anomaly alerts. */
export const SCHEDULE_ALERT_RECIPIENT = "clean@washfoldorlando.com"
