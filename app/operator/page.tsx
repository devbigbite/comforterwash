"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PinGate, useWorkerT, useWorkerSession } from "@/components/pin-gate"
import { RoleSwitcher } from "@/components/role-switcher"
import { getPendingRunsForRole } from "@/app/actions/transport-runs"
import type { TransportRun } from "@/app/actions/transport-runs"

interface WorkOrder {
  id: string
  short_code: string | null
  customer_name: string
  service_type: string
  delivery_date: string
  status: string
  bags_at_facility: number
  bags_total: number
  most_advanced_status: string
  assigned_facility_id: string | null
}

interface Facility {
  id: string
  name: string
}

// Plain-English labels for what needs to happen NEXT
const NEXT_ACTION: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  confirmed:    { label: "Awaiting pickup",      color: "text-gray-400",   bg: "bg-gray-500/10",    dot: "bg-gray-400" },
  picked_up:    { label: "Needs check-in",       color: "text-blue-300",   bg: "bg-blue-500/15",    dot: "bg-blue-400" },
  in_progress:  { label: "Being processed",      color: "text-purple-300", bg: "bg-purple-500/15",  dot: "bg-purple-400" },
  at_warehouse: { label: "Ready to send out",    color: "text-amber-300",  bg: "bg-amber-500/15",   dot: "bg-amber-400" },
  at_facility:  { label: "Load into washer",     color: "text-cyan-300",   bg: "bg-cyan-500/15",    dot: "bg-cyan-400" },
  in_washer:    { label: "Move to dryer",        color: "text-orange-300", bg: "bg-orange-500/15",  dot: "bg-orange-400" },
  in_dryer:     { label: "Ready to fold",        color: "text-yellow-300", bg: "bg-yellow-500/15",  dot: "bg-yellow-400" },
  folded:       { label: "Mark ready for pickup",color: "text-green-300",  bg: "bg-green-500/15",   dot: "bg-green-400" },
  ready:        { label: "Done — awaiting driver",color: "text-green-400", bg: "bg-green-500/20",   dot: "bg-green-400" },
}

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter Wash",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

