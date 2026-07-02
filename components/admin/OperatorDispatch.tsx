"use client"

import { useState, useTransition } from "react"
import type { FacilityOrder } from "@/app/admin/dispatch/page"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

const STATUS_STYLE: Record<string, string> = {
  in_progress: "bg-[#E8726A]/20 text-[#E8726A] border border-[#E8726A]/30",
  picked_up:   "bg-blue-500/20 text-blue-300 border border-blue-400/30",
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

  const unrouted = orders.filter(o => !o.assigned_facility)

  return (
    <div className="space-y-5">

      {orders.length === 0 && (
        <div className="bg-[#0D2240] rounded-2xl border border-white/10 p-10 text-center">
          <p className="text-white/40 text-sm">No orders currently at a facility.</p>
        </div>
      )}

      {Object.values(byFacility).map(({ facility, orders: facOrders }) => {
        const assignedOpIds = [...new Set(facOrders.map(o => o.assigned_operator_id).filter(Boolean) as string[])]

        return (
          <div key={facility.id} className="bg-[#0D2240] rounded-2xl border border-white/10 shadow-lg overflow-hidden">

            {/* Facility header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E8726A] shrink-0" />
                  <h3 className="font-extrabold text-white text-base">{facility.name}</h3>
                </div>
                <p className="text-xs text-white/40 mt-0.5 ml-4">
                  {facOrders.length} order{facOrders.length !== 1 ? "s" : ""} in process
                </p>
              </div>

              {/* Active operators at this facility */}
              {assignedOpIds.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {assignedOpIds.map(opId => {
                    const op = operators.find(o => o.id === opId)
                    return op ? (
                      <span key={opId} className="text-xs bg-[#E8726A]/20 text-[#E8726A] border border-[#E8726A]/30 font-bold px-2.5 py-1 rounded-full">
                        {op.name}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>

            {/* Order rows */}
            <div className="divide-y divide-white/5">
              {facOrders.map(order => {
                const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
                const bags = order.num_bags ?? order.num_comforters ?? 1
                const assignedOp = operators.find(o => o.id === order.assigned_operator_id)

                return (
                  <div key={order.id} className="px-5 py-3.5 flex items-center gap-4 flex-wrap relative hover:bg-white/5 transition-colors">
                    {toasts[order.id] && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-[#E8726A] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
                        {toasts[order.id]}
                      </div>
                    )}

                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black font-mono text-white text-sm">{code}</span>
                        <span className="text-[10px] bg-white/10 text-white/60 font-bold px-1.5 py-0.5 rounded">
                          {SERVICE_LABELS[order.service_type] ?? order.service_type}
                        </span>
                        <span className="text-[10px] text-white/40">{bags} bag{bags !== 1 ? "s" : ""}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[order.status] ?? "bg-white/10 text-white/50"}`}>
                          {order.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{order.customer_name}</p>
                    </div>

                    {/* Operator assignment */}
                    <div className="flex items-center gap-2 shrink-0">
                      {assignedOp && (
                        <span className="text-[10px] bg-[#E8726A]/20 text-[#E8726A] border border-[#E8726A]/30 font-bold px-2 py-1 rounded-full">
                          {assignedOp.name}
                        </span>
                      )}
                      <select
                        disabled={isPending || operators.length === 0}
                        value={order.assigned_operator_id ?? ""}
                        onChange={e => handleAssign(order.id, e.target.value)}
                        className="rounded-lg border border-white/20 bg-white/10 text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#E8726A]/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="" className="bg-[#0D2240]">
                          {assignedOp ? "Reassign..." : "Assign operator..."}
                        </option>
                        {operators.map(op => (
                          <option key={op.id} value={op.id} className="bg-[#0D2240]">{op.name}</option>
                        ))}
                      </select>
                      {order.assigned_operator_id && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleAssign(order.id, "")}
                          className="text-white/30 hover:text-[#E8726A] font-bold text-sm transition-colors disabled:opacity-40"
                          title="Remove assignment"
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

      {/* Unrouted orders */}
      {unrouted.length > 0 && (
        <div className="bg-[#0D2240] rounded-2xl border border-amber-400/30 shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-400/20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <h3 className="font-extrabold text-amber-400 text-base">No Facility Assigned</h3>
            </div>
            <p className="text-xs text-amber-400/60 mt-0.5 ml-4">
              {unrouted.length} order{unrouted.length !== 1 ? "s" : ""} need a facility
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {unrouted.map(order => {
              const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
              const bags = order.num_bags ?? order.num_comforters ?? 1
              return (
                <div key={order.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-black font-mono text-amber-400 text-sm">{code}</span>
                  <span className="text-xs text-white/60">{order.customer_name}</span>
                  <span className="text-[10px] text-white/30">{bags} bag{bags !== 1 ? "s" : ""}</span>
                  <a href={`/admin/orders/${order.id}`} className="ml-auto text-[10px] text-[#E8726A] font-bold hover:underline">
                    Assign facility →
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {operators.length === 0 && (
        <div className="bg-[#0D2240] border border-amber-400/30 rounded-xl p-4 text-sm text-amber-400">
          No active operators found. Add workers with the "operator" role in{" "}
          <a href="/admin/workers" className="font-bold underline">Workers</a>.
        </div>
      )}
    </div>
  )
}
