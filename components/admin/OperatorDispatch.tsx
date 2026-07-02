"use client"

import { useState, useTransition } from "react"
import type { FacilityOrder } from "@/app/admin/dispatch/page"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

export function OperatorDispatch({
  date,
  orders,
  operators,
  facilities,
  assignOperatorAction,
}: {
  date: string
  orders: FacilityOrder[]
  operators: { id: string; name: string }[]
  facilities: { id: string; name: string }[]
  assignOperatorAction: (fd: FormData) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const [toasts, setToasts] = useState<Record<string, string>>({})

  function flash(orderId: string, msg: string) {
    setToasts(t => ({ ...t, [orderId]: msg }))
    setTimeout(() => setToasts(t => { const n = { ...t }; delete n[orderId]; return n }), 2500)
  }

  function handleAssign(orderId: string, operatorId: string) {
    const fd = new FormData()
    fd.set("bookingId", orderId)
    fd.set("operatorId", operatorId)
    fd.set("date", date)
    startTransition(async () => {
      await assignOperatorAction(fd)
      flash(orderId, "Assigned ✓")
    })
  }

  // Group orders by facility
  const byFacility: Record<string, { facility: { id: string; name: string }; orders: FacilityOrder[] }> = {}
  for (const order of orders) {
    const fac = order.assigned_facility
    if (!fac) continue
    if (!byFacility[fac.id]) byFacility[fac.id] = { facility: fac, orders: [] }
    byFacility[fac.id].orders.push(order)
  }

  // Orders without a facility assigned
  const unrouted = orders.filter(o => !o.assigned_facility)

  return (
    <div className="space-y-6">

      {orders.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">No orders currently at a facility for this date.</p>
        </div>
      )}

      {/* Per-facility sections */}
      {Object.values(byFacility).map(({ facility, orders: facOrders }) => {
        // Which operators are assigned to any order at this facility today
        const assignedOpIds = new Set(facOrders.map(o => o.assigned_operator_id).filter(Boolean))

        return (
          <div key={facility.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-extrabold text-[#0D2240] text-base">{facility.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{facOrders.length} order{facOrders.length !== 1 ? "s" : ""} in process</p>
              </div>

              {/* Operators working this facility */}
              {assignedOpIds.size > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {[...assignedOpIds].map(opId => {
                    const op = operators.find(o => o.id === opId)
                    return op ? (
                      <span key={opId} className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-full">
                        {op.name}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>

            <div className="divide-y divide-gray-50">
              {facOrders.map(order => {
                const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
                const bags = order.num_bags ?? order.num_comforters ?? 1
                const assignedOp = operators.find(o => o.id === order.assigned_operator_id)

                return (
                  <div key={order.id} className="px-5 py-3 flex items-center gap-3 flex-wrap relative">
                    {toasts[order.id] && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-[#0D2240] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
                        {toasts[order.id]}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black font-mono text-[#0D2240] text-sm">{code}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded">
                          {SERVICE_LABELS[order.service_type] ?? order.service_type}
                        </span>
                        <span className="text-[10px] text-gray-400">{bags} bag{bags !== 1 ? "s" : ""}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${
                          order.status === "in_progress" ? "bg-orange-100 text-orange-700"
                          : order.status === "picked_up" ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-500"
                        }`}>{order.status?.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{order.customer_name}</p>
                    </div>

                    {/* Operator assignment dropdown */}
                    <div className="flex items-center gap-2">
                      {assignedOp && (
                        <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded-full border border-purple-200">
                          {assignedOp.name}
                        </span>
                      )}
                      <select
                        disabled={isPending || operators.length === 0}
                        value={order.assigned_operator_id ?? ""}
                        onChange={e => handleAssign(order.id, e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="">Assign operator...</option>
                        {operators.map(op => (
                          <option key={op.id} value={op.id}>{op.name}</option>
                        ))}
                      </select>
                      {order.assigned_operator_id && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleAssign(order.id, "")}
                          className="text-[10px] text-red-400 hover:text-red-600 font-semibold disabled:opacity-40"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Unrouted (no facility) */}
      {unrouted.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200">
            <h3 className="font-extrabold text-amber-700 text-base">No Facility Assigned</h3>
            <p className="text-xs text-amber-600 mt-0.5">{unrouted.length} order{unrouted.length !== 1 ? "s" : ""} need a facility</p>
          </div>
          <div className="divide-y divide-amber-100">
            {unrouted.map(order => {
              const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
              const bags = order.num_bags ?? order.num_comforters ?? 1
              return (
                <div key={order.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-black font-mono text-amber-800 text-sm">{code}</span>
                  <span className="text-xs text-amber-700">{order.customer_name}</span>
                  <span className="text-[10px] text-amber-500">{bags} bag{bags !== 1 ? "s" : ""}</span>
                  <a href={`/admin/orders/${order.id}`} className="ml-auto text-[10px] text-amber-600 font-bold underline">
                    Assign facility →
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {operators.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          No active operators found. Add workers with the "operator" role in{" "}
          <a href="/admin/workers" className="font-bold underline">Workers</a>.
        </div>
      )}
    </div>
  )
}
