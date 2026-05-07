"use client"

import { useState } from "react"

const OPERATOR_ZONE = ["at_facility", "in_washer", "in_dryer", "folded"]

interface Bag { id: string; status: string; bag_number: number; label_code: string }
interface ActiveBooking {
  id: string; service_type: string; delivery_date: string
  actual_weight_lbs: number | null; facility_processing_mode: string
  order_bags: Bag[]
}
interface HistoryBooking {
  id: string; service_type: string; delivery_date: string
  actual_weight_lbs: number | null; facility_cost_cents: number | null; status: string
}
interface Facility {
  id: string; name: string; address: string | null; phone: string | null
  manager: string | null; owner: string | null
  rate_per_lb: number | null; minimum_lbs: number | null
  supports_partner_attendant: boolean; supports_own_operator: boolean
  partner_access_code: string
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
  { label: "This Week",  days: 7 },
  { label: "This Month", days: 30 },
  { label: "Last 90 Days", days: 90 },
]

export function PartnerPortalClient({
  facility, activeBookings, historyBookings, today, facilityCode, markOrderReadyAction,
}: {
  facility: Facility
  activeBookings: ActiveBooking[]
  historyBookings: HistoryBooking[]
  today: string
  facilityCode: string
  markOrderReadyAction: (fd: FormData) => Promise<void>
}) {
  const [tab, setTab]       = useState<"active" | "billing">("active")
  const [period, setPeriod] = useState(30)

  // Active split
  const needsWork = activeBookings.filter(b =>
    b.order_bags.some(bag => OPERATOR_ZONE.includes(bag.status))
  )
  const readyHere = activeBookings.filter(b =>
    b.order_bags.length > 0 &&
    b.order_bags.every(bag => bag.status === "ready")
  )

  // Billing period filter
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - period)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const periodHistory = historyBookings.filter(b => (b.delivery_date ?? "") >= cutoffStr)

  const totalLbs       = periodHistory.reduce((s, b) => s + (b.actual_weight_lbs ?? 0), 0)
  const totalOrders    = periodHistory.length
  const rate           = facility.rate_per_lb ?? 0
  const totalOwed      = periodHistory.reduce((s, b) => s + (b.facility_cost_cents ?? 0), 0)

  // Active lbs currently in facility
  const activeLbs = activeBookings.reduce((s, b) => s + (b.actual_weight_lbs ?? 0), 0)

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
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-[#E8726A]">{needsWork.length}</p>
              <p className="text-gray-400 text-xs mt-0.5">In Process</p>
            </div>
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-white">
                {activeLbs > 0 ? `${activeLbs.toFixed(1)}` : "—"}
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
          {([["active", "📋 Current Orders"], ["billing", "💰 Pounds & Billing"]] as const).map(([t, label]) => (
            <button
              key={t} onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-colors ${
                tab === t
                  ? "border-[#E8726A] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">

        {/* ── Active tab ─────────────────────────────────────────────────── */}
        {tab === "active" && (
          <>
            {/* Needs processing */}
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
                        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-800">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{b.service_type === "wash_fold" ? "🧺" : "🛏️"}</span>
                            <div>
                              <p className="font-bold text-white">{svcLabel(b.service_type)}</p>
                              <p className="text-gray-500 text-xs">Due {b.delivery_date} · {inZone.length} bag{inZone.length !== 1 ? "s" : ""}</p>
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
                        <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
                          {inZone.map(bag => (
                            <span key={bag.id} className="text-xs font-mono bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg">
                              {bag.label_code ?? `B${bag.bag_number}`}
                            </span>
                          ))}
                        </div>
                        {/* Mark ready — only for partner_attendant */}
                        {isPartner && (
                          <div className="px-5 pb-4 pt-1">
                            <form action={markOrderReadyAction}>
                              <input type="hidden" name="bookingId" value={b.id} />
                              <input type="hidden" name="facilityCode" value={facilityCode} />
                              <button type="submit"
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-extrabold text-base py-4 rounded-xl transition-colors">
                                ✅ Mark All Bags Ready for Pickup
                              </button>
                            </form>
                          </div>
                        )}
                        {!isPartner && (
                          <div className="px-5 pb-4 pt-1">
                            <p className="text-xs text-gray-600 italic text-center py-2">
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

            {/* Ready for pickup */}
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

        {/* ── Billing tab ─────────────────────────────────────────────── */}
        {tab === "billing" && (
          <>
            {/* Period selector */}
            <div className="flex gap-2">
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

            {/* Summary cards */}
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
                <p className="text-gray-500 text-xs mt-1">Amount Owed to You</p>
              </div>
            </div>

            {/* Rate info */}
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

            {/* Order history table */}
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                Order Breakdown
              </h2>
              {periodHistory.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
                  <p className="text-gray-500">No completed orders in this period.</p>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-4 px-5 py-3 border-b border-gray-800 bg-gray-800/60">
                    <p className="text-xs font-bold text-gray-500 uppercase">Date</p>
                    <p className="text-xs font-bold text-gray-500 uppercase">Service</p>
                    <p className="text-xs font-bold text-gray-500 uppercase text-right">Lbs</p>
                    <p className="text-xs font-bold text-gray-500 uppercase text-right">Earned</p>
                  </div>
                  {periodHistory.map((b, i) => (
                    <div key={b.id}
                      className={`grid grid-cols-4 px-5 py-3.5 items-center ${i < periodHistory.length - 1 ? "border-b border-gray-800/60" : ""}`}
                    >
                      <p className="text-sm text-gray-400">{b.delivery_date}</p>
                      <p className="text-sm text-gray-300">{svcLabel(b.service_type)}</p>
                      <p className="text-sm text-white font-semibold text-right">
                        {b.actual_weight_lbs?.toFixed(1) ?? "—"}
                      </p>
                      <p className="text-sm font-bold text-green-400 text-right">
                        {fmt$(b.facility_cost_cents)}
                      </p>
                    </div>
                  ))}
                  {/* Total row */}
                  <div className="grid grid-cols-4 px-5 py-4 bg-gray-800/60 border-t border-gray-700">
                    <p className="text-xs font-bold text-gray-400 col-span-2">TOTAL</p>
                    <p className="text-sm font-extrabold text-white text-right">{totalLbs.toFixed(1)} lbs</p>
                    <p className="text-sm font-extrabold text-green-400 text-right">{fmt$(totalOwed)}</p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
