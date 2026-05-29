"use client"

import { useState } from "react"
import PhotoUploader from "@/app/operator/order/[id]/photo-uploader"
import type { FacilityPayout } from "@/app/actions/facility-payments"

const OPERATOR_ZONE = ["at_facility", "in_washer", "in_dryer", "folded"]

interface Bag { id: string; status: string; bag_number: number; label_code: string }
interface ActiveBooking {
  id: string; service_type: string; delivery_date: string
  actual_weight_lbs: number | null; facility_processing_mode: string
  order_bags: Bag[]
}
interface HistoryBooking {
  id: string; short_code: string | null; service_type: string; delivery_date: string
  actual_weight_lbs: number | null; facility_cost_cents: number | null; status: string
}
interface Facility {
  id: string; name: string; address: string | null; phone: string | null
  manager: string | null; owner: string | null
  rate_per_lb: number | null; minimum_lbs: number | null
  supports_partner_attendant: boolean; supports_own_operator: boolean
  partner_access_code: string
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  contact_email: string | null
}

function svcLabel(s: string) {
  if (s === "wash_fold") return "Wash & Fold"
  if (s === "wash_only") return "Wash Only"
  return "Comforter"
}
function fmt$(cents: number | null) {
  if (!cents) return "—"
  return "$" + (cents / 100).toFixed(2)
}

const PERIOD_OPTIONS = [
  { label: "This Week",    days: 7  },
  { label: "This Month",   days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "Custom",       days: 0  },
]
function todayStr() { return new Date().toISOString().slice(0, 10) }
function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

