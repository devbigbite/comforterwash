"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PinGate, useWorkerSession } from "@/components/pin-gate"
import { RoleSwitcher } from "@/components/role-switcher"
import { getPendingRunsForRole } from "@/app/actions/transport-runs"
import { getOperatorQueue } from "@/app/actions/operator-queue"
import type { TransportRun } from "@/app/actions/transport-runs"
import type { OperatorOrder } from "@/app/actions/operator-queue"

const SERVICE_EMOJI: Record<string, string> = {
  comforter_wash: "🛏",
  wash_fold:      "👕",
  wash_only:      "💧",
}

// The 4 physical stations an operator moves between
const LANES = [
  {
    key:      "needs_loading",
    label:    "Needs Loading",
    emoji:    "🧺",
    statuses: ["at_facility"],
    action:   "Load into washer",
    bg:       "bg-cyan-50",
    border:   "border-cyan-200",
    dot:      "bg-cyan-500",
    text:     "text-cyan-700",
  },
  {
    key:      "in_washer",
    label:    "In Washer",
    emoji:    "🌀",
    statuses: ["in_washer"],
    action:   "Move to dryer when done",
    bg:       "bg-orange-50",
    border:   "border-orange-200",
    dot:      "bg-orange-400",
    text:     "text-orange-600",
  },
  {
    key:      "in_dryer",
    label:    "In Dryer",
    emoji:    "💨",
    statuses: ["in_dryer"],
    action:   "Fold when done",
    bg:       "bg-yellow-50",
    border:   "border-yellow-200",
    dot:      "bg-yellow-500",
    text:     "text-yellow-700",
  },
  {
    key:      "ready_to_fold",
    label:    "Ready to Fold",
    emoji:    "👕",
    statuses: ["folded"],
    action:   "Pack & mark ready",
    bg:       "bg-green-50",
    border:   "border-green-200",
    dot:      "bg-green-500",
    text:     "text-green-700",
  },
]

// Incoming statuses kept for reference (section hidden from operators)
const INCOMING_STATUSES: string[] = []

export default function OperatorHome() {
  return (
    <PinGate role="operator">
      <OperatorHomeInner />
    </PinGate>
  )
}

