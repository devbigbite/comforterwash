"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface RouteOrder {
  id: string
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
  const [routeLoading, setRouteLoading] = useState(true)
  const router = useRouter()

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    async function loadRoute() {
      const supabase = createClient()
      const [{ data: todayPickups }, { data: todayDeliveries }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
          .eq("pickup_date", today)
          .in("status", ["confirmed", "pending"])
          .order("pickup_date"),
        supabase
          .from("bookings")
          .select("id, customer_name, customer_address, pickup_date, delivery_date, status, service_type, num_bags")
          .eq("delivery_date", today)
          .eq("status", "ready")
          .order("delivery_date"),
      ])
      setPickups(todayPickups ?? [])
      setDeliveries(todayDeliveries ?? [])
      setRouteLoading(false)
    }
    loadRoute()
  }, [today])

  async function lookup() {
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (cleaned.length < 6) { setError("Enter at least 6 characters"); return }
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .ilike("id", `${cleaned}%`)
      .limit(1)
      .maybeSingle()
    setLoading(false)
    if (!data) { setError("Order not found."); return }
    router.push(`/driver/order/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[#0D2240]">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">
          🚐
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Driver</h1>
        <p className="text-white/40 text-sm">WashFold Orlando · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
      </div>

      <div className="px-4 space-y-4 pb-10 max-w-sm mx-auto">

        {/* Today's pickups */}
        {!routeLoading && pickups.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">📦 Today's Pickups ({pickups.length})</p>
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
                      <span className="text-white/60 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</span>
                      <p className="text-white/30 text-xs mt-0.5">{o.num_bags} bag{o.num_bags !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Today's deliveries */}
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
                      <span className="text-white/60 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</span>
                      <p className="text-green-400 text-xs font-bold mt-0.5">READY ✓</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!routeLoading && pickups.length === 0 && deliveries.length === 0 && (
          <div className="text-center py-4">
            <p className="text-white/30 text-sm">No scheduled stops for today.</p>
          </div>
        )}

        {/* Manual lookup */}
        <div className="bg-white rounded-3xl p-5 shadow-2xl mt-4">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            Look up by order code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError("") }}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="e.g. 6618649D"
            className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-xl font-mono font-bold text-[#0D2240] text-center tracking-widest focus:outline-none focus:border-[#E8726A] transition-colors uppercase"
            autoComplete="off"
            autoCapitalize="characters"
          />
          {error && <p className="text-sm text-red-500 font-medium mt-2 text-center">{error}</p>}
          <button
            onClick={lookup}
            disabled={loading || code.length < 6}
            className="w-full mt-3 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-3.5 rounded-2xl transition-colors"
          >
            {loading ? "Looking up…" : "Find Order →"}
          </button>
        </div>

        <div className="text-center">
          <a href="/operator" className="text-white/20 text-xs hover:text-white/40 transition-colors">Switch to Operator view</a>
        </div>
      </div>
    </div>
  )
}
