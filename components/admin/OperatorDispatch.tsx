"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { FacilityOrder } from "@/app/admin/dispatch/page"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

function OrderRow({
  order,
  operators,
  date,
  assignOperatorAction,
}: {
  order: FacilityOrder
  operators: { id: string; name: string }[]
  date: string
  assignOperatorAction: (fd: FormData) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
  const bags = order.num_bags ?? order.num_comforters ?? 1
  const assignedOp = operators.find(o => o.id === order.assigned_operator_id)

  function assign(operatorId: string) {
    const fd = new FormData()
    fd.set("bookingId", order.id)
    fd.set("operatorId", operatorId)
    fd.set("date", date)
    startTransition(async () => {
      await assignOperatorAction(fd)
      setExpanded(false)
      setToast(operatorId ? "Assigned ✓" : "Removed")
      setTimeout(() => setToast(null), 2500)
    })
  }

  return (
    <div className="border-b border-gray-100 last:border-0 relative">
      {toast && (
        <div className="absolute right-4 top-3 z-10 bg-[#0D2240] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
          {toast}
        </div>
      )}

      {/* Row */}
      <button
        type="button"
        onClick={() => setExpanded(o => !o)}
        className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black font-mono text-[#0D2240] text-sm">{code}</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded">
              {SERVICE_LABELS[order.service_type] ?? order.service_type}
            </span>
            <span className="text-[10px] text-gray-400">{bags} bag{bags !== 1 ? "s" : ""}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              order.status === "in_progress" ? "bg-[#E8726A]/15 text-[#E8726A]"
              : order.status === "picked_up"  ? "bg-blue-100 text-blue-600"
              : "bg-gray-100 text-gray-400"
            }`}>{order.status?.replace(/_/g, " ")}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{order.customer_name}</p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {assignedOp ? (
            <span className="text-xs font-bold bg-[#E8726A] text-white px-3 py-1 rounded-full">
              {assignedOp.name}
            </span>
          ) : (
            <span className="text-xs font-semibold text-gray-300 border border-dashed border-gray-200 px-3 py-1 rounded-full">
              Unassigned
            </span>
          )}
          <span className={`text-gray-300 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {/* Expanded operator picker */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">Assign operator</p>
          <div className="flex flex-wrap gap-2">
            {operators.map(op => {
              const isAssigned = op.id === order.assigned_operator_id
              return (
                <button
                  key={op.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => assign(isAssigned ? "" : op.id)}
                  className={`text-sm font-bold px-4 py-2 rounded-xl border transition-all disabled:opacity-50 ${
                    isAssigned
                      ? "bg-[#E8726A] text-white border-[#E8726A] shadow-sm"
                      : "bg-white text-[#0D2240] border-gray-200 hover:border-[#E8726A] hover:bg-[#E8726A]/5"
                  }`}
                >
                  {isAssigned ? "✓ " : ""}{op.name}
                </button>
              )
            })}
          </div>
          <Link href={`/admin/orders/${order.id}`} className="block mt-3 text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold">
            View full order →
          </Link>
        </div>
      )}
    </div>
  )
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
  // Group by facility
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
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
          <p className="text-gray-400 text-sm">No orders currently at a facility.</p>
        </div>
      )}

      {Object.values(byFacility).map(({ facility, orders: facOrders }) => {
        const assignedOpIds = [...new Set(facOrders.map(o => o.assigned_operator_id).filter(Boolean) as string[])]

        return (
          <div key={facility.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Facility header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-4 flex-wrap bg-gray-50">
              <div className="flex-1 min-w-0 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E8726A] shrink-0" />
                <div>
                  <h3 className="font-extrabold text-[#0D2240] text-base">{facility.name}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {facOrders.length} order{facOrders.length !== 1 ? "s" : ""} in process
                  </p>
                </div>
              </div>

              {assignedOpIds.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {assignedOpIds.map(opId => {
                    const op = operators.find(o => o.id === opId)
                    return op ? (
                      <span key={opId} className="text-xs bg-[#E8726A] text-white font-bold px-3 py-1 rounded-full">
                        {op.name}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>

            {/* Order rows */}
            <div>
              {facOrders.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  operators={operators}
                  date={date}
                  assignOperatorAction={assignOperatorAction}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Unrouted */}
      {unrouted.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <div>
              <h3 className="font-extrabold text-amber-700 text-base">No Facility Assigned</h3>
              <p className="text-[10px] text-amber-500 mt-0.5">
                {unrouted.length} order{unrouted.length !== 1 ? "s" : ""} need a facility
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {unrouted.map(order => {
              const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
              const bags = order.num_bags ?? order.num_comforters ?? 1
              return (
                <div key={order.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-black font-mono text-[#0D2240] text-sm">{code}</span>
                  <span className="text-xs text-gray-500">{order.customer_name}</span>
                  <span className="text-[10px] text-gray-400">{bags} bag{bags !== 1 ? "s" : ""}</span>
                  <Link href={`/admin/orders/${order.id}`} className="ml-auto text-[10px] text-[#E8726A] font-bold hover:underline">
                    Assign facility →
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {operators.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          No active operators. Add workers with the "operator" role in{" "}
          <a href="/admin/workers" className="font-bold underline">Workers</a>.
        </div>
      )}
    </div>
  )
}
