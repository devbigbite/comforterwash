"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO, isToday, isTomorrow } from "date-fns"
import Link from "next/link"
import type { DispatchBooking } from "@/app/admin/dispatch/page"

// Drag payload for card → column reassignment. Two fields so a drop target
// can skip the mutation entirely if the card is already in that column.
const DRAG_BOOKING_MIME = "application/x-washfold-booking-id"
const DRAG_SOURCE_MIME  = "application/x-washfold-source-driver"
// Carries which leg (pickup/delivery) the dragged card belongs to, so a drop
// on another column writes to the right assignment column server-side —
// the drop target only otherwise knows the bookingId, not its status/leg.
const DRAG_LEG_MIME      = "application/x-washfold-leg"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

// Which leg (and therefore which driver-assignment column) a booking's
// current status belongs to. Mirrors legFor() in app/admin/dispatch/page.tsx
// server-side — kept in sync there since the pickup driver (customer ->
// facility/warehouse) and delivery driver (facility/warehouse -> customer)
// are tracked as two separate columns and are not always the same person.
function legFor(status: string): "pickup" | "delivery" {
  return ["at_warehouse", "ready", "ready_at_warehouse", "out_for_delivery"].includes(status) ? "delivery" : "pickup"
}

const STATUS_COLOR: Record<string, string> = {
  confirmed:          "bg-[#E8726A]/15 text-[#E8726A]",
  picked_up:          "bg-purple-100 text-purple-700",
  at_warehouse:       "bg-amber-100 text-amber-700",
  ready:              "bg-teal-100 text-teal-700",
  ready_at_warehouse: "bg-indigo-100 text-indigo-700",
  out_for_delivery:   "bg-green-100 text-green-700",
}

// What action a driver needs to take
const DRIVER_ACTION: Record<string, { label: string; arrow: string }> = {
  confirmed:          { label: "Pick up from customer",    arrow: "→ Facility or Warehouse" },
  picked_up:          { label: "En route",                 arrow: "🚗"                      },
  at_warehouse:       { label: "Warehouse → Facility",     arrow: "→ Facility"              },
  ready:              { label: "Ready at facility",        arrow: "→ Customer or Warehouse" },
  ready_at_warehouse: { label: "Ready at warehouse",       arrow: "→ Customer"              },
  out_for_delivery:   { label: "Out for delivery",         arrow: "→ Customer"              },
}

// Operational dispatcher moves — the common few, shown as one-tap buttons.
// Purely routing/status, never touches weight, pricing, or payment capture
// (that only happens in the driver app's own dropoff/delivery flow).
const ROUTE_ACTIONS: { status: string; label: string; note: string }[] = [
  { status: "picked_up",        label: "↩ Back to Picked Up",   note: "Sent back to Picked Up by dispatcher — driver needs to return for something missed." },
  { status: "at_facility",      label: "→ Send to Facility",     note: "Routed to facility by dispatcher." },
  { status: "at_warehouse",     label: "→ Send to Warehouse",    note: "Routed to warehouse by dispatcher." },
  { status: "out_for_delivery", label: "→ Start Delivery",       note: "Delivery run started by dispatcher." },
  { status: "delivered",        label: "✓ Mark Delivered",       note: "Marked delivered by dispatcher (confirmed by phone)." },
]

