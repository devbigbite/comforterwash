"use client"

import Link from "next/link"
import type { TransportRun } from "@/app/actions/transport-runs"
import type { AerialOrder } from "@/types/dispatch"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

// ─── Single order chip ────────────────────────────────────────────────────────

function OrderChip({ order }: { order: AerialOrder }) {
  const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
  const bags = order.num_bags ?? order.num_comforters ?? 1
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="block bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5 hover:border-[#E8726A]/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-2">
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
}) {
  return (
    <div className={`flex flex-col rounded-2xl border ${borderClass} ${bgClass} overflow-hidden min-w-[200px] flex-1`}>
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
          <p className="text-center text-[10px] text-gray-300 py-5">{emptyMsg ?? "None"}</p>
        )}
        {orders.map(o => <OrderChip key={o.id} order={o} />)}
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

export function AerialView({
  orders,
  runs,
  allOrdersById,
}: {
  orders: AerialOrder[]
  runs: TransportRun[]
  allOrdersById: Record<string, AerialOrder>
}) {
  // Bucket by status
  const inboundWithDriver  = orders.filter(o => o.status === "picked_up")
  const outForDelivery     = orders.filter(o => o.status === "out_for_delivery")
  const atWarehouse        = orders.filter(o => ["at_warehouse", "ready_at_warehouse"].includes(o.status))
  const atFacility         = orders.filter(o => ["at_facility", "in_washer", "in_dryer", "folded", "ready"].includes(o.status))
  const pendingPickup      = orders.filter(o => o.status === "confirmed")
  const pendingRuns        = runs.filter(r => r.status === "pending")

  // For each pending run, find its orders
  function runOrders(run: TransportRun): AerialOrder[] {
    return (run.order_ids ?? []).map(id => allOrdersById[id]).filter(Boolean) as AerialOrder[]
  }

  return (
    <div>
      {/* Flow legend */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold mb-5 overflow-x-auto whitespace-nowrap pb-1">
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
        />

        {/* In transfer (runs) */}
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
