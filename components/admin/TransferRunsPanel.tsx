"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { TransportRun } from "@/app/actions/transport-runs"

const RUN_TYPE_LABEL: Record<string, string> = {
  to_facility:  "Warehouse → Facility",
  to_warehouse: "Facility → Warehouse",
}
const RUN_TYPE_COLOR: Record<string, string> = {
  to_facility:  "bg-amber-100 text-amber-700 border-amber-200",
  to_warehouse: "bg-indigo-100 text-indigo-700 border-indigo-200",
}
const RUN_TYPE_ARROW: Record<string, string> = {
  to_facility:  "→ Facility",
  to_warehouse: "→ Warehouse",
}

export function TransferRunsPanel({
  runs,
  drivers,
  assignRunDriverAction,
}: {
  runs: TransportRun[]
  drivers: { id: string; name: string; shipday_email: string | null }[]
  assignRunDriverAction: (runId: string, driverName: string) => Promise<void>
}) {
  const pendingRuns = runs.filter(r => r.status === "pending")
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [toasts, setToasts] = useState<Record<string, string>>({})

  function flash(runId: string, msg: string) {
    setToasts(t => ({ ...t, [runId]: msg }))
    setTimeout(() => setToasts(t => { const n = { ...t }; delete n[runId]; return n }), 2500)
  }

  function handleAssign(runId: string, driverName: string) {
    startTransition(async () => {
      await assignRunDriverAction(runId, driverName)
      flash(runId, "Assigned ✓")
    })
  }

  return (
    <div className="space-y-4">

      {/* Header with link to full runs page */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-[#0D2240] text-base">Transfer Runs</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Groups of orders moving between facility and warehouse
          </p>
        </div>
        <Link
          href="/admin/runs"
          className="text-xs font-bold bg-[#0D2240] text-white px-4 py-2 rounded-xl hover:bg-[#1a3a5c] transition-colors"
        >
          + Create Run
        </Link>
      </div>

      {pendingRuns.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-400 text-sm">No pending transfer runs.</p>
          <Link href="/admin/runs" className="text-xs text-[#E8726A] font-bold mt-2 inline-block hover:underline">
            Create a run →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {pendingRuns.map(run => {
          const orderCount = run.order_ids?.length ?? 0
          const isExpanded = expandedRun === run.id
          const currentDriver = drivers.find(d => d.name === run.assigned_to)

          return (
            <div key={run.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
              {toasts[run.id] && (
                <div className="absolute right-4 top-3 z-10 bg-[#0D2240] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
                  {toasts[run.id]}
                </div>
              )}

              {/* Run header */}
              <button
                type="button"
                onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RUN_TYPE_COLOR[run.run_type]}`}>
                      {RUN_TYPE_LABEL[run.run_type]}
                    </span>
                    <span className="text-xs text-gray-400">{orderCount} order{orderCount !== 1 ? "s" : ""}</span>
                    {run.facility_name && (
                      <span className="text-xs font-semibold text-[#0D2240]">{run.facility_name}</span>
                    )}
                    {run.storage_space_name && (
                      <span className="text-xs text-gray-400">· {run.storage_space_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {run.assigned_to ? (
                      <span className="text-xs font-bold bg-[#E8726A] text-white px-2.5 py-0.5 rounded-full">
                        {run.assigned_to}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 font-semibold border border-dashed border-amber-300 px-2 py-0.5 rounded-full">
                        Unassigned
                      </span>
                    )}
                    {run.shipday_order_id ? (
                      <span className="text-[9px] text-green-600 font-bold">● Synced to Shipday</span>
                    ) : (
                      <span className="text-[9px] text-amber-500 font-bold">○ Not in Shipday</span>
                    )}
                  </div>
                </div>
                <span className="text-[#E8726A] font-black text-sm border border-[#E8726A]/30 bg-[#E8726A]/5 px-2 py-1 rounded-lg">
                  {RUN_TYPE_ARROW[run.run_type]}
                </span>
                <span className={`text-gray-300 text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
              </button>

              {/* Expanded: reassign driver */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
                    Assign driver for this run
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {drivers.map(d => {
                      const isAssigned = d.name === run.assigned_to
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleAssign(run.id, d.name)}
                          className={`text-sm font-bold px-4 py-2 rounded-xl border transition-all disabled:opacity-50 ${
                            isAssigned
                              ? "bg-[#E8726A] text-white border-[#E8726A] shadow-sm"
                              : "bg-white text-[#0D2240] border-gray-200 hover:border-[#E8726A] hover:bg-[#E8726A]/5"
                          }`}
                        >
                          {isAssigned ? "✓ " : ""}{d.name}
                          {!d.shipday_email && (
                            <span className="text-[9px] ml-1 text-amber-500">(no Shipday)</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {run.notes && (
                    <p className="text-xs text-gray-400 mt-3">Notes: {run.notes}</p>
                  )}
                  <Link
                    href="/admin/runs"
                    className="block mt-3 text-[10px] text-gray-400 hover:text-[#0D2240] font-semibold"
                  >
                    Manage all runs →
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