function OperatorHomeInner() {
  const session = useWorkerSession()
  const router  = useRouter()
  const workerId = session?.workerId ?? null

  const [queue,       setQueue]       = useState<OperatorOrder[]>([])
  const [pendingRuns, setPendingRuns] = useState<TransportRun[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showIncoming, setShowIncoming] = useState(false)

  useEffect(() => {
    if (!workerId) { setLoading(false); return }
    async function load() {
      const [orders, runs] = await Promise.all([
        getOperatorQueue(workerId!),
        getPendingRunsForRole("operator"),
      ])
      setQueue(orders)
      setPendingRuns(runs)
      setLoading(false)
    }
    load()
  }, [workerId])

  const laneOrders = (statuses: string[]) =>
    queue.filter(o => statuses.includes(o.effective_status))

  const incoming = queue.filter(o => INCOMING_STATUSES.includes(o.effective_status))
  const toFacilityRuns  = pendingRuns.filter(r => r.run_type === "to_facility")
  const toWarehouseRuns = pendingRuns.filter(r => r.run_type === "to_warehouse")

  const activeCount = LANES.reduce((n, l) => n + laneOrders(l.statuses).length, 0)

  return (
    <div className="min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-5 pt-5 pb-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <p className="text-[#E8726A] text-[11px] font-bold uppercase tracking-widest">Operator Station</p>
            <h1 className="text-xl font-extrabold text-[#0D2240]">
              Today's Queue
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://dexterlive.com/users/sign_in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white bg-[#0D2240] hover:bg-[#1a3a5c] px-3 py-1.5 rounded-full transition-colors font-bold"
            >
              Dexter
            </a>
            <RoleSwitcher currentRole="operator" />
            <button
              onClick={() => { localStorage.removeItem("washfold_operator_worker"); window.location.href = "/staff" }}
              className="text-sm text-gray-400 hover:text-red-500 border border-gray-200 px-3 py-1.5 rounded-full transition-colors font-medium"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pb-10 pt-4 space-y-4">

          {loading && (
            <div className="text-center py-16">
              <p className="text-gray-300 text-base animate-pulse">Loading stations…</p>
            </div>
          )}

          {/* ── Transport runs ── */}
          {!loading && toFacilityRuns.length > 0 && toFacilityRuns.map(run => (
            <button key={run.id} onClick={() => router.push(`/operator/run/${run.id}`)}
              className="w-full bg-purple-50 border border-purple-200 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-purple-500 uppercase tracking-widest mb-0.5">🚐 Incoming Run</p>
                  <p className="text-[#0D2240] font-bold">{run.facility_name ?? "Facility"}</p>
                  <p className="text-purple-600 text-base">{run.order_ids.length} orders arriving — tap to receive</p>
                </div>
                <span className="text-2xl text-purple-300">→</span>
              </div>
            </button>
          ))}

          {!loading && toWarehouseRuns.length > 0 && toWarehouseRuns.map(run => (
            <button key={run.id} onClick={() => router.push(`/operator/run/${run.id}`)}
              className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-0.5">📦 Return Run</p>
                  <p className="text-[#0D2240] font-bold">{run.facility_name ?? "Facility"} → Warehouse</p>
                  <p className="text-amber-600 text-base">{run.order_ids.length} orders — tap to send out</p>
                </div>
                <span className="text-2xl text-amber-300">→</span>
              </div>
            </button>
          ))}

          {/* ── Station lanes ── */}
          {!loading && LANES.map(lane => {
            const orders = laneOrders(lane.statuses)
            if (orders.length === 0) return null
            return (
              <div key={lane.key} className={`${lane.bg} border ${lane.border} rounded-2xl overflow-hidden`}>
                {/* Lane header */}
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{lane.emoji}</span>
                    <div>
                      <p className={`font-extrabold text-base ${lane.text}`}>{lane.label}</p>
                      <p className="text-[11px] text-gray-400">{lane.action}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${lane.bg} ${lane.text} border ${lane.border}`}>
                    {orders.length} order{orders.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Order chips */}
                <div className="px-3 pb-3 flex flex-wrap gap-2">
                  {orders.map(o => (
                    <button
                      key={o.id}
                      onClick={() => router.push(`/operator/order/${o.id}`)}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-left shadow-sm active:scale-95 transition-transform hover:border-gray-300 flex items-center gap-2"
                    >
                      <span className="text-lg">{SERVICE_EMOJI[o.service_type] ?? "📦"}</span>
                      <div>
                        <p className="text-[#0D2240] font-bold text-base leading-tight">
                          {o.short_code ?? o.id.slice(0, 6).toUpperCase()}
                        </p>
                        {(lane.key === "in_washer" || lane.key === "in_dryer") ? (
                          <p className="text-gray-400 text-[11px]">
                            {lane.key === "in_washer" ? o.washer_label : o.dryer_label
                              ? <span className="font-semibold text-gray-600">{lane.key === "in_washer" ? o.washer_label : o.dryer_label}</span>
                              : "no machine"}
                            {o.actual_weight_lbs ? ` · ${o.actual_weight_lbs} lbs` : ""}
                          </p>
                        ) : (
                          <p className="text-gray-400 text-[11px]">
                            {o.bags_total} bag{o.bags_total !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {/* ── All clear ── */}
          {!loading && activeCount === 0 && pendingRuns.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-[#0D2240] font-bold text-xl">All stations clear!</p>
              <p className="text-gray-400 text-base mt-1">Nothing to process right now.</p>
            </div>
          )}

          {/* ── REMOVED: incoming orders hidden — operators only see what's physically here ── */}
          {false && incoming.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowIncoming(v => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                  <p className="text-base font-bold text-gray-500">
                    {incoming.length} order{incoming.length !== 1 ? "s" : ""} incoming
                  </p>
                </div>
                <span className="text-gray-300 text-sm">{showIncoming ? "▲" : "▼"}</span>
              </button>
              {showIncoming && (
                <div className="px-3 pb-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {incoming.map(o => (
                    <button
                      key={o.id}
                      onClick={() => router.push(`/operator/order/${o.id}`)}
                      className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-left active:scale-95 transition-transform flex items-center gap-2"
                    >
                      <span className="text-lg">{SERVICE_EMOJI[o.service_type] ?? "📦"}</span>
                      <div>
                        <p className="text-gray-500 font-bold text-base leading-tight">
                          {o.short_code ?? o.id.slice(0, 6).toUpperCase()}
                        </p>
                        <p className="text-gray-400 text-[11px]">{o.bags_total} bags · on the way</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Find by number ── */}
          <div className="pt-1">
            <button
              onClick={() => router.push("/operator/order")}
              className="w-full text-gray-400 text-base py-3 hover:text-gray-600 transition-colors text-center"
            >
              🔢 Find order by number
            </button>
          </div>

        </div>
      </div>
  )
}
