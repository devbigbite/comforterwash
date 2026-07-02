"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { FacilityOrder } from "@/app/admin/dispatch/page"

const SERVICE_LABELS: Record<string, string> = {
  wash_fold:      "W&F",
  wash_only:      "Wash",
  comforter_wash: "Comforter",
}

const STATUS_COLOR: Record<string, string> = {
  in_progress: "bg-[#E8726A]/15 text-[#E8726A]",
  picked_up:   "bg-blue-100 text-blue-700",
  at_facility: "bg-cyan-100 text-cyan-700",
  in_washer:   "bg-orange-100 text-orange-700",
  in_dryer:    "bg-yellow-100 text-yellow-700",
  folded:      "bg-green-100 text-green-700",
  ready:       "bg-teal-100 text-teal-700",
}

// ─── Kanban card ─────────────────────────────────────────────────────────────

function OperatorCard({
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
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  const code = order.short_code ?? order.id.slice(0, 6).toUpperCase()
  const bags = order.num_bags ?? order.num_comforters ?? 1

  function assign(operatorId: string) {
    const fd = new FormData()
    fd.set("bookingId", order.id)
    fd.set("operatorId", operatorId)
    fd.set("date", date)
    startTransition(async () => {
      await assignOperatorAction(fd)
      setOpen(false)
      setToast(operatorId ? "Assigned ✓" : "Removed")
      setTimeout(() => setToast(null), 2500)
    })
  }

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
          <span className="font-black font-mono text-[#0D2240] text-xs">{code}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-500"}`}>
            {order.status?.replace(/_/g, " ")}
          </span>
        </div>
        <p className="font-semibold text-[#0D2240] text-xs truncate">{order.customer_name}</p>
        {order.assigned_facility && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">📍 {order.assigned_facility.name}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded">
            {SERVICE_LABELS[order.service_type] ?? order.service_type}
          </span>
          <span className="text-[9px] text-gray-400">{bags} bag{bags !== 1 ? "s" : ""}</span>
        </div>
      </button>

      {/* Assign panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl px-3 py-2.5 space-y-2">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Assign operator</p>
          <div className="grid gap-1">
            {operators.map(op => {
              const isAssigned = op.id === order.assigned_operator_id
              return (
                <button
                  key={op.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => assign(isAssigned ? "" : op.id)}
                  className={`w-full text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                    isAssigned
                      ? "bg-[#E8726A] text-white border-[#E8726A]"
                      : "bg-white text-[#0D2240] border-gray-200 hover:border-[#E8726A] hover:bg-red-50"
                  }`}
                >
                  {isAssigned ? "✓ " : ""}{op.name}
                </button>
              )
            })}
          </div>
          {order.assigned_operator_id && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => assign("")}
              className="w-full text-[10px] text-red-400 hover:text-red-600 font-semibold py-1 transition-colors disabled:opacity-50"
            >
              Remove operator assignment
            </button>
          )}
          <Link href={`/admin/orders/${order.id}`} className="block text-center text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold pt-0.5">
            View full order →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Operator column ──────────────────────────────────────────────────────────

function OperatorColumn({
  operator,
  orders,
  allOperators,
  date,
  assignOperatorAction,
}: {
  operator: { id: string; name: string } | null  // null = Unassigned
  orders: FacilityOrder[]
  allOperators: { id: string; name: string }[]
  date: string
  assignOperatorAction: (fd: FormData) => Promise<void>
}) {
  const isUnassigned = operator === null

  return (
    <div className={`flex flex-col min-w-[220px] max-w-[260px] rounded-2xl border ${
      isUnassigned ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
    } shadow-sm overflow-hidden flex-shrink-0`}>

      {/* Column header */}
      <div className={`px-3 py-3 border-b ${isUnassigned ? "border-amber-200" : "border-gray-100"}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black ${isUnassigned ? "text-amber-700" : "text-[#0D2240]"}`}>
            {isUnassigned ? "Unassigned" : operator!.name}
          </span>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
            isUnassigned ? "bg-amber-200 text-amber-700" : "bg-gray-100 text-gray-500"
          }`}>{orders.length}</span>
        </div>
        {!isUnassigned && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {orders.length} order{orders.length !== 1 ? "s" : ""} assigned
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="p-2 flex-1 overflow-y-auto max-h-[70vh] space-y-1.5">
        {orders.length === 0 && (
          <p className="text-center text-[10px] text-gray-300 py-6">
            {isUnassigned ? "All assigned 🎉" : "Nothing assigned yet"}
          </p>
        )}
        {orders.map(order => (
          <OperatorCard
            key={order.id}
            order={order}
            operators={allOperators}
            date={date}
            assignOperatorAction={assignOperatorAction}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OperatorDispatch({
  date,
  orders,
  operators,
  facilities: _unused,
  assignOperatorAction,
}: {
  date: string
  orders: FacilityOrder[]
  operators: { id: string; name: string }[]
  facilities: { id: string; name: string }[]
  assignOperatorAction: (fd: FormData) => Promise<void>
}) {
  const unassigned = orders.filter(o => !o.assigned_operator_id)

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Unassigned pool */}
        <OperatorColumn
          operator={null}
          orders={unassigned}
          allOperators={operators}
          date={date}
          assignOperatorAction={assignOperatorAction}
        />

        {/* One column per operator */}
        {operators.map(op => {
          const mine = orders.filter(o => o.assigned_operator_id === op.id)
          return (
            <OperatorColumn
              key={op.id}
              operator={op}
              orders={mine}
              allOperators={operators}
              date={date}
              assignOperatorAction={assignOperatorAction}
            />
          )
        })}
      </div>

      {operators.length === 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          No active operators. Add workers with the "operator" role in{" "}
          <a href="/admin/workers" className="font-bold underline">Workers</a>.
        </div>
      )}
    </div>
  )
}
