import Link from "next/link"

// Shown by middleware.ts (see isDemoExpired / DEMO_TRIAL_DAYS in
// lib/location.ts) in place of any page on a demo tenant's site or admin
// dashboard once its 14-day evaluation window has passed. The only way back
// in is to actually subscribe at /start -- there is no second trial.
export default function DemoExpiredPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-extrabold text-[#0D2240] mb-2">Your demo has ended</h1>
        <p className="text-sm text-gray-500 mb-8">
          Your 14-day free evaluation of the WashFoldClean platform has expired. Subscribe now to
          keep your booking site, dispatch board, and admin dashboard running under your own name.
        </p>
        <Link
          href="/start"
          className="inline-block w-full bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-3.5 rounded-full uppercase tracking-wide transition-colors"
        >
          Subscribe now →
        </Link>
      </div>
    </div>
  )
}
