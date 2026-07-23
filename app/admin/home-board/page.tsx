"use client"

import { useEffect, useState, useTransition } from "react"
import { getBookings, updateBookingStatus } from "@/app/actions/bookings"

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
  status: string
}

const COLUMNS: { status: string[]; title: string; nextStatus: string; actionLabel: string }[] = [
  { status: ["pending", "confirmed"], title: "To Pick Up", nextStatus: "picked_up", actionLabel: "Mark Picked Up" },
  { status: ["picked_up", "in_progress"], title: "Washing / Drying", nextStatus: "out_for_delivery", actionLabel: "Ready to Deliver" },
  { status: ["out_for_delivery"], title: "Ready to Deliver", nextStatus: "delivered", actionLabel: "Mark Delivered" },
]

export default function HomeBoardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  async function load() {
    const data = await getBookings()
    setBookings((data ?? []).filter(b => b.status !== "delivered" && b.status !== "cancelled") as Booking[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function advance(bookingId: string, nextStatus: string) {
    startTransition(async () => {
      await updateBookingStatus(bookingId, nextStatus)
      await load()
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
