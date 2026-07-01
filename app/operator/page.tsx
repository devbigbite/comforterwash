"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PinGate, useWorkerT } from "@/components/pin-gate"
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

// STATUS_LABEL is now built dynamically from t() inside the component

const STATUS_DOT: Record<string, string> = {
  confirmed:    "bg-gray-400",
  picked_up:    "bg-blue-400",
  at_warehouse: "bg-amber-400",
  at_facility:  "bg-purple-400",
  in_washer:    "bg-cyan-400",
  in_dryer:     "bg-orange-400",
  folded:       "bg-yellow-400",
  ready:        "bg-green-400",
}

export default function OperatorHome() {
  const t = useWorkerT("operator")

  const STATUS_LABEL: Record<string, string> = {
    at_warehouse: t("status_at_warehouse"),
    at_facility:  t("status_at_facility"),
    in_washer:    t("status_in_washer"),
    in_dryer:     t("status_in_dryer"),
    folded:       t("status_folded"),
    ready:        t("status_ready"),
  }

  const [code, setCode] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [error, setError] = useState("")
  const [queue, setQueue] = useState<WorkOrder[]>([])
  const [pendingRuns, setPendingRuns] = useState<TransportRun[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [facilities, setFacilities] = useState<Facility[]>([])
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
        .not("facility_processing_mode", "eq", "partner_attendant")
        .order("delivery_date")

      // 2. Bags already scanned into the processing loop
      const { data: bags } = await supabase
        .from("order_bags")
        .select("booking_id, status")
        .in("status", ["at_warehouse", "at_facility", "in_washer", "in_dryer", "folded"])

      const STATUS_ORDER = ["at_warehouse", "at_facility", "in_washer", "in_dryer", "folded", "ready"]

      // Merge: start with active bookings, then add any bag-only bookings not already included
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
          : b.status  // fall back to booking status if no bags scanned yet
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
    if (cleaned.length < 4) { setError(t("enter_digits")); return }
    setLookupLoading(true)
    setError("")
    const supabase = createClient()
    const { data: byCode } = await supabase
      .from("bookings")
      .select("id")
      .eq("short_code", cleaned)
      .maybeSingle()
    if (byCode) { router.push(`/operator/order/${byCode.id}`); return }
    const { data: byId } = await supabase
      .from("bookings")
      .select("id")
      .ilike("id", `${cleaned}%`)
      .limit(1)
      .maybeSingle()
    setLookupLoading(false)
    if (!byId) { setError(t("not_found")); return }
    router.push(`/operator/order/${byId.id}`)
  }

  function handleScannerInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    setError("")
  }
  function handleScannerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && code.length >= 4) lookup()
  }

  const filteredQueue = selectedFacilityId
    ? queue.filter(o => o.assigned_facility_id === selectedFacilityId)
    : queue

  const toFacilityRuns  = pendingRuns.filter(r => r.run_type === "to_facility")
  const toWarehouseRuns = pendingRuns.filter(r => r.run_type === "to_warehouse")

  return (
    <PinGate role="operator">
    <div className="min-h-screen bg-[#0D2240]">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">
          🏭
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">{t("title")}</h1>
        <p className="text-white/50 text-sm">Laundry processing · Wash · Dry · Fold</p>
      </div>

      <div className="px-4 space-y-4 pb-10 max-w-sm mx-auto">

        {queueLoading && (
          <div className="text-center py-4">
            <p className="text-white/30 text-sm">{t("loading")}</p>
          </div>
        )}

        {/* ── Pending transport runs ──────────────────────────── */}
        {!queueLoading && toFacilityRuns.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
              🏭 {t("transport_to_facility")} ({toFacilityRuns.length})
            </p>
            <div className="space-y-2">
              {toFacilityRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => router.push(`/operator/run/${run.id}`)}
                  className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">
                        🏭 {run.facility_name ?? "Facility"} run
                      </p>
                      <p className="text-white/50 text-xs mt-0.5">
                        {run.order_ids.length} {run.order_ids.length !== 1 ? t("orders") : t("order_singular")} · {t("transport_to_facility")}
                      </p>
                      {run.notes && (
                        <p className="text-white/30 text-xs mt-0.5 truncate">{run.notes}</p>
                      )}
                    </div>
                    <span className="text-purple-300 font-bold text-xs shrink-0">{t("execute_arrow")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!queueLoading && toWarehouseRuns.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
              🏪 {t("transport_to_warehouse")} ({toWarehouseRuns.length})
            </p>
            <div className="space-y-2">
              {toWarehouseRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => router.push(`/operator/run/${run.id}`)}
                  className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">
                        🏪 {run.facility_name ?? "Facility"} → Warehouse
                      </p>
                      <p className="text-white/50 text-xs mt-0.5">
                        {run.order_ids.length} {run.order_ids.length !== 1 ? t("orders") : t("order_singular")} · {t("transport_to_warehouse")}
                      </p>
                      {run.notes && (
                        <p className="text-white/30 text-xs mt-0.5 truncate">{run.notes}</p>
                      )}
                    </div>
                    <span className="text-amber-300 font-bold text-xs shrink-0">{t("execute_arrow")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Facility filter */}
        {!queueLoading && facilities.length > 1 && (
          <div className="bg-white/8 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-sm shrink-0">🏭</span>
            <select
              value={selectedFacilityId}
              onChange={e => setSelectedFacilityId(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm font-semibold outline-none appearance-none cursor-pointer"
            >
              <option value="" className="bg-[#0D2240]">{t("all_facilities")}</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id} className="bg-[#0D2240]">{f.name}</option>
              ))}
            </select>
            <span className="text-white/40 text-xs shrink-0">▼</span>
          </div>
        )}

        {/* Work queue */}
        {!queueLoading && filteredQueue.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
              🏭 In Process ({filteredQueue.length})
            </p>
            <div className="space-y-2">
              {filteredQueue.map((o) => (
                <button
                  key={o.id}
                  onClick={() => router.push(`/operator/order/${o.id}`)}
                  className="w-full bg-white/10 hover:bg-white/15 rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[o.most_advanced_status] ?? "bg-gray-400"}`} />
                        <p className="text-white font-bold text-sm truncate">{o.customer_name}</p>
                      </div>
                      <p className="text-white/40 text-xs">
                        {o.service_type === "wash_fold" ? "Wash & Fold" : "Comforter"} ·{" "}
                        {o.bags_at_facility}/{o.bags_total} {t("bags")} ·{" "}
                        {STATUS_LABEL[o.most_advanced_status] ?? o.most_advanced_status}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-white/60 font-mono text-xs tracking-widest">{o.short_code ?? o.id.slice(0, 5).toUpperCase()}</span>
                      <p className="text-white/30 text-xs mt-0.5">Del: {o.delivery_date}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!queueLoading && filteredQueue.length === 0 && pendingRuns.length === 0 && (
          <div className="bg-white/5 rounded-2xl px-5 py-5 text-center">
            <p className="text-2xl mb-2">🧺</p>
            <p className="text-white/50 text-sm font-semibold">{t("nothing_today")}</p>
            <p className="text-white/30 text-xs mt-1 leading-relaxed">{t("nothing_sub")}</p>
          </div>
        )}

        {/* Manual lookup */}
        <div className="bg-white rounded-3xl p-5 shadow-2xl">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            {t("find_order")}
          </label>

          <input
            type="text" aria-hidden="true" tabIndex={-1}
            value={code} onChange={handleScannerInput} onKeyDown={handleScannerKey}
            className="sr-only" autoComplete="off" />

          <div className={`w-full rounded-2xl border-2 px-4 py-3 mb-1 text-center transition-colors ${error ? "border-red-300 bg-red-50" : code.length > 0 ? "border-[#E8726A]" : "border-gray-200"}`}>
            {code.length > 0 ? (
              <span className="text-3xl font-mono font-bold text-[#0D2240] tracking-[0.4em]">{code}</span>
            ) : (
              <span className="text-xl font-mono text-gray-300 tracking-widest">_ _ _ _ _ _</span>
            )}
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
            <button type="button"
              onClick={() => { setCode(""); setError("") }}
              className="h-14 rounded-2xl bg-gray-50 hover:bg-gray-100 active:bg-red-100 text-gray-400 font-bold text-sm transition-colors select-none">
              CLR
            </button>
            <button type="button"
              onClick={() => { if (code.length < 6) { setCode(c => c + "0"); setError("") } }}
              className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:bg-[#E8726A] active:text-white text-[#0D2240] font-extrabold text-2xl transition-colors select-none">
              0
            </button>
            <button type="button"
              onClick={() => { setCode(c => c.slice(0, -1)); setError("") }}
              className="h-14 rounded-2xl bg-gray-50 hover:bg-gray-100 active:bg-amber-100 text-gray-500 font-bold text-xl transition-colors select-none">
              ⌫
            </button>
          </div>

          <button
            onClick={lookup}
            disabled={lookupLoading || code.length < 4}
            className="w-full mt-3 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors">
            {lookupLoading ? t("looking_up") : t("find_order_btn")}
          </button>

        </div>

        <div className="text-center space-y-2">
          <div>
            <a href="/staff" className="text-white/40 text-xs hover:text-white/60 transition-colors font-semibold">{t("clock_link")}</a>
          </div>
          <div>
            <a href="/driver" className="text-white/20 text-xs hover:text-white/40 transition-colors">{t("switch_driver")}</a>
          </div>
        </div>
      </div>
    </div>
    </PinGate>
  )
}
