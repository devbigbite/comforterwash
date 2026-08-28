// ── Self-signup plan config ──────────────────────────────────────────────────
// Single flat plan shown on the public /start signup page (the "Stan Store"
// style checkout — pick it, pay it, get provisioned automatically). Edit the
// numbers below to change pricing; nothing else needs to change.
//
// NOTE: these are placeholder numbers — nobody confirmed real pricing when
// this was built. Update before sending real traffic to /start.
//
// There is NO free trial at this step -- payment is captured immediately.
// The only evaluation period is the separate /platform demo request flow
// (see DEMO_TRIAL_DAYS / isDemoExpired in lib/location.ts), which self-
// expires a prospect's demo site after 14 days. By the time someone reaches
// /start and enters payment info, they've already decided to subscribe.
export const SELF_SIGNUP_PLAN = {
  name: "WashFoldClean Platform",
  setupFeeCents: 19900,       // $199 one-time, charged immediately at checkout -- covers setup AND the first month of service
  monthlyPriceCents: 9900,    // $99/mo, billing starts once the first month (already covered by the setup fee) has elapsed
  firstMonthCoveredDays: 30,  // passed to Stripe as the subscription's trial_period_days -- NOT a customer trial, just delays
                               // the first recurring charge since the $199 setup fee already paid for month one
}
