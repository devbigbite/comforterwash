import { createAdminClient } from "@/lib/supabase/admin"
import { approveWorker, rejectWorker, updatePayRates, createStripeConnectAccount } from "@/app/actions/workers"
import Link from "next/link"

const STATUS_BADGE: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  active:   "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
}

const ROLE_BADGE: Record<string, string> = {
  driver:   "bg-[#0D2240]/10 text-[#0D2240]",
  operator: "bg-purple-100 text-purple-700",
}

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = "pending" } = await searchParams
  const supabase = createAdminClient()

  const statusFilter = tab === "active"
    ? ["active"]
    : tab === "all"
    ? ["pending", "approved", "active", "rejected"]
    : ["pending"]

  const { data: workers = [] } = await supabase
    .from("workers")
    .select("*")
    .in("status", statusFilter)
    .order("created_at", { ascending: false })

  const { data: counts } = await supabase
    .from("workers")
    .select("status")

  const tally = { pending: 0, active: 0, all: 0 }
  counts?.forEach((w) => {
    tally.all++
    if (w.status === "pending") tally.pending++
    if (w.status === "active")  tally.active++
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Workers</h1>
          <p className="text-sm text-gray-400">Drivers &amp; Operators — applications, pay rates, Stripe payouts</p>
        </div>
        <a href="/apply" target="_blank"
          className="text-xs font-bold text-[#E8726A] border border-[#E8726A] px-4 py-2 rounded-full hover:bg-[#fdf6f3] transition-colors uppercase tracking-wide">
          View Apply Page ↗
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "pending", label: `Pending (${tally.pending})` },
          { key: "active",  label: `Active (${tally.active})` },
          { key: "all",     label: `All (${tally.all})` },
        ].map((t) => (
          <Link key={t.key} href={`/admin/workers?tab=${t.key}`}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
              tab === t.key ? "bg-white text-[#0D2240] shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* Worker cards */}
      {workers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No {tab} workers found.
        </div>
      ) : (
        <div className="space-y-4">
          {workers.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-extrabold text-[#0D2240]">{w.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[w.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {w.status}
                    </span>
                    {w.roles?.map((r: string) => (
                      <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${ROLE_BADGE[r] ?? "bg-gray-100 text-gray-500"}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>✉️ {w.email}</span>
                    {w.phone && <span>📞 {w.phone}</span>}
                    {w.address && <span>📍 {w.address}</span>}
                    {w.has_vehicle && <span className="text-green-600 font-semibold">🚗 Has vehicle</span>}
                  </div>
                  {w.experience && (
                    <p className="text-xs text-gray-500 mt-2 italic max-w-xl">"{w.experience}"</p>
                  )}
                </div>

                {/* Stripe status */}
                <div className="shrink-0 text-right">
                  {w.stripe_account_id ? (
                    <div className="space-y-1">
                      <span className={`block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        w.stripe_onboarding_complete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        Stripe: {w.stripe_onboarding_complete ? "✓ Ready" : "⏳ Pending"}
                      </span>
                      <Link href={`/admin/workers/${w.id}`}
                        className="block text-[10px] text-[#E8726A] font-bold hover:underline">
                        View details →
                      </Link>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-300 font-medium">No Stripe account</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-3 items-center">

                {/* Pending → approve or reject */}
                {w.status === "pending" && (
                  <>
                    <form action={approveWorker.bind(null, w.id)}>
                      <button className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors uppercase tracking-wide">
                        ✓ Approve
                      </button>
                    </form>
                    <form action={rejectWorker.bind(null, w.id, undefined)}>
                      <button className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-4 py-2 rounded-lg transition-colors uppercase tracking-wide border border-red-200">
                        ✗ Reject
                      </button>
                    </form>
                  </>
                )}

                {/* Approved/active → set rates + Stripe */}
                {(w.status === "approved" || w.status === "active") && (
                  <>
                    {/* Set pay rates inline */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-bold text-[#0D2240] bg-white border border-gray-200 px-4 py-2 rounded-lg hover:border-[#0D2240] transition-colors list-none uppercase tracking-wide">
                        💰 Set Pay Rates
                      </summary>
                      <form action={updatePayRates} className="mt-3 bg-white border border-gray-200 rounded-xl p-4 space-y-3 min-w-[340px]">
                        <input type="hidden" name="workerId" value={w.id} />
                        {/* Hourly wage — used for clock-in/out pay calculation */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                          <span className="text-lg">⏱</span>
                          <div className="flex-1">
                            <label className="text-[10px] text-amber-700 uppercase tracking-wide font-bold block mb-1">Hourly Wage ($/hr)</label>
                            <input type="number" name="hourly_wage" step="0.01" min="0"
                              defaultValue={((w.hourly_wage_cents ?? 0) / 100).toFixed(2)}
                              className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm font-bold text-[#0D2240] focus:outline-none focus:border-amber-400" />
                          </div>
                          <p className="text-[10px] text-amber-600 leading-tight max-w-[90px]">Used for time-sheet pay calculations</p>
                        </div>
                        <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide">Driver Stripe Rates</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Order ($)</label>
                            <input type="number" name="driver_per_order" step="0.01" min="0"
                              defaultValue={((w.driver_per_order_cents ?? 0) / 100).toFixed(2)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Mile ($)</label>
                            <input type="number" name="driver_per_mile" step="0.01" min="0"
                              defaultValue={((w.driver_per_mile_cents ?? 0) / 100).toFixed(2)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
                          </div>
                        </div>
                        <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide pt-1">Operator Stripe Rates</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Hour ($)</label>
                            <input type="number" name="operator_per_hour" step="0.01" min="0"
                              defaultValue={((w.operator_per_hour_cents ?? 0) / 100).toFixed(2)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Mile ($)</label>
                            <input type="number" name="operator_per_mile" step="0.01" min="0"
                              defaultValue={((w.operator_per_mile_cents ?? 0) / 100).toFixed(2)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
                          </div>
                        </div>
                        <button type="submit"
                          className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-xs font-bold py-2.5 rounded-lg transition-colors uppercase tracking-wide">
                          Save Rates &amp; Mark Active
                        </button>
                      </form>
                    </details>

                    {/* Stripe Connect */}
                    <StripeConnectButton workerId={w.id} hasAccount={!!w.stripe_account_id} onboardingComplete={w.stripe_onboarding_complete} />

                    {/* Payout link */}
                    {w.stripe_onboarding_complete && (
                      <Link href={`/admin/workers/${w.id}`}
                        className="text-xs font-bold text-[#E8726A] border border-[#E8726A] px-4 py-2 rounded-lg hover:bg-[#fdf6f3] transition-colors uppercase tracking-wide">
                        💸 Issue Payout
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Client component just for the Stripe button (needs redirect)
function StripeConnectButton({ workerId, hasAccount, onboardingComplete }: {
  workerId: string
  hasAccount: boolean
  onboardingComplete: boolean
}) {
  return (
    <form action={async () => {
      "use server"
      const { createStripeConnectAccount } = await import("@/app/actions/workers")
      const result = await createStripeConnectAccount(workerId)
      if (result.url) {
        // We can't redirect from a server action embedded in RSC easily,
        // so we link to the worker detail page which handles this
      }
    }}>
      <Link href={`/admin/workers/${workerId}`}
        className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors uppercase tracking-wide border ${
          onboardingComplete
            ? "border-green-200 text-green-700 bg-green-50"
            : hasAccount
            ? "border-amber-200 text-amber-700 bg-amber-50"
            : "border-[#0D2240] text-[#0D2240] hover:bg-[#0D2240] hover:text-white"
        }`}>
        {onboardingComplete ? "✓ Stripe Connected" : hasAccount ? "⏳ Resend Stripe Link" : "⚡ Connect Stripe"}
      </Link>
    </form>
  )
}