export default function OperatorHome() {
  const t = useWorkerT("operator")
  const session = useWorkerSession()

  const [showKeypad, setShowKeypad]           = useState(false)
  const [code, setCode]                       = useState("")
  const [lookupLoading, setLookupLoading]     = useState(false)
  const [error, setError]                     = useState("")
  const [queue, setQueue]                     = useState<WorkOrder[]>([])
  const [pendingRuns, setPendingRuns]         = useState<TransportRun[]>([])
  const [queueLoading, setQueueLoading]       = useState(true)
  const [facilities, setFacilities]           = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("")
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      const [{ data: facilityList }, runs] = await Promise.all([
        supabase.from("facilities").select("id, name").eq("active", true).order("name"),
        getPendingRunsForRole("operator"),
      ])
      setFacilities(facilityList ?? [])
      setPendingRuns(runs)

      // 1. Bookings in processing statuses (even without bags scanned yet)
      const { data: activeBookings } = await supabase
        .from("bookings")
        .select("id, short_code, customer_name, service_type, delivery_date, status, num_bags, facility_processing_mode, assigned_facility_id")
        .in("status", ["picked_up", "in_progress", "confirmed"])
        .or("facility_processing_mode.is.null,facility_processing_mode.neq.partner_attendant")
        .order("delivery_date")

      // 2. Bags already scanned into the processing loop
      const { data: bags } = await supabase
        .from("order_bags")
        .select("booking_id, status")
        .in("status", ["at_warehouse", "at_facility", "in_washer", "in_dryer", "folded"])

      const STATUS_ORDER = ["at_warehouse", "at_facility", "in_washer", "in_dryer", "folded", "ready"]

      const bagBookingIds = [...new Set((bags ?? []).map(b => b.booking_id))]
      const activeIds = new Set((activeBookings ?? []).map(b => b.id))
      const extraBagIds = bagBookingIds.filter(id => !activeIds.has(id))

      let extraBookings: typeof activeBookings = []
      if (extraBagIds.length > 0) {
        const { data } = await supabase
          .from("bookings")
          .select("id, short_code, customer_name, service_type, delivery_date, status, num_bags, facility_processing_mode, assigned_facility_id")
          .in("id", extraBagIds)
          .not("facility_processing_mode", "eq", "partner_attendant")
        extraBookings = data ?? []
      }

      const allBookings = [...(activeBookings ?? []), ...extraBookings]
      if (!allBookings.length) { setQueueLoading(false); return }

      const enriched: WorkOrder[] = allBookings.map(b => {
        const orderBags = (bags ?? []).filter(bag => bag.booking_id === b.id)
        const statuses = orderBags.map(bag => bag.status)
        const mostAdvanced = statuses.length
          ? [...statuses].sort((a, z) => STATUS_ORDER.indexOf(z) - STATUS_ORDER.indexOf(a))[0]
          : b.status
        return {
          id: b.id,
          short_code: b.short_code ?? null,
          customer_name: b.customer_name,
          service_type: b.service_type,
          delivery_date: b.delivery_date,
          status: b.status,
          bags_at_facility: orderBags.length,
          bags_total: b.num_bags ?? orderBags.length,
          most_advanced_status: mostAdvanced,
          assigned_facility_id: b.assigned_facility_id ?? null,
        }
      })

      setQueue(enriched)
      setQueueLoading(false)
    }
    loadData()
  }, [])

  async function lookup() {
    const cleaned = code.trim().replace(/\D/g, "")
    if (cleaned.length < 4) { setError("Enter at least 4 digits"); return }
    setLookupLoading(true)
    setError("")
    const supabase = createClient()
    const { data: byCode } = await supabase
      .from("bookings").select("id").eq("short_code", cleaned).maybeSingle()
    if (byCode) { router.push(`/operator/order/${byCode.id}`); return }
    const { data: byId } = await supabase
      .from("bookings").select("id").ilike("id", `${cleaned}%`).limit(1).maybeSingle()
    setLookupLoading(false)
    if (!byId) { setError("Order not found"); return }
    router.push(`/operator/order/${byId.id}`)
  }

  const filteredQueue = selectedFacilityId
    ? queue.filter(o => o.assigned_facility_id === selectedFacilityId)
    : queue

  const toFacilityRuns  = pendingRuns.filter(r => r.run_type === "to_facility")
  const toWarehouseRuns = pendingRuns.filter(r => r.run_type === "to_warehouse")

  // Sort: most actionable first (in_dryer → in_washer → at_facility → folded → others)
  const ACTION_PRIORITY: Record<string, number> = {
    in_dryer: 0, in_washer: 1, at_facility: 2, folded: 3,
    at_warehouse: 4, picked_up: 5, in_progress: 6, confirmed: 7, ready: 8,
  }
  const sortedQueue = [...filteredQueue].sort(
    (a, b) => (ACTION_PRIORITY[a.most_advanced_status] ?? 9) - (ACTION_PRIORITY[b.most_advanced_status] ?? 9)
  )

  return (
    <PinGate role="operator">
    <div className="min-h-screen bg-[#0D2240]">

      {/* Header */}
      <div className="px-5 pt-8 pb-5 flex items-center justify-between">
        <div>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Operator Station</p>
          <h1 className="text-2xl font-extrabold text-white mt-0.5">
            {session?.workerName ? `Hi, ${session.workerName.split(" ")[0]} 👋` : "Today's Queue"}
          </h1>
        </div>
        <RoleSwitcher currentRole="operator" />
      </div>

      <div className="px-4 pb-10 max-w-lg mx-auto space-y-3">

        {queueLoading && (
          <div className="text-center py-12">
            <p className="text-white/30 text-sm animate-pulse">Loading your queue…</p>
          </div>
        )}

        {/* ── Transport runs ── */}
        {!queueLoading && toFacilityRuns.length > 0 && (
          <div>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-2 px-1">
              🚐 Runs to facility ({toFacilityRuns.length})
            </p>
            <div className="space-y-2">
              {toFacilityRuns.map(run => (
                <button key={run.id} onClick={() => router.push(`/operator/run/${run.id}`)}
                  className="w-full bg-purple-500/20 border border-purple-500/30 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold">🏭 {run.facility_name ?? "Facility"} run</p>
                      <p className="text-purple-300 text-sm mt-0.5">{run.order_ids.length} orders · tap to execute</p>
                    </div>
                    <span className="text-2xl">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!queueLoading && toWarehouseRuns.length > 0 && (
          <div>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-2 px-1">
              🏪 Returns to warehouse ({toWarehouseRuns.length})
            </p>
            <div className="space-y-2">
              {toWarehouseRuns.map(run => (
                <button key={run.id} onClick={() => router.push(`/operator/run/${run.id}`)}
                  className="w-full bg-amber-500/20 border border-amber-500/30 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold">🏪 {run.facility_name ?? "Facility"} → Warehouse</p>
                      <p className="text-amber-300 text-sm mt-0.5">{run.order_ids.length} orders · tap to execute</p>
                    </div>
                    <span className="text-2xl">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Facility filter ── */}
        {!queueLoading && facilities.length > 1 && (
          <div className="bg-white/8 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-sm">🏭</span>
            <select value={selectedFacilityId} onChange={e => setSelectedFacilityId(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm font-semibold outline-none appearance-none cursor-pointer">
              <option value="" className="bg-[#0D2240]">All facilities</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id} className="bg-[#0D2240]">{f.name}</option>
              ))}
            </select>
            <span className="text-white/40 text-xs">▼</span>
          </div>
        )}

        {/* ── Work queue ── */}
        {!queueLoading && sortedQueue.length > 0 && (
          <div>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-2 px-1">
              Orders to process ({sortedQueue.length})
            </p>
            <div className="space-y-2">
              {sortedQueue.map((o) => {
                const next = NEXT_ACTION[o.most_advanced_status] ?? NEXT_ACTION["confirmed"]
                const isReady = o.most_advanced_status === "ready"
                return (
                  <button key={o.id} onClick={() => router.push(`/operator/order/${o.id}`)}
                    className={`w-full ${next.bg} border border-white/10 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Next action — the headline */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${next.dot}`} />
                          <p className={`font-bold text-sm ${next.color}`}>{next.label}</p>
                        </div>
                        {/* Customer + service — secondary */}
                        <p className="text-white font-semibold truncate">{o.customer_name}</p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {SERVICE_LABEL[o.service_type] ?? o.service_type}
                          {o.bags_total > 0 && ` · ${o.bags_at_facility}/${o.bags_total} bags`}
                          {o.delivery_date && ` · Due ${o.delivery_date}`}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="text-white/30 font-mono text-xs">
                          {o.short_code?.toUpperCase() ?? o.id.slice(0, 5).toUpperCase()}
                        </span>
                        {!isReady && (
                          <span className="text-white/60 text-lg">→</span>
                        )}
                        {isReady && (
                          <span className="text-green-400 text-xs font-bold">✓ Done</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!queueLoading && sortedQueue.length === 0 && pendingRuns.length === 0 && (
          <div className="bg-white/5 rounded-2xl p-8 text-center mt-4">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-white font-bold text-lg">All caught up!</p>
            <p className="text-white/40 text-sm mt-1">No orders waiting for processing right now.</p>
          </div>
        )}

        {/* ── Find by number (secondary) ── */}
        <div className="pt-2">
          <button onClick={() => setShowKeypad(v => !v)}
            className="w-full text-white/30 text-sm py-3 hover:text-white/50 transition-colors text-center">
            {showKeypad ? "▲ Hide" : "🔢 Find order by number"}
          </button>

          {showKeypad && (
            <div className="bg-white rounded-3xl p-5 shadow-2xl mt-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Enter order number
              </label>

              <div className={`w-full rounded-2xl border-2 px-4 py-3 mb-1 text-center transition-colors ${error ? "border-red-300 bg-red-50" : code.length > 0 ? "border-[#E8726A]" : "border-gray-200"}`}>
                {code.length > 0
                  ? <span className="text-3xl font-mono font-bold text-[#0D2240] tracking-[0.4em]">{code}</span>
                  : <span className="text-xl font-mono text-gray-300 tracking-widest">_ _ _ _ _ _</span>
                }
              </div>
              {error && <p className="text-sm text-red-500 font-medium mb-2 text-center">{error}</p>}

              <div className="grid grid-cols-3 gap-2 mt-3">
                {["1","2","3","4","5","6","7","8","9"].map(n => (
                  <button key={n} type="button"
                    onClick={() => { if (code.length < 6) { setCode(c => c + n); setError("") } }}
                    className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:bg-[#E8726A] active:text-white text-[#0D2240] font-extrabold text-2xl transition-colors select-none">
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => { setCode(""); setError("") }}
                  className="h-14 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-400 font-bold text-sm transition-colors select-none">CLR</button>
                <button type="button" onClick={() => { if (code.length < 6) { setCode(c => c + "0"); setError("") } }}
                  className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:bg-[#E8726A] active:text-white text-[#0D2240] font-extrabold text-2xl transition-colors select-none">0</button>
                <button type="button" onClick={() => { setCode(c => c.slice(0, -1)); setError("") }}
                  className="h-14 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold text-xl transition-colors select-none">⌫</button>
              </div>

              <button onClick={lookup} disabled={lookupLoading || code.length < 4}
                className="w-full mt-3 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors">
                {lookupLoading ? "Looking up…" : "Find Order →"}
              </button>
            </div>
          )}
        </div>

        {/* ── Footer links ── */}
        <div className="text-center space-y-2 pt-2">
          <a href="/staff" className="block text-white/30 text-xs hover:text-white/50 transition-colors font-semibold">
            ⏱ Clock In / Out
          </a>
          <a href="/driver" className="block text-white/20 text-xs hover:text-white/40 transition-colors">
            Switch to Driver view
          </a>
        </div>

      </div>
    </div>
    </PinGate>
  )
}
