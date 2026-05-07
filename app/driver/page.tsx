"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PinGate } from "@/components/pin-gate"
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

export default function DriverHome() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pickups, setPickups] = useState<RouteOrder[]>([])
  const [deliveries, setDeliveries] = useState<RouteOrder[]>([])
  const [pendingRuns, setPendingRuns] = useState<TransportRun[]>([])
  const [routeLoading, setRouteLoading] = useState(true)
  const router = useRouter()

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      const [
        { data: todayPickups },
        { data: todayDeliveries },
        runs,
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
          .eq("pickup_date", today)
          .in("status", ["confirmed", "pending"])
          .order("pickup_date"),
        supabase
          .from("bookings")
          .select("id, short_code, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
          .eq("delivery_date", today)
          .eq("status", "ready_at_warehouse")
          .order("delivery_date"),
        getPendingRunsForRole("driver"),
      ])

      setPickups(todayPickups ?? [])
      setDeliveries(todayDeliveries ?? [])
      setPendingRuns(runs)
      setRouteLoading(false)
    }
    loadData()
  }, [today])

  async function lookup() {
    const cleaned = code.trim().replace(/\D/g, "")
    if (cleaned.length < 4) { setError("Enter at least 4 digits"); return }
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { data: byCode } = await supabase
      .from("bookings")
      .select("id")
      .eq("short_code", cleaned)
      .maybeSingle()
    if (byCode) { router.push(`/driver/order/${byCode.id}`); return }
    const { data: byId } = await supabase
      .from("bookings")
      .select("id")
      .ilike("id", `${cleaned}%`)
      .limit(1)
      .maybeSingle()
    setLoading(false)
    if (!byId) { setError("Order not found. Check the number on the bag label."); return }
    router.push(`/driver/order/${byId.id}`)
  }

  function handleScannerInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    setError("")
  }
  function handleScannerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && code.length >= 4) lookup()
  }

  const toFacilityRuns  = pendingRuns.filter(r => r.run_type === "to_facility")
  const toWarehouseRuns = pendingRuns.filter(r => r.run_type === "to_warehouse")

  return (
    <PinGate role="driver">
    <div className="min-h-screen bg-[#0D2240]">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">
          🚐
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Driver Station</h1>
        <p className="text-white/50 text-sm">WashFold Orlando · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
      </div>

      <div className="px-4 space-y-4 pb-10 max-w-sm mx-auto">

        {routeLoading && (
          <div className="text-center py-4">
            <p className="text-white/30 text-sm">Loading…</p>
          </div>
        )}

        {/* ── Pending transport runs ──────────────────────────── */}
        {!routeLoading && toFacilityRuns.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
              🏭 Transport to Facility ({toFacilityRuns.length})
            </p>
            <div className="space-y-2">
              {toFacilityRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => router.push(`/driver/run/${run.id}`)}
                  className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">
                        🏭 {run.facility_name ?? "Facility"} run
                      </p>
                      <p className="text-white/50 text-xs mt-0.5">
                        {run.order_ids.length} order{run.order_ids.length !== 1 ? "s" : ""} · Warehouse → Facility
                      </p>
                      {run.notes && (
                        <p className="text-white/30 text-xs mt-0.5 truncate">{run.notes}</p>
                      )}
                    </div>
                    <span className="text-purple-300 font-bold text-xs shrink-0">EXECUTE →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!routeLoading && toWarehouseRuns.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
              🏪 Return to Warehouse ({toWarehouseRuns.length})
            </p>
            <div className="space-y-2">
              {toWarehouseRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => router.push(`/driver/run/${run.id}`)}
                  className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">
                        🏪 {run.facility_name ?? "Facility"} → Warehouse
                      </p>
                      <p className="text-white/50 text-xs mt-0.5">
                        {run.order_ids.length} order{run.order_ids.length !== 1 ? "s" : ""} · Facility → Warehouse
                      </p>
                      {run.notes && (
                        <p className="text-white/30 text-xs mt-0.5 truncate">{run.notes}</p>
                      )}
                    </div>
                    <span className="text-amber-300 font-bold text-xs shrink-0">EXECUTE →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Today's pickups ─────────────────────────────────── */}
        {!routeLoading && pickups.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">📦 Today&apos;s Pickups ({pickups.length})</p>
            <div className="space-y-2">
              {pickups.map((o) => (
                <button
                  key={o.id}
                  onClick={() => router.push(`/driver/order/${o.id}`)}
                  className="w-full bg-white/10 hover:bg-white/15 rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{o.customer_name}</p>
                      <p className="text-white/40 text-xs truncate mt-0.5">{o.customer_address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-white/60 font-mono text-xs tracking-widest">{o.short_code ?? o.id.slice(0, 5).toUpperCase()}</span>
                      <p className="text-white/30 text-xs mt-0.5">{o.num_bags} bag{o.num_bags !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Ready to deliver ────────────────────────────────── */}
        {!routeLoading && deliveries.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">🎉 Ready to Deliver ({deliveries.length})</p>
            <div className="space-y-2">
              {deliveries.map((o) => (
                <button
                  key={o.id}
                  onClick={() => router.push(`/driver/order/${o.id}`)}
                  className="w-full bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{o.customer_name}</p>
                      <p className="text-white/40 text-xs truncate mt-0.5">{o.customer_address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-white/60 font-mono text-xs tracking-widest">{o.short_code ?? o.id.slice(0, 5).toUpperCase()}</span>
                      <p className="text-green-400 text-xs font-bold mt-0.5">READY ✓</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!routeLoading && pickups.length === 0 && deliveries.length === 0 && pendingRuns.length === 0 && (
          <div className="bg-white/5 rounded-2xl px-5 py-5 text-center">
            <p className="text-2xl mb-2">🚐</p>
            <p className="text-white/50 text-sm font-semibold">Nothing assigned for today.</p>
            <p className="text-white/30 text-xs mt-1 leading-relaxed">
              Pickups, deliveries, and transport runs will appear here.<br />
              Use the lookup below to find any order by its bag label code.
            </p>
          </div>
        )}

        {/* Manual lookup */}
        <div className="bg-white rounded-3xl p-5 shadow-2xl">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Find an order
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

          <div className="grid grid-cols-3 gap-2 mt-3