// Full lifecycle — every status an order can ever be in, for the "Force to
// any stage" override dropdown below the quick-action buttons. This is the
// actual "god mode" escape hatch: testing, fixing a stuck order, or
// correcting a mistake shouldn't require walking through the driver/operator
// apps step by step. Same underlying setBookingStatusAction as the quick
// buttons above — just unrestricted.
const ALL_STATUSES: { value: string; label: string }[] = [
  { value: "confirmed",          label: "Confirmed (awaiting pickup)" },
  { value: "picked_up",          label: "Picked Up" },
  { value: "at_facility",        label: "At Facility" },
  { value: "at_warehouse",       label: "At Warehouse" },
  { value: "in_washer",          label: "In Washer" },
  { value: "in_dryer",           label: "In Dryer" },
  { value: "folded",             label: "Folded" },
  { value: "ready",              label: "Ready (at facility)" },
  { value: "ready_at_warehouse", label: "Ready at Warehouse" },
  { value: "out_for_delivery",   label: "Out for Delivery" },
  { value: "delivered",          label: "Delivered" },
  { value: "cancelled",          label: "Cancelled" },
]

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
  setBookingStatusAction,
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
  setBookingStatusAction: (fd: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [statusPending, startStatusTransition] = useTransition()
  const [reschedulePending, startRescheduleTransition] = useTransition()
  const [cancelPending, startCancelTransition] = useTransition()
  const [showReschedule, setShowReschedule] = useState(false)
  const [newPickupDate, setNewPickupDate] = useState(b.pickup_date ?? "")
  const [newPickupWindow, setNewPickupWindow] = useState(b.pickup_time_window ?? "9am-1pm")
  const [newDeliveryDate, setNewDeliveryDate] = useState(b.delivery_date ?? "")
  const [newDeliveryWindow, setNewDeliveryWindow] = useState(b.delivery_time_window ?? "9am-1pm")
  const [toast, setToast] = useState<string | null>(null)
  const orderCode = b.short_code ?? b.id.slice(0, 6).toUpperCase()
  const bagCount = b.num_bags ?? b.num_comforters ?? 1
  const synced = type === "pickup" ? !!b.shipday_pickup_order_id : !!b.shipday_delivery_order_id
  const window = type === "pickup" ? b.pickup_time_window : b.delivery_time_window
  const isUnassigned = !currentDriverId

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
    fd.set("leg", type)
    startTransition(async () => {
      await assignDriverAction(fd)
      router.refresh()
      setOpen(false)
      flash("Assigned ✓")
    })
  }

  function handleUnassign() {
    const fd = new FormData()
    fd.set("bookingId", b.id)
    fd.set("date", date)
    fd.set("leg", type)
    startTransition(async () => {
      await unassignDriverAction(fd)
      router.refresh()
      setOpen(false)
      flash("Unassigned")
    })
  }

  function setStatus(status: string, note: string) {
    const fd = new FormData()
    fd.set("bookingId", b.id)
    fd.set("status", status)
    fd.set("note", note)
    fd.set("date", date)
    startStatusTransition(async () => {
      await setBookingStatusAction(fd)
      router.refresh()
      flash("Updated ✓")
    })
  }

  function removeFromDriver() {
    const fd = new FormData()
    fd.set("bookingId", b.id)
    fd.set("status", "confirmed")
    fd.set("note", "Removed from driver — pickup could not be completed (e.g. customer did not leave items out). Needs reassignment.")
    fd.set("unassign", "true")
    fd.set("date", date)
    startStatusTransition(async () => {
      await setBookingStatusAction(fd)
      router.refresh()
      setOpen(false)
      flash("Removed from driver")
    })
  }

  function saveReschedule() {
    const fd = new FormData()
    fd.set("bookingId", b.id)
    fd.set("currentDate", date)
    if (type === "pickup") {
      fd.set("type", "pickup")
      fd.set("newDate", newPickupDate)
      fd.set("newWindow", newPickupWindow)
    } else {
      fd.set("type", "delivery")
      fd.set("newDate", newDeliveryDate)
      fd.set("newWindow", newDeliveryWindow)
    }
    startRescheduleTransition(async () => {
      await rescheduleAction(fd)
      router.refresh()
      setShowReschedule(false)
      flash("Rescheduled ✓")
    })
  }

  function handleCancelOrder() {
    if (!globalThis.confirm(`Cancel order ${orderCode}? This cancels any Shipday dispatch and marks the order cancelled — it can't be undone from here.`)) return
    const fd = new FormData()
    fd.set("bookingId", b.id)
    fd.set("date", date)
    startCancelTransition(async () => {
      await cancelAction(fd)
      router.refresh()
      setOpen(false)
      flash("Order cancelled")
    })
  }

  const windowBadge = window === "9am-1pm" ? "AM" : window === "3pm-7pm" ? "PM" : window ?? "?"

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(DRAG_BOOKING_MIME, b.id)
    e.dataTransfer.setData(DRAG_SOURCE_MIME, currentDriverId ?? "")
    e.dataTransfer.setData(DRAG_LEG_MIME, type)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title="Drag to move to a different driver's column"
      className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible cursor-grab active:cursor-grabbing"
    >
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
          <span className="text-gray-300 text-[10px] select-none">⠿</span>
          <span className="font-black font-mono text-[#0D2240] text-xs">{orderCode}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[b.status] ?? "bg-gray-100 text-gray-500"}`}>
            {b.status?.replace(/_/g, " ")}
          </span>
        </div>
        <p className="font-semibold text-[#0D2240] text-xs truncate">{b.customer_name}</p>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{b.customer_address}</p>
        {(() => {
          const action = DRIVER_ACTION[b.status]
          // Was hardcoded to only ["out_for_delivery","ready_at_warehouse"]
          // — that predates the pickup/delivery leg split and missed
          // "ready", which is also a delivery-leg status (folded at
          // facility, waiting on a driver to bring it to the customer).
          // That mismatch is exactly what made a "ready" order's card show
          // "Needs a driver · [pickup date]" instead of the actual date
          // that matters once an order's past pickup: its delivery date.
          // `type` is this card's actual leg (see legFor() above), so use
          // that instead of re-deriving it from a partial status list.
          const d = type === "delivery" ? b.delivery_date : b.pickup_date
          let dateLabel = ""
          if (d) {
            if (isToday(parseISO(d))) dateLabel = " · Today"
            else if (isTomorrow(parseISO(d))) dateLabel = " · Tomorrow"
            else dateLabel = " · " + format(parseISO(d), "MMM d")
          }
          // Unassigned cards get a plain "needs a driver" flag instead of the
          // driver-workflow arrow (e.g. "→ Facility or Warehouse") — that
          // badge describes what happens once someone's actually driving the
          // order, which reads as confusing/already-in-motion when nobody's
          // assigned yet. This makes the actual blocker obvious at a glance.
          if (isUnassigned) {
            return (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[9px] font-bold text-[#0D2240]/50">Needs a driver{dateLabel}</span>
                <span className="text-[9px] font-black text-amber-600 ml-auto border border-amber-300 bg-amber-50 px-1.5 py-0.5 rounded">
                  ⚠ Unassigned
                </span>
              </div>
            )
          }
          return action ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[9px] font-bold text-[#0D2240]/50">{action.label}{dateLabel}</span>
              <span className="text-[9px] font-black text-[#E8726A] ml-auto border border-[#E8726A]/30 bg-[#E8726A]/5 px-1.5 py-0.5 rounded">
                {action.arrow}
              </span>
            </div>
          ) : null
        })()}
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

      {/* Always-visible quick-assign — the actual next step for an unassigned
          order shouldn't be hidden behind an expand click. Skipped entirely
          if there are no drivers yet (that empty-state banner already tells
          the admin what to do instead). */}
      {isUnassigned && drivers.length > 0 && (
        <div className="px-3 pb-2.5">
          <select
            defaultValue=""
            disabled={isPending}
            onChange={e => { if (e.target.value) handleAssign(e.target.value) }}
            className="w-full text-[11px] font-bold text-[#0D2240] border-2 border-amber-300 bg-amber-50 rounded-lg px-2 py-1.5 disabled:opacity-50"
          >
            <option value="" disabled>Assign to driver…</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}{!d.shipday_email ? " (no Shipday email)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl px-3 py-2.5 space-y-2">
          {isUnassigned ? (
            // Routing actions (send to facility, mark delivered, etc.) don't
            // apply yet — nobody's actually driving this order. Keep the
            // expand panel focused on the one thing that unblocks it.
            <p className="text-[10px] text-gray-400">
              Pick a driver above to move this into their route. Routing actions (send to facility, mark delivered, etc.)
              unlock once a driver is assigned.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Quick actions</p>
              <div className="grid grid-cols-2 gap-1">
                {ROUTE_ACTIONS.map(a => {
                  const isCurrent = a.status === b.status
                  return (
                    <button
                      key={a.status}
                      type="button"
                      disabled={statusPending}
                      onClick={() => setStatus(a.status, a.note)}
                      className={`text-[10px] font-bold py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                        isCurrent
                          ? "bg-[#0D2240] text-white border-[#0D2240]"
                          : "bg-white text-gray-500 border-gray-200 hover:border-[#0D2240] hover:text-[#0D2240]"
                      }`}
                    >
                      {a.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[9px] text-gray-400 -mt-1">Routing/status only — no billing or payment effect.</p>

              <button
                type="button"
                disabled={statusPending}
                onClick={removeFromDriver}
                className="w-full text-[10px] font-bold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 bg-red-50 rounded-lg py-1.5 transition-colors disabled:opacity-50"
              >
                ✕ Remove from driver — pickup failed
              </button>
              <p className="text-[9px] text-gray-400 -mt-1">Customer didn't leave items out, wasn't home, etc. Unassigns the driver and returns this to Confirmed for reassignment.</p>

              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide pt-1">Reassign to a different driver</p>
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
              <button
                type="button"
                disabled={isPending}
                onClick={handleUnassign}
                className="w-full text-[10px] text-red-400 hover:text-red-600 font-semibold py-1 transition-colors disabled:opacity-50"
              >
                Remove driver assignment
              </button>
            </>
          )}

          {/* ── Admin override — full control, independent of driver/operator
              flow or current assignment state. Force any order to any stage,
              change its date/window, or cancel it outright, without walking
              through the driver/operator apps. Always available, even
              unassigned, since testing/fixing a stuck order shouldn't
              require a driver to exist first. */}
          <div className="border-t border-gray-200 pt-2 mt-1 space-y-2">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Admin override</p>

            <div>
              <label className="block text-[9px] text-gray-400 mb-1">Force to any stage</label>
              <select
                value={b.status}
                disabled={statusPending}
                onChange={e => setStatus(e.target.value, `Force-set to "${e.target.value}" by admin override.`)}
                className="w-full text-[11px] font-bold text-[#0D2240] border-2 border-gray-300 bg-white rounded-lg px-2 py-1.5 disabled:opacity-50"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {showReschedule ? (
              <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-2">
                {type === "pickup" ? (
                  <div className="flex items-center gap-1.5">
                    <input type="date" value={newPickupDate} onChange={e => setNewPickupDate(e.target.value)}
                      className="flex-1 text-[11px] rounded-md border border-gray-300 px-1.5 py-1" />
                    <select value={newPickupWindow} onChange={e => setNewPickupWindow(e.target.value)}
                      className="text-[11px] rounded-md border border-gray-300 px-1.5 py-1">
                      <option value="9am-1pm">9am–1pm</option>
                      <option value="3pm-7pm">3pm–7pm</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input type="date" value={newDeliveryDate} onChange={e => setNewDeliveryDate(e.target.value)}
                      className="flex-1 text-[11px] rounded-md border border-gray-300 px-1.5 py-1" />
                    <select value={newDeliveryWindow} onChange={e => setNewDeliveryWindow(e.target.value)}
                      className="text-[11px] rounded-md border border-gray-300 px-1.5 py-1">
                      <option value="9am-1pm">9am–1pm</option>
                      <option value="3pm-7pm">3pm–7pm</option>
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button type="button" disabled={reschedulePending} onClick={saveReschedule}
                    className="flex-1 text-[10px] font-bold bg-[#0D2240] text-white rounded-md py-1.5 disabled:opacity-50">
                    {reschedulePending ? "Saving…" : "Save new date"}
                  </button>
                  <button type="button" onClick={() => setShowReschedule(false)}
                    className="text-[10px] text-gray-400 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowReschedule(true)}
                className="w-full text-[10px] font-bold text-[#0D2240] border-2 border-gray-300 bg-white hover:border-[#0D2240] rounded-lg py-1.5 transition-colors"
              >
                📅 Reschedule {type === "pickup" ? "pickup" : "delivery"} date/window
              </button>
            )}

            <button
              type="button"
              disabled={cancelPending}
              onClick={handleCancelOrder}
              className="w-full text-[10px] font-bold text-red-600 border-2 border-red-200 hover:border-red-400 bg-red-50 rounded-lg py-1.5 transition-colors disabled:opacity-50"
            >
              {cancelPending ? "Cancelling…" : "🗑 Cancel Order"}
            </button>
          </div>

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
  setBookingStatusAction,
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
  setBookingStatusAction: (fd: FormData) => Promise<void>
}) {
  const router = useRouter()
  const isUnassigned = driver === null
  const total = pickups.length + deliveries.length
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropPending, startDropTransition] = useTransition()

  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(DRAG_BOOKING_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const bookingId = e.dataTransfer.getData(DRAG_BOOKING_MIME)
    const sourceDriverId = e.dataTransfer.getData(DRAG_SOURCE_MIME)
    const leg = e.dataTransfer.getData(DRAG_LEG_MIME) || "pickup"
    if (!bookingId) return
    const targetDriverId = driver?.id ?? ""
    if (sourceDriverId === targetDriverId) return // already in this column

    const fd = new FormData()
    fd.set("bookingId", bookingId)
    fd.set("date", date)
    fd.set("leg", leg)
    startDropTransition(async () => {
      if (isUnassigned) {
        await unassignDriverAction(fd)
      } else {
        fd.set("driverId", driver!.id)
        fd.set("driverEmail", driver!.shipday_email ?? "")
        await assignDriverAction(fd)
      }
      router.refresh()
    })
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col min-w-[220px] max-w-[260px] rounded-2xl border transition-colors ${
        isDragOver
          ? "border-[#0D2240] bg-[#0D2240]/5 ring-2 ring-[#0D2240]/20"
          : isUnassigned ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
      } shadow-sm overflow-hidden flex-shrink-0 ${
        isUnassigned ? "sticky left-0 z-10 shadow-md" : ""
      }`}>

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
        {isUnassigned && total > 0 && (
          <p className="text-[10px] text-amber-700 mt-0.5">
            Pick a driver on each card below, or drag a card into another column.
          </p>
        )}
        {!isUnassigned && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
            {driver!.shipday_email ?? <span className="text-amber-500">No Shipday email</span>}
          </p>
        )}
        {!isUnassigned && total > 0 && (() => {
          // `pickups` here is really "everything assigned to this driver
          // right now" (see DispatchBoard below) — split it by actual leg so
          // this line reflects real pickup vs. delivery counts, not the raw
          // prop name.
          const pickupCount   = pickups.filter(b => legFor(b.status) === "pickup").length
          const deliveryCount = pickups.filter(b => legFor(b.status) === "delivery").length
          return (
            <div className="flex gap-2 mt-1.5 text-[10px] text-gray-400 font-semibold">
              {pickupCount > 0 && <span>↑ {pickupCount} pickup{pickupCount !== 1 ? "s" : ""}</span>}
              {deliveryCount > 0 && <span>↓ {deliveryCount} delivery{deliveryCount !== 1 ? "ies" : "y"}</span>}
            </div>
          )
        })()}
      </div>

      {/* Cards — grouped by date */}
      <div className="p-2 flex-1 overflow-y-auto max-h-[70vh]">
        {total === 0 && (
          <p className="text-center text-[10px] text-gray-300 py-6">
            {isDragOver ? "Drop here" : isUnassigned ? "All assigned 🎉" : "Nothing assigned yet — drag a card here, or pick this driver from a card's menu."}
          </p>
        )}
        {(() => {
          // Merge pickups + deliveries, tag each with its actual leg (not
          // just "pickup" for everything) — a driver-relevant order can be
          // in either the pickup phase (confirmed/picked_up) or the delivery
          // phase (at_warehouse/ready/ready_at_warehouse/out_for_delivery),
          // and each phase is assigned/tracked via its own DB column. See
          // legFor() above.
          const all = [
            ...pickups.map(b => ({ ...b, _type: legFor(b.status) })),
            ...deliveries.map(b => ({ ...b, _type: legFor(b.status) })),
          ].sort((a, b) => {
            const da = a._type === "pickup" ? a.pickup_date : a.delivery_date
            const db = b._type === "pickup" ? b.pickup_date : b.delivery_date
            return (da ?? "").localeCompare(db ?? "")
          })

          // Group by date
          const groups: Record<string, typeof all> = {}
          for (const item of all) {
            const d = item._type === "pickup" ? item.pickup_date : item.delivery_date
            const key = d ?? "unknown"
            if (!groups[key]) groups[key] = []
            groups[key].push(item)
          }

          return Object.entries(groups).map(([dateKey, items]) => {
            let label = dateKey
            try {
              const parsed = parseISO(dateKey)
              if (isToday(parsed)) label = "Today"
              else if (isTomorrow(parsed)) label = "Tomorrow"
              else label = format(parsed, "EEE, MMM d")
            } catch {}

            return (
              <div key={dateKey} className="mb-3">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest px-1 mb-1.5">{label}</p>
                <div className="space-y-1.5">
                  {items.map(b => (
                    <KanbanCard key={b.id + b._type} booking={b} type={b._type} date={date}
                      drivers={drivers}
                      currentDriverId={b._type === "delivery" ? b.assigned_delivery_driver_id : b.assigned_driver_id}
                      assignDriverAction={assignDriverAction}
                      unassignDriverAction={unassignDriverAction}
                      rescheduleAction={rescheduleAction}
                      cancelAction={cancelAction}
                      setBookingStatusAction={setBookingStatusAction} />
                  ))}
                </div>
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────

export function DispatchBoard({
  date,
  pickups: orders,
  deliveries: _unused,
  drivers,
  assignDriverAction,
  unassignDriverAction,
  rescheduleAction,
  cancelAction,
  setBookingStatusAction,
}: {
  date: string
  pickups: DispatchBooking[]
  deliveries: DispatchBooking[]
  drivers: { id: string; name: string; shipday_email: string | null }[]
  assignDriverAction: (fd: FormData) => Promise<void>
  unassignDriverAction: (fd: FormData) => Promise<void>
  rescheduleAction: (fd: FormData) => Promise<void>
  cancelAction: (fd: FormData) => Promise<void>
  setBookingStatusAction: (fd: FormData) => Promise<void>
}) {
  // Which of a booking's two driver-assignment columns is relevant right now
  // depends on its current leg — a pickup-phase order is unassigned/assigned
  // via assigned_driver_id, a delivery-phase order via
  // assigned_delivery_driver_id. Using assigned_driver_id alone here used to
  // mean a delivered-phase order with no delivery driver yet (but a pickup
  // driver from days earlier still on record) never showed up as needing
  // attention, and a driver's column could show an order that isn't
  // actually theirs for its current leg.
  function driverIdFor(b: DispatchBooking): string | null {
    return legFor(b.status) === "delivery" ? b.assigned_delivery_driver_id : b.assigned_driver_id
  }

  const unassigned = orders.filter(b => !driverIdFor(b))

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Unassigned pool */}
        <DriverColumn
          driver={null}
          pickups={unassigned}
          deliveries={[]}
          date={date}
          drivers={drivers}
          assignDriverAction={assignDriverAction}
          unassignDriverAction={unassignDriverAction}
          rescheduleAction={rescheduleAction}
          cancelAction={cancelAction}
          setBookingStatusAction={setBookingStatusAction}
        />

        {/* One column per driver */}
        {drivers.map(driver => {
          const mine = orders.filter(b => driverIdFor(b) === driver.id)
          return (
            <DriverColumn
              key={driver.id}
              driver={driver}
              pickups={mine}
              deliveries={[]}
              date={date}
              drivers={drivers}
              assignDriverAction={assignDriverAction}
              unassignDriverAction={unassignDriverAction}
              rescheduleAction={rescheduleAction}
              cancelAction={cancelAction}
              setBookingStatusAction={setBookingStatusAction}
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
