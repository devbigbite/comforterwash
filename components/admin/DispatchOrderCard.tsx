"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
  comforter_wash: "Comforter",
}

const STATUS_DOT: Record<string, string> = {
  confirmed:        "bg-blue-400",
  picked_up:        "bg-purple-400",
  in_progress:      "bg-orange-400",
  out_for_delivery: "bg-green-500",
  delivered:        "bg-gray-300",
  cancelled:        "bg-red-400",
}

export type DispatchBooking = {
  id: string
  short_code: string | null
  customer_name: string
  customer_address: string
  customer_phone: string
  pickup_date: string
  pickup_time_window: string
  delivery_date: string
  delivery_time_window: string
  service_type: string
  num_bags: number | null
  num_comforters: number | null
  status: string
  shipday_pickup_order_id: number | null
  shipday_delivery_order_id: number | null
  assigned_facility: { name: string } | null
}

export function DispatchOrderCard({
  booking: b,
  type,
  date,
  drivers = [],
  assignDriverAction,
  rescheduleAction,
  cancelAction,
}: {
  booking: DispatchBooking
  type: "pickup" | "delivery"
  date: string
  drivers?: { id: string; name: string; email: string }[]
  assignDriverAction: (fd: FormData) => Promise<void>
  rescheduleAction: (fd: FormData) => Promise<void>
  cancelAction: (fd: FormData) => Promise<void>
}) {
  const orderCode = b.short_code ?? b.id.slice(0, 6).toUpperCase()
  const synced = type === "pickup" ? !!b.shipday_pickup_order_id : !!b.shipday_delivery_order_id
  const shipdayId = type === "pickup" ? b.shipday_pickup_order_id : b.shipday_delivery_order_id
  const bagCount = b.num_bags ?? b.num_comforters ?? 1
  const facility = b.assigned_facility as { name: string } | null

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedDriverEmail, setSelectedDriverEmail] = useState("")
  const [toast, setToast] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await assignDriverAction(fd)
      setSelectedDriverEmail("")
      showToast("Driver assigned")
    })
  }

  function handleReschedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await rescheduleAction(fd)
      setRescheduleOpen(false)
      showToast("Rescheduled")
    })
  }

  function handleCancel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!confirm("Remove from Shipday routing?")) return
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await cancelAction(fd)
      showToast("Removed from routing")
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible relative">

      {toast && (
        <div className="absolute top-2 right-2 z-20 bg-[#0D2240] text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Card header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black font-mono text-[#0D2240] text-sm">{orderCode}</span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status] ?? "bg-gray-300"}`} />
            <span className="text-xs text-gray-400 font-semibold">{b.status?.replace(/_/g, " ")}</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {SERVICE_LABELS[b.service_type] ?? b.service_type}
            </span>
            <span className="text-[10px] text-gray-400 font-semibold">
              {bagCount} bag{bagCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="font-semibold text-[#0D2240] text-sm truncate">{b.customer_name}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{b.customer_address}</p>
          {facility && (
            <p className="text-[10px] text-purple-600 font-semibold mt-0.5">{facility.name}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            synced ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-600 border border-amber-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${synced ? "bg-green-500" : "bg-amber-400"}`} />
            {synced ? `SD #${shipdayId}` : "Not in Shipday"}
          </div>
          <Link href={`/admin/orders/${b.id}`}
            className="text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold transition-colors">
            View order
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-t border-gray-50 px-4 py-3 bg-[#fafbfd] flex gap-3 flex-wrap items-center">

        {/* Assign driver */}
        <form onSubmit={handleAssign} className="flex gap-1.5 flex-1 min-w-[180px]">
          <input type="hidden" name="bookingId" value={b.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="driverEmail" value={selectedDriverEmail} />
          {drivers.length > 0 ? (
            <select
              required
              disabled={!synced || isPending}
              value={selectedDriverEmail}
              onChange={e => setSelectedDriverEmail(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] bg-white focus:outline-none focus:ring-1 focus:ring-[#E8726A]/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">Select driver...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.email}>{d.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="email"
              name="driverEmail"
              placeholder="driver@email.com"
              required
              disabled={!synced || isPending}
              value={selectedDriverEmail}
              onChange={e => setSelectedDriverEmail(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#E8726A]/40 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          )}
          <button
            type="submit"
            disabled={!synced || isPending || !selectedDriverEmail}
            className="rounded-lg bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] px-2.5 py-1.5 transition-colors whitespace-nowrap"
          >
            {isPending ? "..." : "Assign"}
          </button>
        </form>

        {/* Reschedule popover */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setRescheduleOpen(o => !o)}
            className="text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold transition-colors px-1 py-1.5"
          >
            {rescheduleOpen ? "Close" : "Reschedule..."}
          </button>

          {rescheduleOpen && (
            <div className="absolute bottom-full mb-2 left-0 z-20 w-56 bg-white rounded-xl border border-gray-100 shadow-lg p-3">
              <form onSubmit={handleReschedule} className="space-y-1.5">
                <input type="hidden" name="bookingId" value={b.id} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="currentDate" value={date} />
                <input
                  type="date"
                  name="newDate"
                  defaultValue={type === "pickup" ? b.pickup_date : b.delivery_date}
                  required
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] focus:outline-none"
                />
                <select
                  name="newWindow"
                  defaultValue={type === "pickup" ? b.pickup_time_window : b.delivery_time_window}
                  required
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] focus:outline-none"
                >
                  <option value="9am-1pm">9am - 1pm</option>
                  <option value="3pm-7pm">3pm - 7pm</option>
                </select>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-lg bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white font-bold text-[10px] py-1.5 transition-colors"
                >
                  {isPending ? "Saving..." : synced ? "Update + Shipday" : "Update date"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Remove from routing */}
        {synced && (
          <form onSubmit={handleCancel}>
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="date" value={date} />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg border border-red-200 text-red-400 hover:bg-red-50 disabled:opacity-40 font-bold text-[10px] px-2.5 py-1.5 transition-colors"
            >
              Remove routing
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
