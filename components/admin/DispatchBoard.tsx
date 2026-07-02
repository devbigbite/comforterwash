"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { DispatchBooking } from "@/app/admin/dispatch/page"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

const STATUS_COLOR: Record<string, string> = {
  confirmed:        "bg-blue-100 text-blue-700",
  picked_up:        "bg-purple-100 text-purple-700",
  in_progress:      "bg-orange-100 text-orange-700",
  out_for_delivery: "bg-green-100 text-green-700",
}

// ─── Mini order card for kanban ───────────────────────────────────────────────

function KanbanCard({
  booking: b,
  type,
  date,
  drivers,
  currentDriverId,
  assignDriverAction,
  unassignDriverAction,
  rescheduleAction,
  cancelAction,
}: {
  booking: DispatchBooking
  type: "pickup" | "delivery"
  date: string
  drivers: { id: string; name: string; shipday_email: string | null }[]
  currentDriverId: string | null
  assignDriverAction: (fd: FormData) => Promise<void>
  unassignDriverAction: (fd: FormData) => Promise<void>
  rescheduleAction: (fd: FormData) => Promise<void>
  cancelAction: (fd: FormData) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const orderCode = b.short_code ?? b.id.slice(0, 6).toUpperCase()
  const bagCount = b.num_bags ?? b.num_comforters ?? 1
  const synced = type === "pickup" ? !!b.shipday_pickup_order_id : !!b.shipday_delivery_order_id
  const window = type === "pickup" ? b.pickup_time_window : b.delivery_time_window

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleAssign(driverId: string) {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver) return
    const fd = new FormData()
    fd.set("bookingId", b.id)
    fd.set("driverId", driver.id)
    fd.set("driverEmail", driver.shipday_email ?? "")
    fd.set("date", date)
    startTransition(async () => {
      await assignDriverAction(fd)
      setOpen(false)
      flash("Assigned ✓")
    })
  }

  function handleUnassign() {
    const fd = new FormData()
    fd.set("bookingId", b.id)
    fd.set("date", date)
    startTransition(async () => {
      await unassignDriverAction(fd)
      setOpen(false)
      flash("Unassigned")
    })
  }

  const windowBadge = window === "9am-1pm" ? "AM" : window === "3pm-7pm" ? "PM" : window ?? "?"

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">
      {toast && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 bg-[#0D2240] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Card body */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-3 py-2.5"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-black font-mono text-[#0D2240] text-xs">{orderCode}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[b.status] ?? "bg-gray-100 text-gray-500"}`}>
            {b.status?.replace(/_/g, " ")}
          </span>
          <span className="ml-auto text-[9px] font-bold text-gray-400 border border-gray-200 rounded px-1">{windowBadge}</span>
        </div>
        <p className="font-semibold text-[#0D2240] text-xs truncate">{b.customer_name}</p>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{b.customer_address}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded">
            {SERVICE_LABELS[b.service_type] ?? b.service_type}
          </span>
          <span className="text-[9px] text-gray-400">{bagCount} bag{bagCount !== 1 ? "s" : ""}</span>
          {synced
            ? <span className="text-[9px] text-green-600 font-bold ml-auto">●&nbsp;SD</span>
            : <span className="text-[9px] text-amber-500 font-bold ml-auto">○&nbsp;Not synced</span>}
        </div>
      </button>

      {/* Expanded assign panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl px-3 py-2.5 space-y-2">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Assign driver</p>
          <div className="grid gap-1">
            {drivers.map(d => (
              <button
                key={d.id}
                type="button"
                disabled={isPending}
                onClick={() => handleAssign(d.id)}
                className={`w-full text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                  d.id === currentDriverId
                    ? "bg-[#E8726A] text-white border-[#E8726A]"
                    : "bg-white text-[#0D2240] border-gray-200 hover:border-[#E8726A] hover:bg-red-50"
                } disabled:opacity-50`}
              >
                {d.id === currentDriverId ? "✓ " : ""}{d.name}
                {!d.shipday_email && <span className="ml-1 text-[9px] text-amber-500">(no Shipday email)</span>}
              </button>
            ))}
          </div>
          {currentDriverId && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleUnassign}
              className="w-full text-[10px] text-red-400 hover:text-red-600 font-semibold py-1 transition-colors disabled:opacity-50"
            >
              Remove driver assignment
            </button>
          )}
          <Link href={`/admin/orders/${b.id}`} className="block text-center text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold pt-0.5">
            View full order →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Driver column ────────────────────────────────────────────────────────────

function DriverColumn({
  driver,
  pickups,
  deliveries,
  date,
  drivers,
  assignDriverAction,
  unassignDriverAction,
  rescheduleAction,
  cancelAction,
}: {
  driver: { id: string; name: string; shipday_email: string | null } | null // null = "Unassigned"
  pickups: DispatchBooking[]
  deliveries: DispatchBooking[]
  date: string
  drivers: { id: string; name: string; shipday_email: string | null }[]
  assignDriverAction: (fd: FormData) => Promise<void>
  unassignDriverAction: (fd: FormData) => Promise<void>
  rescheduleAction: (fd: FormData) => Promise<void>
  cancelAction: (fd: FormData) => Promise<void>
}) {
  const isUnassigned = driver === null
  const total = pickups.length + deliveries.length

  return (
    <div className={`flex flex-col min-w-[220px] max-w-[260px] rounded-2xl border ${
      isUnassigned ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
    } shadow-sm overflow-hidden flex-shrink-0`}>

      {/* Column header */}
      <div className={`px-3 py-3 border-b ${isUnassigned ? "border-amber-200" : "border-gray-100"}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black ${isUnassigned ? "text-amber-700" : "text-[#0D2240]"}`}>
            {isUnassigned ? "Unassigned" : driver!.name}
          </span>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
            isUnassigned ? "bg-amber-200 text-amber-700" : "bg-gray-100 text-gray-500"
          }`}>{total}</span>
        </div>
        {!isUnassigned && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
            {driver!.shipday_email ?? <span className="text-amber-500">No Shipday email</span>}
          </p>
        )}
        {!isUnassigned && total > 0 && (
          <div className="flex gap-2 mt-1.5 text-[10px] text-gray-400 font-semibold">
            {pickups.length > 0 && <span>↑ {pickups.length} pickup{pickups.length !== 1 ? "s" : ""}</span>}
            {deliveries.length > 0 && <span>↓ {deliveries.length} delivery{deliveries.length !== 1 ? "ies" : "y"}</span>}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
        {total === 0 && (
          <p className="text-center text-[10px] text-gray-300 py-6">
            {isUnassigned ? "All assigned 🎉" : "Nothing assigned yet"}
          </p>
        )}
        {pickups.length > 0 && (
          <div className="space-y-1.5">
            {pickups.length > 0 && deliveries.length > 0 && (
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest px-1">Pickups</p>
            )}
            {pickups.map(b => (
              <KanbanCard key={b.id} booking={b} type="pickup" date={date}
                drivers={drivers} currentDriverId={b.assigned_driver_id}
                assignDriverAction={assignDriverAction}
                unassignDriverAction={unassignDriverAction}
                rescheduleAction={rescheduleAction}
                cancelAction={cancelAction} />
            ))}
          </div>
        )}
        {deliveries.length > 0 && (
          <div className="space-y-1.5 mt-2">
            {pickups.length > 0 && deliveries.length > 0 && (
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest px-1">Deliveries</p>
            )}
            {deliveries.map(b => (
              <KanbanCard key={b.id} booking={b} type="delivery" date={date}
                drivers={drivers} currentDriverId={b.assigned_driver_id}
                assignDriverAction={assignDriverAction}
                unassignDriverAction={unassignDriverAction}
                rescheduleAction={rescheduleAction}
                cancelAction={cancelAction} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────

export function DispatchBoard({
  date,
  pickups,
  deliveries,
  drivers,
  assignDriverAction,
  unassignDriverAction,
  rescheduleAction,
  cancelAction,
}: {
  date: string
  pickups: DispatchBooking[]
  deliveries: DispatchBooking[]
  drivers: { id: string; name: string; shipday_email: string | null }[]
  assignDriverAction: (fd: FormData) => Promise<void>
  unassignDriverAction: (fd: FormData) => Promise<void>
  rescheduleAction: (fd: FormData) => Promise<void>
  cancelAction: (fd: FormData) => Promise<void>
}) {
  // Orders assigned to each driver
  const unassignedPickups   = pickups.filter(b => !b.assigned_driver_id)
  const unassignedDeliveries = deliveries.filter(b => !b.assigned_driver_id)

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Unassigned pool */}
        <DriverColumn
          driver={null}
          pickups={unassignedPickups}
          deliveries={unassignedDeliveries}
          date={date}
          drivers={drivers}
          assignDriverAction={assignDriverAction}
          unassignDriverAction={unassignDriverAction}
          rescheduleAction={rescheduleAction}
          cancelAction={cancelAction}
        />

        {/* One column per driver */}
        {drivers.map(driver => {
          const dPickups    = pickups.filter(b => b.assigned_driver_id === driver.id)
          const dDeliveries = deliveries.filter(b => b.assigned_driver_id === driver.id)
          return (
            <DriverColumn
              key={driver.id}
              driver={driver}
              pickups={dPickups}
              deliveries={dDeliveries}
              date={date}
              drivers={drivers}
              assignDriverAction={assignDriverAction}
              unassignDriverAction={unassignDriverAction}
              rescheduleAction={rescheduleAction}
              cancelAction={cancelAction}
            />
          )
        })}
      </div>

      {drivers.length === 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          No active drivers found. Add workers with the "driver" role in{" "}
          <a href="/admin/workers" className="font-bold underline">Workers</a>.
        </div>
      )}
    </div>
  )
}
