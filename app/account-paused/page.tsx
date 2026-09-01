// Shown by middleware.ts (see hostPaused / locations.paused) in place of any
// PUBLIC page on a tenant's site once that city's account has been paused --
// either automatically (Stripe subscription.deleted -> billing_status
// "canceled") or manually by the platform owner for any other reason (see
// pauseLocation/resumeLocation in app/actions/super-admin.ts). Deliberately
// does NOT block /admin -- a paused tenant can still sign in to see their
// billing status and existing orders; only new customer-facing traffic
// (booking, tracking, the marketing site) is blocked. In a multi-city
// account each city is its own `locations` row, so pausing one never
// touches a sibling city's site.
export default function AccountPausedPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="text-5xl mb-4">⏸️</div>
        <h1 className="text-2xl font-extrabold text-[#0D2240] mb-2">Temporarily unavailable</h1>
        <p className="text-sm text-gray-500 mb-4">
          This service is temporarily paused. Please check back soon, or contact the business
          directly if you have an order in progress.
        </p>
      </div>
    </div>
  )
}
