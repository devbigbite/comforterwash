"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { TransportRun } from "@/app/actions/transport-runs"
import type { AerialOrder } from "@/types/dispatch"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

// Drag payload — just the order id, read back out on drop.
const DRAG_MIME = "application/x-washfold-order-id"

// ─── Single order chip ────────────────────────────────────────────────────────

function OrderChip({ order, draggable, onDragStart, onDragEnd }: {
  order: AerialOrder
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, orderId: string) => void
  onDragEnd?: () => void
}) {
  const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
  const bags = order.num_bags ?? order.num_comforters ?? 1
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, order.id) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={`block bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5 hover:border-[#E8726A]/40 hover:shadow-md transition-all group ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      title={draggable ? "Drag to move, click to open" : undefined}
    >
      <div className="flex items-center gap-2">
        {draggable && <span className="text-gray-300 text-[10px] select-none">⠿</span>}
        <span className="font-black font-mono text-[#0D2240] text-xs group-hover:text-[#E8726A] transition-colors">{code}</span>
        <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded ml-auto">
          {SERVICE_LABELS[order.service_type] ?? order.service_type}
        </span>
      </div>
      <p className="text-[10px] text-gray-500 truncate mt-0.5">{order.customer_name}</p>
      <p className="text-[9px] text-gray-400 mt-0.5">{bags} bag{bags !== 1 ? "s" : ""}</p>
    </Link>
  )
}

// ─── Location bucket ──────────────────────────────────────────────────────────

function Bucket({
  icon,
  label,
  sublabel,
  orders,
  accentClass,
  borderClass,
  bgClass,
  emptyMsg,
  extra,
  droppable,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onChipDragStart,
  onChipDragEnd,
}: {
  icon: string
  label: string
  sublabel?: string
  orders: AerialOrder[]
  accentClass: string
  borderClass: string
  bgClass: string
  emptyMsg?: string
  extra?: React.ReactNode
  droppable?: boolean
  isDragOver?: boolean
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onChipDragStart?: (e: React.DragEvent, orderId: string) => void
  onChipDragEnd?: () => void
}) {
  return (
    <div
      onDragOver={droppable ? onDragOver : undefined}
      onDragLeave={droppable ? onDragLeave : undefined}
      onDrop={droppable ? onDrop : undefined}
      className={`flex flex-col rounded-2xl border overflow-hidden min-w-[200px] flex-1 transition-colors ${
        isDragOver ? "border-[#0D2240] bg-[#0D2240]/5 ring-2 ring-[#0D2240]/20" : `${borderClass} ${bgClass}`
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-extrabold ${accentClass}`}>{label}</p>
            {sublabel && <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>}
          </div>
          <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${accentClass} bg-white/60 border ${borderClass}`}>
            {orders.length}
          </span>
        </div>
        {extra}
      </div>

      {/* Orders */}
      <div className="p-2 space-y-1.5 flex-1 overflow-y-auto max-h-[60vh]">
        {orders.length === 0 && (
          <p className="text-center text-[10px] text-gray-300 py-5">
            {isDragOver ? "Drop here" : emptyMsg ?? "None"}
          </p>
        )}
        {orders.map(o => (
          <OrderChip
            key={o.id}
            order={o}
            draggable={droppable !== undefined}
            onDragStart={onChipDragStart}
            onDragEnd={onChipDragEnd}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Run chip for in-transfer ─────────────────────────────────────────────────

function RunChip({ run, orders }: { run: TransportRun; orders: AerialOrder[] }) {
  const label = run.run_type === "to_facility" ? "Warehouse → Facility" : "Facility → Warehouse"
  const count = run.order_ids?.length ?? 0
  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-extrabold text-amber-700">{label}</span>
        <span className="text-[9px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full ml-auto">{count} orders</span>
      </div>
      {run.assigned_to && (
        <p className="text-[10px] font-bold text-[#E8726A] mb-1.5">🚗 {run.assigned_to}</p>
      )}
      <div className="space-y-1">
        {orders.slice(0, 3).map(o => (
          <Link key={o.id} href={`/admin/orders/${o.id}`}
            className="flex items-center gap-1.5 hover:text-[#E8726A] transition-colors">
            <span className="font-mono text-[9px] font-bold text-[#0D2240]">
              {o.short_code ?? o.id.slice(0, 6).toUpperCase()}
            </span>
            <span className="text-[9px] text-gray-400 truncate">{o.customer_name}</span>
          </Link>
        ))}
        {count > 3 && (
          <p className="text-[9px] text-gray-400">+{count - 3} more</p>
        )}
      </div>
    </div>
  )
}

// ─── Main aerial view ─────────────────────────────────────────────────────────

// One representative target status per bucket — dragging a card in sets the
// order straight to that status via the same admin-override action used on
// the Driver Routes tab. Buckets that group several statuses together (e.g.
// "At Facility" covers at_facility/in_washer/in_dryer/folded/ready) land on
// the first/entry status of that group when dropped into from elsewhere;
// dropping onto a card's own current bucket is a no-op.
const BUCKET_STATUS = {
  pendingPickup: "confirmed",
  withDriver: "picked_up",
  atFacility: "at_facility",
  atWarehouse: "at_warehouse",
  outForDelivery: "out_for_delivery",
} as const

type BucketKey = keyof typeof BUCKET_STATUS

export function AerialView({
  orders,
  runs,
  allOrdersById,
  date,
  setBookingStatusAction,
}: {
  orders: AerialOrder[]
  runs: TransportRun[]
  allOrdersById: Record<string, AerialOrder>
  date?: string
  setBookingStatusAction?: (fd: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [dragOverBucket, setDragOverBucket] = useState<BucketKey | null>(null)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleChipDragStart(e: React.DragEvent, orderId: string) {
    e.dataTransfer.setData(DRAG_MIME, orderId)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleChipDragEnd() {
    setDragOverBucket(null)
  }

  function handleDragOver(bucket: BucketKey) {
    return (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDragOverBucket(bucket)
    }
  }

  function handleDragLeave() {
    setDragOverBucket(null)
  }

  function handleDrop(bucket: BucketKey) {
    return (e: React.DragEvent) => {
      e.preventDefault()
      setDragOverBucket(null)
      const orderId = e.dataTransfer.getData(DRAG_MIME)
      if (!orderId || !setBookingStatusAction) return
      const order = allOrdersById[orderId]
      const targetStatus = BUCKET_STATUS[bucket]
      if (!order || order.status === targetStatus) return

      const fd = new FormData()
      fd.set("bookingId", orderId)
      fd.set("status", targetStatus)
      fd.set("note", `Moved to "${targetStatus}" via aerial view drag-and-drop by admin.`)
      fd.set("date", date ?? "")
      startTransition(async () => {
        await setBookingStatusAction(fd)
        router.refresh()
        flash("Moved ✓")
      })
    }
  }

  // Bucket by status
  const inboundWithDriver  = orders.filter(o => o.status === "picked_up")
  const outForDelivery     = orders.filter(o => o.status === "out_for_delivery")
  const atWarehouse        = orders.filter(o => ["at_warehouse", "ready_at_warehouse"].includes(o.status))
  const atFacility         = orders.filter(o => ["at_facility", "in_washer", "in_dryer", "folded", "ready"].includes(o.status))
  const pendingPickup      = orders.filter(o => o.status === "confirmed")
  const pendingRuns        = runs.filter(r => r.status === "pending")

  const canDrag = !!setBookingStatusAction

  // For each pending run, find its orders
  function runOrders(run: TransportRun): AerialOrder[] {
    return (run.order_ids ?? []).map(id => allOrdersById[id]).filter(Boolean) as AerialOrder[]
  }

  return (
    <div className="relative">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0D2240] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Flow legend */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold mb-2 overflow-x-auto whitespace-nowrap pb-1">
        <span className="bg-[#E8726A]/10 text-[#E8726A] font-bold px-2 py-1 rounded-lg">Customer</span>
        <span>→</span>
        <span className="bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded-lg">Driver (inbound)</span>
        <span>→</span>
        <span className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-lg">Facility</span>
        <span>⇄</span>
        <span className="bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-lg">In Transfer</span>
        <span>⇄</span>
        <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg">Warehouse</span>
        <span>→</span>
        <span className="bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg">Driver (outbound)</span>
        <span>→</span>
        <span className="bg-gray-100 text-gray-600 font-bold px-2 py-1 rounded-lg">Customer</span>
      </div>

      {canDrag && (
        <p className="text-[10px] text-gray-400 mb-3">
          Drag a card <span className="text-gray-300">⠿</span> into another column to force its stage — same admin override as the Driver Routes tab.
          {isPending && <span className="text-[#0D2240] font-bold ml-1">Saving…</span>}
        </p>
      )}

      {/* Buckets */}
      <div className="flex gap-3 overflow-x-auto pb-4">

        {/* Awaiting pickup */}
        <Bucket
          icon="🏠"
          label="Awaiting Pickup"
          sublabel="Confirmed — at customer"
          orders={pendingPickup}
          accentClass="text-[#E8726A]"
          borderClass="border-[#E8726A]/20"
          bgClass="bg-[#E8726A]/5"
          emptyMsg="No pending pickups"
          droppable={canDrag ? true : undefined}
          isDragOver={dragOverBucket === "pendingPickup"}
          onDragOver={handleDragOver("pendingPickup")}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop("pendingPickup")}
          onChipDragStart={handleChipDragStart}
          onChipDragEnd={handleChipDragEnd}
        />

        {/* Driver — inbound */}
        <Bucket
          icon="🚗"
          label="With Driver"
          sublabel="Picked up — heading to facility"
          orders={inboundWithDriver}
          accentClass="text-purple-700"
          borderClass="border-purple-200"
          bgClass="bg-purple-50"
          emptyMsg="No drivers inbound"
          droppable={canDrag ? true : undefined}
          isDragOver={dragOverBucket === "withDriver"}
          onDragOver={handleDragOver("withDriver")}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop("withDriver")}
          onChipDragStart={handleChipDragStart}
          onChipDragEnd={handleChipDragEnd}
        />

        {/* In transfer (runs) — not a droppable status target, it's driven by
            transfer runs rather than a single booking status. */}
        <div className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden min-w-[220px] flex-1">
          <div className="px-4 py-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-amber-700">In Transfer</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Between facility & warehouse</p>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full text-amber-700 bg-white/60 border border-amber-200">
                {pendingRuns.length}
              </span>
            </div>
          </div>
          <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
            {pendingRuns.length === 0 && (
              <p className="text-center text-[10px] text-gray-300 py-5">No active transfers</p>
            )}
            {pendingRuns.map(run => (
              <RunChip key={run.id} run={run} orders={runOrders(run)} />
            ))}
          </div>
        </div>

        {/* At facility */}
        <Bucket
          icon="🏭"
          label="At Facility"
          sublabel="Being processed"
          orders={atFacility}
          accentClass="text-blue-700"
          borderClass="border-blue-200"
          bgClass="bg-blue-50"
          emptyMsg="No orders at facility"
          droppable={canDrag ? true : undefined}
          isDragOver={dragOverBucket === "atFacility"}
          onDragOver={handleDragOver("atFacility")}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop("atFacility")}
          onChipDragStart={handleChipDragStart}
          onChipDragEnd={handleChipDragEnd}
        />

        {/* At warehouse */}
        <Bucket
          icon="📦"
          label="In Warehouse"
          sublabel="Stored — ready to ship or transfer"
          orders={atWarehouse}
          accentClass="text-indigo-700"
          borderClass="border-indigo-200"
          bgClass="bg-indigo-50"
          emptyMsg="Warehouse is empty"
          droppable={canDrag ? true : undefined}
          isDragOver={dragOverBucket === "atWarehouse"}
          onDragOver={handleDragOver("atWarehouse")}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop("atWarehouse")}
          onChipDragStart={handleChipDragStart}
          onChipDragEnd={handleChipDragEnd}
        />

        {/* Out for delivery */}
        <Bucket
          icon="🚚"
          label="Out for Delivery"
          sublabel="With driver — heading to customer"
          orders={outForDelivery}
          accentClass="text-green-700"
          borderClass="border-green-200"
          bgClass="bg-green-50"
          emptyMsg="No deliveries in progress"
          droppable={canDrag ? true : undefined}
          isDragOver={dragOverBucket === "outForDelivery"}
          onDragOver={handleDragOver("outForDelivery")}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop("outForDelivery")}
          onChipDragStart={handleChipDragStart}
          onChipDragEnd={handleChipDragEnd}
        />

      </div>

      {orders.length === 0 && runs.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm mt-4">
          <p className="text-gray-400 text-sm">No active orders in the system.</p>
        </div>
      )}
    </div>
  )
}