export function PartnerPortalClient({
  facility, activeBookings, historyBookings, payouts, today, facilityCode,
  partnerCompleteOrderAction, recordPartnerPhotoAction, connectStripeAction, syncStripeAction,
}: {
  facility: Facility
  activeBookings: ActiveBooking[]
  historyBookings: HistoryBooking[]
  payouts: FacilityPayout[]
  today: string
  facilityCode: string
  partnerCompleteOrderAction: (fd: FormData) => Promise<void>
  recordPartnerPhotoAction: (fd: FormData) => Promise<void>
  connectStripeAction: (fd: FormData) => Promise<void>
  syncStripeAction: (fd: FormData) => Promise<void>
}) {
  const [tab, setTab]         = useState<"active" | "billing" | "payments">("active")
  const [period, setPeriod]   = useState(30)
  const [customFrom, setFrom] = useState(daysAgoStr(30))
  const [customTo, setTo]     = useState(todayStr())

  const isCustom = period === 0
  const needsWork = activeBookings.filter(b =>
    b.order_bags.some(bag => OPERATOR_ZONE.includes(bag.status))
  )
  const readyHere = activeBookings.filter(b =>
    b.order_bags.length > 0 && b.order_bags.every(bag => bag.status === "ready")
  )

  const fromStr = isCustom ? customFrom : daysAgoStr(period)
  const toStr   = isCustom ? customTo   : todayStr()
  const periodHistory = historyBookings.filter(b => {
    const d = b.delivery_date ?? ""
    return d >= fromStr && d <= toStr
  })
  const totalLbs    = periodHistory.reduce((s, b) => s + (b.actual_weight_lbs ?? 0), 0)
  const totalOrders = periodHistory.length
  const rate        = facility.rate_per_lb ?? 0
  const totalOwed   = periodHistory.reduce((s, b) => s + (b.facility_cost_cents ?? 0), 0)
  const activeLbs   = activeBookings.reduce((s, b) => s + (b.actual_weight_lbs ?? 0), 0)

  // Stripe state
  const stripeConnected = !!facility.stripe_account_id
  const stripeComplete  = facility.stripe_onboarding_complete

  // Payout totals
  const totalPaid = payouts.reduce((s, p) => s + p.amount_cents, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">WashFold Partner Portal</p>
              <h1 className="text-2xl font-extrabold">{facility.name}</h1>
              {facility.address && <p className="text-gray-500 text-sm mt-0.5">{facility.address}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-gray-500 text-xs">{today}</p>
              {stripeComplete && (
                <span className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/60 text-green-400 border border-green-800">
                  Stripe ✓
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-[#E8726A]">{needsWork.length}</p>
              <p className="text-gray-400 text-xs mt-0.5">In Process</p>
            </div>
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-white">
                {activeLbs > 0 ? activeLbs.toFixed(1) : "—"}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">Lbs On Site</p>
            </div>
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-green-400">
                {rate > 0 ? `$${rate}/lb` : "—"}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">Your Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-5">
        <div className="max-w-2xl mx-auto flex gap-1">
          {([
            ["active",   "📋 Orders"],
            ["billing",  "💰 Billing"],
            ["payments", "🏦 Payments"],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3.5 text-sm font-bold border-b-2 transition-colors ${
                tab === t
                  ? "border-[#E8726A] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">

        {/* ── Active tab ───────────────────────────────────────────────────── */}
        {tab === "active" && (
          <>
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                Needs Processing ({needsWork.length})
              </h2>
              {needsWork.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-gray-400 font-semibold">All caught up — nothing to process right now.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {needsWork.map(b => {
                    const inZone = b.order_bags.filter(bag => OPERATOR_ZONE.includes(bag.status))
                    const isPartner = b.facility_processing_mode === "partner_attendant"
                    return (
                      <div key={b.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                        {/* Order header */}
                        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-800">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{b.service_type === "wash_fold" ? "🧺" : "🛏️"}</span>
                            <div>
                              <p className="font-bold text-white">{svcLabel(b.service_type)}</p>
                              <p className="text-gray-500 text-xs">
                                Due {b.delivery_date} · {inZone.length} bag{inZone.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {b.actual_weight_lbs ? (
                              <p className="font-extrabold text-lg text-white">{b.actual_weight_lbs} lbs</p>
                            ) : (
                              <p className="text-amber-400 text-xs font-semibold">Weight TBD</p>
                            )}
                            {b.actual_weight_lbs && rate > 0 && (
                              <p className="text-green-400 text-xs font-semibold">
                                ~{fmt$(Math.round(Math.max(b.actual_weight_lbs, facility.minimum_lbs ?? 0) * rate * 100))} earned
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bag codes */}
                        <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-gray-800">
                          {inZone.map(bag => (
                            <span key={bag.id} className="text-xs font-mono bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg">
                              {bag.label_code ?? `B${bag.bag_number}`}
                            </span>
                          ))}
                        </div>

                        {/* Completion form — only for partner_attendant */}
                        {isPartner ? (
                          <div className="px-5 py-4 space-y-4 bg-gray-900/80">
                            {/* Photo */}
                            <div className="bg-gray-800/60 rounded-xl p-3">
                              <PhotoUploader
                                bookingId={b.id}
                                action={recordPartnerPhotoAction}
                                label="📷 Completion Photos"
                                emptyHint="Take a photo of the folded/packed bags before marking ready."
                                compact
                              />
                            </div>

                            {/* Count + notes + submit */}
                            <form action={partnerCompleteOrderAction} className="space-y-3">
                              <input type="hidden" name="bookingId" value={b.id} />
                              <input type="hidden" name="facilityCode" value={facilityCode} />

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Bags Confirmed *
                                  </label>
                                  <input
                                    name="bag_count"
                                    type="number"
                                    min="1"
                                    defaultValue={inZone.length}
                                    required
                                    className="w-full rounded-xl border-2 border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#E8726A]"
                                  />
                                  <p className="text-[10px] text-gray-600 mt-1">Expected: {inZone.length}</p>
                                </div>
                                <div className="flex items-end">
                                  <button type="submit"
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-extrabold text-sm py-3 rounded-xl transition-colors">
                                    ✅ Mark Ready
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                  Notes (optional)
                                </label>
                                <textarea
                                  name="notes"
                                  rows={2}
                                  placeholder="Any issues? Missing items? Special notes for pickup?"
                                  className="w-full rounded-xl border-2 border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E8726A] resize-none"
                                />
                              </div>
                            </form>
                          </div>
                        ) : (
                          <div className="px-5 pb-4 pt-3">
                            <p className="text-xs text-gray-600 italic text-center">
                              WashFold operator managing this order — no action needed from you.
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {readyHere.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">
                  Ready — Awaiting Pickup ({readyHere.length})
                </h2>
                <div className="space-y-2">
                  {readyHere.map(b => (
                    <div key={b.id} className="bg-gray-900/60 rounded-xl border border-gray-800 px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{b.service_type === "wash_fold" ? "🧺" : "🛏️"}</span>
                        <div>
                          <p className="font-semibold text-gray-300 text-sm">{svcLabel(b.service_type)}</p>
                          <p className="text-gray-600 text-xs">{b.order_bags.length} bag{b.order_bags.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {b.actual_weight_lbs && <p className="text-white font-bold text-sm">{b.actual_weight_lbs} lbs</p>}
                        <span className="text-xs font-bold bg-green-900/60 text-green-400 px-2.5 py-0.5 rounded-full">Ready</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {needsWork.length === 0 && readyHere.length === 0 && (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-gray-500">No orders at your facility right now.</p>
                <p className="text-gray-700 text-sm mt-1">New orders appear here once WashFold drops them off.</p>
              </div>
            )}
          </>
        )}

        {/* ── Billing tab ──────────────────────────────────────────────────── */}
        {tab === "billing" && (
          <>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {PERIOD_OPTIONS.map(o => (
                  <button key={o.days} onClick={() => setPeriod(o.days)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      period === o.days
                        ? "bg-[#E8726A] border-[#E8726A] text-white"
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >{o.label}</button>
                ))}
              </div>
              {isCustom && (
                <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">From</label>
                    <input type="date" value={customFrom} max={customTo} onChange={e => setFrom(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#E8726A] [color-scheme:dark]" />
                  </div>
                  <span className="text-gray-600 text-sm shrink-0">→</span>
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">To</label>
                    <input type="date" value={customTo} min={customFrom} max={todayStr()} onChange={e => setTo(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#E8726A] [color-scheme:dark]" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-5 text-center">
                <p className="text-3xl font-extrabold text-white">{totalLbs.toFixed(1)}</p>
                <p className="text-gray-500 text-xs mt-1">Total Lbs Processed</p>
              </div>
              <div className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-5 text-center">
                <p className="text-3xl font-extrabold text-white">{totalOrders}</p>
                <p className="text-gray-500 text-xs mt-1">Orders Completed</p>
              </div>
              <div className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-5 text-center">
                <p className="text-3xl font-extrabold text-green-400">{fmt$(totalOwed)}</p>
                <p className="text-gray-500 text-xs mt-1">Earned This Period</p>
              </div>
            </div>

            {rate > 0 && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-900/40 flex items-center justify-center shrink-0">
                  <span className="text-xl">💵</span>
                </div>
                <div>
                  <p className="font-bold text-white">Your Rate: ${rate}/lb</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {facility.minimum_lbs && facility.minimum_lbs > 0
                      ? `Minimum ${facility.minimum_lbs} lbs per order applies`
                      : "No minimum lbs requirement"}
                  </p>
                </div>
              </div>
            )}

            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Order Breakdown</h2>
              {periodHistory.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
                  <p className="text-gray-500">No completed orders in this period.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
                        <th className="text-left pb-3">Order</th>
                        <th className="text-left pb-3">Date</th>
                        <th className="text-right pb-3">Lbs</th>
                        <th className="text-right pb-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {periodHistory.map(o => (
                        <tr key={o.id}>
                          <td className="py-3 font-mono text-gray-300">{o.short_code || o.id.slice(0, 6).toUpperCase()}</td>
                          <td className="py-3 text-gray-400">{o.delivery_date}</td>
                          <td className="py-3 text-right text-gray-300">{(o.actual_weight_lbs ?? 0).toFixed(1)}</td>
                          <td className="py-3 text-right font-bold text-green-400">{fmt$(o.facility_cost_cents ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── Payments tab ─────────────────────────────────────────────────── */}
        {tab === "payments" && (
          <>
            {/* Stripe Connect status */}
            {!stripeConnected && (
              <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
                <div>
                  <p className="font-extrabold text-white text-lg">💳 Connect Stripe to Receive Payments</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Set up your Stripe account so WashFold can transfer your earnings directly to your bank.
                    Takes about 5 minutes — you&apos;ll need your business EIN and bank details.
                  </p>
                </div>
                <form action={connectStripeAction}>
                  <input type="hidden" name="facilityId" value={facility.id} />
                  <input type="hidden" name="facilityCode" value={facilityCode} />
                  <button type="submit"
                    className="w-full bg-[#635BFF] hover:bg-[#4F46E5] text-white font-extrabold text-base py-4 rounded-xl transition-colors">
                    → Connect with Stripe
                  </button>
                </form>
              </div>
            )}

            {stripeConnected && !stripeComplete && (
              <div className="bg-amber-950/40 rounded-2xl border border-amber-800 p-6 space-y-4">
                <div>
                  <p className="font-extrabold text-amber-400 text-lg">⚠️ Stripe Setup Incomplete</p>
                  <p className="text-amber-200/70 text-sm mt-1">
                    Your Stripe account has been created but onboarding isn&apos;t finished yet.
                    Complete setup to start receiving payouts.
                  </p>
                </div>
                <div className="flex gap-3">
                  <form action={connectStripeAction} className="flex-1">
                    <input type="hidden" name="facilityId" value={facility.id} />
                    <input type="hidden" name="facilityCode" value={facilityCode} />
                    <button type="submit"
                      className="w-full bg-[#635BFF] hover:bg-[#4F46E5] text-white font-bold text-sm py-3 rounded-xl transition-colors">
                      Resume Setup →
                    </button>
                  </form>
                  <form action={syncStripeAction}>
                    <input type="hidden" name="facilityId" value={facility.id} />
                    <input type="hidden" name="facilityCode" value={facilityCode} />
                    <button type="submit"
                      className="border border-gray-700 text-gray-400 hover:text-white font-bold text-sm py-3 px-4 rounded-xl transition-colors">
                      Check Status
                    </button>
                  </form>
                </div>
              </div>
            )}

            {stripeConnected && stripeComplete && (
              <div className="bg-green-950/40 rounded-2xl border border-green-800 px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-900/60 flex items-center justify-center text-2xl shrink-0">✅</div>
                <div>
                  <p className="font-bold text-green-400">Stripe Connected</p>
                  <p className="text-green-300/60 text-xs mt-0.5">Payouts are issued by WashFold admin and deposited weekly (Fridays).</p>
                </div>
              </div>
            )}

            {/* Summary */}
            {payouts.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-5 text-center">
                  <p className="text-3xl font-extrabold text-green-400">{fmt$(totalPaid)}</p>
                  <p className="text-gray-500 text-xs mt-1">Total Paid Out</p>
                </div>
                <div className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-5 text-center">
                  <p className="text-3xl font-extrabold text-white">{payouts.length}</p>
                  <p className="text-gray-500 text-xs mt-1">Payments Received</p>
                </div>
              </div>
            )}

            {/* Payout history */}
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Payment History</h2>
              {payouts.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
                  <p className="text-gray-500 text-sm">No payments yet.</p>
                  <p className="text-gray-700 text-xs mt-1">
                    {stripeComplete
                      ? "WashFold will issue your first payout once orders complete."
                      : "Connect Stripe above to start receiving payments."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map(p => (
                    <div key={p.id} className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{fmt$(p.amount_cents)}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {p.period_from && p.period_to
                            ? `${p.period_from} – ${p.period_to}`
                            : new Date(p.created_at).toLocaleDateString()}
                          {p.orders_count ? ` · ${p.orders_count} orders` : ""}
                          {p.total_lbs ? ` · ${Number(p.total_lbs).toFixed(1)} lbs` : ""}
                        </p>
                        {p.notes && <p className="text-gray-600 text-xs mt-0.5 italic">{p.notes}</p>}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        p.status === "transferred"
                          ? "bg-green-900/60 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}>
                        {p.status === "transferred" ? "Paid" : p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
