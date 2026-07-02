"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PinGate, useWorkerT, useWorkerSession } from "@/components/pin-gate"
import { RoleSwitcher } from "@/components/role-switcher"
import { getPendingRunsForRole } from "@/app/actions/transport-runs"
import type { TransportRun } from "@/app/actions/transport-runs"

interface RouteOrder {
  id: string
  short_code: string | null
  customer_name: string
  customer_address: string
  pickup_date: string
  delivery_date: string
  status: string
  service_type: string
  num_bags: number
}

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter Wash",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

export default function DriverHome() {
  const t = useWorkerT("driver")
  const session = useWorkerSession()

  const [showKeypad, setShowKeypad]     = useState(false)
  const [code, setCode]                 = useState("")
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState("")
  const [pickups, setPickups]           = useState<RouteOrder[]>([])
  const [deliveries, setDeliveries]     = useState<RouteOrder[]>([])
  const [pendingRuns, setPendingRuns]   = useState<TransportRun[]>([])
  const [routeLoading, setRouteLoading] = useState(true)
  const router = useRouter()

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    if (!session) return  // wait for PinGate session
    async function loadData() {
      const supabase = createClient()
      const driverId = session.workerId
      const [
        { data: todayPickups },
        { data: todayDeliveries },
        runs,
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
          .eq("pickup_date", today)
          .in("status", ["confirmed", "picked_up"])
          .eq("assigned_driver_id", driverId)
          .order("pickup_date"),
        supabase
          .from("bookings")
          .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
          .eq("delivery_date", today)
          .in("status", ["ready", "ready_at_warehouse", "out_for_delivery"])
          .eq("assigned_driver_id", driverId)
          .order("delivery_date"),
        getPendingRunsForRole("driver"),
      ])
      setPickups(todayPickups ?? [])
      setDeliveries(todayDeliveries ?? [])
      setPendingRuns(runs)
      setRouteLoading(false)
    }
    loadData()
  }, [today, session])

  async function lookup() {
    const cleaned = code.trim().replace(/\D/g, "")
    if (cleaned.length < 4) { setError("Enter at least 4 digits"); return }
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { data: byCode } = await supabase
      .from("bookings").select("id").eq("short_code", cleaned).maybeSingle()
    if (byCode) { router.push(`/driver/order/${byCode.id}`); return }
    const { data: byId } = await supabase
      .from("bookings").select("id").ilike("id", `${cleaned}%`).limit(1).maybeSingle()
    setLoading(false)
    if (!byId) { setError("Order not found"); return }
    router.push(`/driver/order/${byId.id}`)
  }

  const toFacilityRuns  = pendingRuns.filter(r => r.run_type === "to_facility")
  const toWarehouseRuns = pendingRuns.filter(r => r.run_type === "to_warehouse")
  const totalTasks = pickups.length + deliveries.length + pendingRuns.length

  return (
    <PinGate role="driver">
    <div className="min-h-screen bg-[#0D2240]">

      {/* Header */}
      <div className="px-5 pt-8 pb-5 flex items-center justify-between">
        <div>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Driver Station</p>
          <h1 className="text-2xl font-extrabold text-white mt-0.5">
            {session?.workerName ? `Hi, ${session.workerName.split(" ")[0]} 👋` : "Your Route"}
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>
        <RoleSwitcher currentRole="driver" />
      </div>

      <div className="px-4 pb-10 max-w-lg mx-auto space-y-4">

        {routeLoading && (
          <div className="text-center py-12">
            <p className="text-white/30 text-sm animate-pulse">Loading your route…</p>
          </div>
        )}

        {!routeLoading && totalTasks === 0 && (
          <div className="bg-white/5 rounded-2xl p-8 text-center mt-4">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-white font-bold text-lg">No stops today</p>
            <p className="text-white/40 text-sm mt-1">Check back later or use the order lookup below.</p>
          </div>
        )}

        {/* ── PICKUPS ── */}
        {!routeLoading && pickups.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-lg">📦</span>
              <p className="text-white font-extrabold text-base">Pickups today</p>
              <span className="ml-auto bg-blue-500/30 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {pickups.length} stop{pickups.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {pickups.map((o, i) => (
                <button key={o.id} onClick={() => router.push(`/driver/order/${o.id}`)}
                  className="w-full bg-blue-500/15 border border-blue-500/25 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Stop number + action */}
                      <p className="text-blue-300 text-xs font-bold uppercase tracking-wide mb-1">
                        Stop {i + 1} · Pick up
                      </p>
                      {/* Address — most important */}
                      <p className="text-white font-bold text-base leading-tight">{o.customer_address}</p>
                      {/* Customer + details */}
                      <p className="text-white/60 text-sm mt-1">{o.customer_name}</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {SERVICE_LABEL[o.service_type] ?? o.service_type}
                        {o.num_bags > 0 && ` · ${o.num_bags} bag${o.num_bags !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="text-white/30 font-mono text-xs">
                        {o.short_code?.toUpperCase() ?? o.id.slice(0,5).toUpperCase()}
                      </span>
                      <span className="text-white/60 text-xl">→</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DELIVERIES ── */}
        {!routeLoading && deliveries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-lg">🚚</span>
              <p className="text-white font-extrabold text-base">Deliveries today</p>
              <span className="ml-auto bg-green-500/30 text-green-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {deliveries.length} stop{deliveries.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {deliveries.map((o, i) => (
                <button key={o.id} onClick={() => router.push(`/driver/order/${o.id}`)}
                  className="w-full bg-green-500/15 border border-green-500/25 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-green-300 text-xs font-bold uppercase tracking-wide mb-1">
                        Stop {i + 1} · Deliver
                      </p>
                      <p className="text-white font-bold text-base leading-tight">{o.customer_address}</p>
                      <p className="text-white/60 text-sm mt-1">{o.customer_name}</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {SERVICE_LABEL[o.service_type] ?? o.service_type}
                        {o.num_bags > 0 && ` · ${o.num_bags} bag${o.num_bags !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="text-white/30 font-mono text-xs">
                        {o.short_code?.toUpperCase() ?? o.id.slice(0,5).toUpperCase()}
                      </span>
                      <span className="text-white/60 text-xl">→</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── FACILITY RUNS ── */}
        {!routeLoading && toFacilityRuns.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-lg">🏭</span>
              <p className="text-white font-extrabold text-base">Facility drop-offs</p>
            </div>
            <div className="space-y-2">
              {toFacilityRuns.map(run => (
                <button key={run.id} onClick={() => router.push(`/driver/run/${run.id}`)}
                  className="w-full bg-purple-500/15 border border-purple-500/25 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-300 text-xs font-bold uppercase tracking-wide mb-1">Drop off at facility</p>
                      <p className="text-white font-bold">{run.facility_name ?? "Facility"}</p>
                      <p className="text-white/40 text-xs mt-0.5">{run.order_ids.length} orders</p>
                    </div>
                    <span className="text-white/60 text-xl">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!routeLoading && toWarehouseRuns.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-lg">🏪</span>
              <p className="text-white font-extrabold text-base">Warehouse returns</p>
            </div>
            <div className="space-y-2">
              {toWarehouseRuns.map(run => (
                <button key={run.id} onClick={() => router.push(`/driver/run/${run.id}`)}
                  className="w-full bg-amber-500/15 border border-amber-500/25 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-300 text-xs font-bold uppercase tracking-wide mb-1">Return to warehouse</p>
                      <p className="text-white font-bold">{run.facility_name ?? "Facility"} → Warehouse</p>
                      <p className="text-white/40 text-xs mt-0.5">{run.order_ids.length} orders</p>
                    </div>
                    <span className="text-white/60 text-xl">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Find by number (hidden by default) ── */}
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
              <button onClick={lookup} disabled={loading || code.length < 4}
                className="w-full mt-3 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors">
                {loading ? "Looking up…" : "Find Order →"}
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="text-center space-y-2 pt-2">
          <a href="/staff" className="block text-white/30 text-xs hover:text-white/50 transition-colors font-semibold">
            ⏱ Clock In / Out
          </a>
          <a href="/operator" className="block text-white/20 text-xs hover:text-white/40 transition-colors">
            Switch to Operator view
          </a>
        </div>

      </div>
    </div>
    </PinGate>
  )
}
