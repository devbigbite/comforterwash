"use client"

import { useEffect, useState, useTransition } from "react"
import { getBookings, updateBookingStatus, setBookingFacilityRouting } from "@/app/actions/bookings"
import { getMyLaundromats, type Laundromat } from "@/app/actions/laundromats"

// A comforter order, or any order at/above this weight, doesn't fit most
// home washer/dryer setups — so it's pre-suggested (not forced) as needing
// a laundromat trip. The operator can always override either way.
const FACILITY_SUGGEST_LBS = 30

// The "Today's Work" board for solo/home-based operators — no facility, no
// racks, no transfer runs, just one washer/dryer and one person moving
// orders through three stages. Everything a facility tenant would do across
// /admin/dispatch + /admin/facility + /driver + /operator happens right here
// with a single tap per stage, since there's no one else to hand off to.
type Booking = {
  id: string
  short_code: string | null
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  pickup_date: string
  pickup_time_window: string | null
  delivery_date: string
  delivery_time_window: string | null
  service_type: string | null
  pounds: number | null
  needs_facility_wash: boolean
  routed_facility_id: string | null
  status: string
}

const COLUMNS: { status: string[]; title: string; nextStatus: string; actionLabel: string }[] = [
  { status: ["pending", "confirmed"], title: "To Pick Up", nextStatus: "picked_up", actionLabel: "Mark Picked Up" },
  { status: ["picked_up", "in_progress"], title: "Washing / Drying", nextStatus: "out_for_delivery", actionLabel: "Ready to Deliver" },
  { status: ["out_for_delivery"], title: "Ready to Deliver", nextStatus: "delivered", actionLabel: "Mark Delivered" },
]

function suggestsFacility(b: Booking): boolean {
  return b.service_type === "comforter_wash" || (b.pounds ?? 0) >= FACILITY_SUGGEST_LBS
}

export default function HomeBoardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [laundromats, setLaundromats] = useState<Laundromat[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  async function load() {
    const [data, spots] = await Promise.all([getBookings(), getMyLaundromats()])
    setBookings((data ?? []).filter(b => b.status !== "delivered" && b.status !== "cancelled") as Booking[])
    setLaundromats(spots)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function advance(bookingId: string, nextStatus: string) {
    startTransition(async () => {
      await updateBookingStatus(bookingId, nextStatus)
      await load()
    })
  }

  function toggleFacility(b: Booking, needsFacility: boolean) {
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, needs_facility_wash: needsFacility, routed_facility_id: needsFacility ? x.routed_facility_id : null } : x))
    startTransition(async () => {
      await setBookingFacilityRouting(b.id, needsFacility, needsFacility ? b.routed_facility_id : null)
    })
  }

  function pickFacility(b: Booking, facilityId: string) {
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, routed_facility_id: facilityId || null } : x))
    startTransition(async () => {
      await setBookingFacilityRouting(b.id, true, facilityId || null)
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0D2240]">Today's Work</h1>
        <p className="text-sm text-gray-400 mt-0.5">Pick up → wash → deliver — tap a card to move it forward.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          {COLUMNS.map(col => {
            const items = bookings.filter(b => col.status.includes(b.status))
            return (
              <div key={col.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm text-[#0D2240]">{col.title}</h2>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">{items.length}</span>
                </div>

                {items.length === 0 && (
                  <p className="text-xs text-gray-300 italic py-6 text-center">Nothing here right now</p>
                )}

                <div className="space-y-2">
                  {items.map(b => (
                    <div key={b.id} className="rounded-xl border border-gray-100 p-3">
                      <p className="font-semibold text-sm text-[#0D2240]">{b.customer_name}</p>
                      {b.customer_address && <p className="text-xs text-gray-400 mt-0.5">{b.customer_address}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.pickup_date} · {b.pickup_time_window ?? "—"}
                      </p>
                      {b.customer_phone && (
                        <a href={`tel:${b.customer_phone}`} className="text-xs text-[#E8726A] font-semibold mt-0.5 inline-block">
                          {b.customer_phone}
                        </a>
                      )}

                      {col.status[0] !== "out_for_delivery" && (
                        <div className="mt-2.5 pt-2 border-t border-gray-50">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={b.needs_facility_wash || suggestsFacility(b)}
                              onChange={e => toggleFacility(b, e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-[11px] font-semibold text-gray-500">🧺 Needs laundromat</span>
                          </label>
                          {(b.needs_facility_wash || suggestsFacility(b)) && laundromats.length > 0 && (
                            <select
                              value={b.routed_facility_id ?? ""}
                              onChange={e => pickFacility(b, e.target.value)}
                              className="mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-[#0D2240] bg-white"
                            >
                              <option value="">Which one?</option>
                              {laundromats.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => advance(b.id, col.nextStatus)}
                        className="mt-2.5 w-full bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors uppercase tracking-wide"
                      >
                        {col.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
