import Link from "next/link"
import { requireAdmin } from "@/lib/auth-guard"
import { getLocationId } from "@/lib/location"
import { createAdminClient } from "@/lib/supabase/admin"
import { FacilityPayoutForms } from "@/components/admin/FacilityPayoutForms"
import { PAYMENT_METHOD_LABEL } from "@/lib/facility-payment-methods"
import { todayET } from "@/lib/pickup-cutoff"

export const dynamic = "force-dynamic"

// Statuses that mean the facility has finished its work on an order, i.e. we
// owe them for it. Kept identical to issueFacilityPayout's filter in
// app/actions/facility-payments.ts — if those diverge, the balance shown here
// stops matching the amount the payout button actually sends.
const BILLABLE_STATUSES = ["ready_at_warehouse", "out_for_delivery", "delivered"]

function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function FacilityPaymentsPage() {
  await requireAdmin()

  const supabase  = createAdminClient()
  const locationId = await getLocationId()

  const { data: facilities } = await supabase
    .from("facilities")
    .select("id, name, address, rate_per_lb, minimum_lbs, stripe_account_id, stripe_onboarding_complete")
    .eq("location_id", locationId)
    .order("name")

  const facilityIds = (facilities ?? []).map(f => f.id)

  const [{ data: orders }, { data: payouts }] = await Promise.all([
    facilityIds.length
      ? supabase
          .from("bookings")
          .select("id, assigned_facility_id, facility_cost_cents, actual_weight_lbs, delivery_date")
          .in("assigned_facility_id", facilityIds)
          .in("status", BILLABLE_STATUSES)
          .not("facility_cost_cents", "is", null)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("facility_payouts")
      .select("id, facility_id, amount_cents, period_from, period_to, orders_count, total_lbs, stripe_transfer_id, status, payment_method, notes, created_at")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  // ── Per-facility rollup ────────────────────────────────────────────────────
  // "Accrued" is every billable order ever, not a date range — the balance is
  // meant to answer "what do we still owe this facility", which a period
  // filter would quietly understate.
  const accrued: Record<string, { cents: number; orders: number; lbs: number }> = {}
  for (const o of orders ?? []) {
    const fid = o.assigned_facility_id as string
    if (!fid) continue
    if (!accrued[fid]) accrued[fid] = { cents: 0, orders: 0, lbs: 0 }
    accrued[fid].cents  += o.facility_cost_cents ?? 0
    accrued[fid].orders += 1
    accrued[fid].lbs    += o.actual_weight_lbs ?? 0
  }

  const paid: Record<string, number> = {}
  for (const p of payouts ?? []) {
    paid[p.facility_id] = (paid[p.facility_id] ?? 0) + (p.amount_cents ?? 0)
  }

  const facilityName: Record<string, string> = Object.fromEntries(
    (facilities ?? []).map(f => [f.id, f.name]),
  )

  const rows = (facilities ?? []).map(f => {
    const a = accrued[f.id] ?? { cents: 0, orders: 0, lbs: 0 }
    const p = paid[f.id] ?? 0
    return { f, accruedCents: a.cents, orders: a.orders, lbs: a.lbs, paidCents: p, outstandingCents: a.cents - p }
  })

  const totalOutstanding = rows.reduce((s, r) => s + Math.max(r.outstandingCents, 0), 0)
  const totalAccrued     = rows.reduce((s, r) => s + r.accruedCents, 0)
  const totalPaid        = rows.reduce((s, r) => s + r.paidCents, 0)

  // todayET, not new Date().toISOString() — the server runs in UTC, so after
  // 8pm Eastern a raw toISOString() date is already "tomorrow" and the
  // prefilled Period To would sit a day ahead of the operator's actual date.
  const defaultTo   = todayET()
  const defaultFrom = `${defaultTo.slice(0, 7)}-01`

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-[#0D2240] mb-1">🏦 Facility Payments</h1>
        <p className="text-sm text-gray-400">
          What each partner facility has earned, what you&apos;ve already paid them, and how to settle the difference.{" "}
          <Link href="/admin/facilities" className="text-[#E8726A] font-semibold hover:underline">Edit facilities →</Link>
        </p>
      </div>

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Outstanding</p>
          <p className="text-2xl font-extrabold text-[#E8726A]">{fmt$(totalOutstanding)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Owed across all facilities</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Earned To Date</p>
          <p className="text-2xl font-extrabold text-[#0D2240]">{fmt$(totalAccrued)}</p>
          <p className="text-[11px] text-gray-400 mt-1">All completed orders, all time</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Paid To Date</p>
          <p className="text-2xl font-extrabold text-green-600">{fmt$(totalPaid)}</p>
          <p className="text-[11px] text-gray-400 mt-1">{(payouts ?? []).length} payment{(payouts ?? []).length === 1 ? "" : "s"} recorded</p>
        </div>
      </div>

      {/* ── Per facility ─────────────────────────────────────────────────── */}
      {rows.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-sm text-gray-400">No facilities set up yet.</p>
        </div>
      )}

      <div className="space-y-4 mb-10">
        {rows.map(({ f, accruedCents, orders, lbs, paidCents, outstandingCents }) => (
          <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="font-extrabold text-[#0D2240]">{f.name}</p>
                {f.address && <p className="text-xs text-gray-400 mt-0.5">{f.address}</p>}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {f.rate_per_lb != null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      ${Number(f.rate_per_lb).toFixed(2)}/lb
                    </span>
                  )}
                  {f.stripe_onboarding_complete ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Stripe ready</span>
                  ) : f.stripe_account_id ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">Stripe incomplete</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">No Stripe</span>
                  )}
                  <span className="text-[10px] text-gray-400">{orders} order{orders === 1 ? "" : "s"} · {lbs.toFixed(1)} lbs</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Outstanding</p>
                <p className={`text-2xl font-extrabold ${outstandingCents > 0 ? "text-[#E8726A]" : "text-green-600"}`}>
                  {fmt$(Math.max(outstandingCents, 0))}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {fmt$(accruedCents)} earned · {fmt$(paidCents)} paid
                </p>
                {outstandingCents < 0 && (
                  <p className="text-[11px] text-yellow-600 font-semibold mt-1">
                    Overpaid by {fmt$(-outstandingCents)}
                  </p>
                )}
              </div>
            </div>

            <details className="group border-t border-gray-100">
              <summary className="cursor-pointer px-5 py-2.5 text-xs font-semibold text-gray-400 hover:text-[#0D2240] transition-colors list-none flex items-center gap-1.5 select-none">
                <span className="group-open:hidden">💸 Pay this facility</span>
                <span className="hidden group-open:inline">💸 Close payment options</span>
              </summary>
              <div className="px-5 pb-5 pt-4 bg-[#f7f8fb] border-t border-gray-100">
                <FacilityPayoutForms
                  facilityId={f.id}
                  stripeReady={!!f.stripe_onboarding_complete}
                  suggestedAmount={Math.max(outstandingCents, 0)}
                  defaultFrom={defaultFrom}
                  defaultTo={defaultTo}
                />
              </div>
            </details>
          </div>
        ))}
      </div>

      {/* ── Combined ledger ──────────────────────────────────────────────── */}
      <section id="history">
        <h2 className="text-sm font-extrabold text-[#0D2240] mb-3">Payment History</h2>
        {(payouts ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-sm text-gray-400">No facility payments recorded yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Facility</th>
                  <th className="text-left px-4 py-3">Period</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-right px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(payouts ?? []).map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0D2240]">
                      {facilityName[p.facility_id] ?? "—"}
                      {p.notes && <span className="block text-[11px] text-gray-400 font-normal italic">{p.notes}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {p.period_from && p.period_to ? `${p.period_from} – ${p.period_to}` : "—"}
                      {p.orders_count != null && <span className="block text-[11px]">{p.orders_count} orders</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method}
                      {p.stripe_transfer_id && (
                        <span className="block text-[10px] text-gray-300 font-mono">{p.stripe_transfer_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-green-600 whitespace-nowrap">
                      {fmt$(p.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
