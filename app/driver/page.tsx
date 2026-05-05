"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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
  const [routeLoading, setRouteLoading] = useState(true)
  const router = useRouter()

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    async function loadRoute() {
      const supabase = createClient()
      const [{ data: todayPickups }, { data: todayDeliveries }] = await Promise.all([
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
    const cleaned = code.trim().replace(/\D/g, "") // digits only
    if (cleaned.length < 4) { setError("Enter at least 4 digits"); return }
    setLoading(true)
    setError("")
    const supabase = createClient()
    // Exact 6-digit short code match
    const { data: byCode } = await supabase
      .from("bookings")
      .select("id")
      .eq("short_code", cleaned)
      .maybeSingle()
    if (byCode) { router.push(`/driver/order/${byCode.id}`); return }
    // Fallback prefix match for legacy orders
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

  // Hidden input captures barcode scanner keystrokes
  function handleScannerInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    setError("")
  }
  function handleScannerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && code.length >= 4) lookup()
  }

  return (
    <div className="min-h-screen bg-[#0D2240]">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">
          🚐
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Driver Station</h1>
        <p className="text-white/50 text-sm">WashFold Orlando · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
      </div>

      {/* Capability description */}
      <div className="px-4 pb-4 max-w-sm mx-auto">
        <div className="bg-white/8 rounded-2xl px-5 py-4 space-y-3">
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest">What you can do here</p>
          <div className="space-y-2.5">
            {[
              { icon: "📦", text: "View today's pickups — customers expecting you to collect their laundry bags" },
              { icon: "🏭", text: "Check bags in at the facility — scan or enter each bag's 6-digit code to log arrival" },
              { icon: "🎉", text: "See orders marked Ready — bags fully processed and waiting for delivery" },
              { icon: "✅", text: "Mark orders delivered once clean laundry is handed back to the customer" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{icon}</span>
                <p className="text-white/50 text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 pb-10 max-w-sm mx-auto">

        {/* Loading state */}
        {routeLoading && (
          <div className="text-center py-4">
            <p className="text-white/30 text-sm">Loading today&apos;s route…</p>
          </div>
        )}

        {/* Today's pickups */}
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
                      <span className="text-white/60 font-mono text-xs tracking-widest">{o.short_code ?? o.id.slice(0, 5).toUpperCase()}</span>
                      <p className="text-green-400 text-xs font-bold mt-0.5">READY ✓</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!routeLoading && pickups.length === 0 && deliveries.length === 0 && (
          <div className="bg-white/5 rounded-2xl px-5 py-5 text-center">
            <p className="text-2xl mb-2">🚐</p>
            <p className="text-white/50 text-sm font-semibold">No scheduled stops for today.</p>
            <p className="text-white/30 text-xs mt-1 leading-relaxed">
              Pickups and ready deliveries will appear here.<br />
              Use the lookup below to find any order by its bag label code.
            </p>
          </div>
        )}

        {/* Manual lookup — custom numeric keypad */}
        <div className="bg-white rounded-3xl p-5 shadow-2xl">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Find an order
          </label>

          {/* Hidden input — captures barcode scanner without showing system keyboard */}
          <input
            type="text" aria-hidden="true" tabIndex={-1}
            value={code} onChange={handleScannerInput} onKeyDown={handleScannerKey}
            className="sr-only" autoComplete="off" />

          {/* Display */}
          <div className={`w-full rounded-2xl border-2 px-4 py-3 mb-1 text-center transition-colors ${error ? "border-red-300 bg-red-50" : code.length > 0 ? "border-[#E8726A]" : "border-gray-200"}`}>
            {code.length > 0 ? (
              <span className="text-3xl font-mono font-bold text-[#0D2240] tracking-[0.4em]">{code}</span>
            ) : (
              <span className="text-xl font-mono text-gray-300 tracking-widest">_ _ _ _ _ _</span>
            )}
          </div>
          {error && <p className="text-sm text-red-500 font-medium mb-2 text-center">{error}</p>}

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {["1","2","3","4","5","6","7","8","9"].map(n => (
              <button key={n} type="button"
                onClick={() => { if (code.length < 6) { setCode(c => c + n); setError("") } }}
                className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:bg-[#E8726A] active:text-white text-[#0D2240] font-extrabold text-2xl transition-colors select-none">
                {n}
              </button>
            ))}
            {/* Bottom row: clear, 0, backspace */}
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
            disabled={loading || code.length < 4}
            className="w-full mt-3 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors">
            {loading ? "Looking up…" : "Find Order →"}
          </button>

          <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <span className="text-sm mt-0.5">📷</span>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <strong className="text-gray-500">Using a barcode scanner?</strong> It will auto-fill the number and submit.
            </p>
          </div>
        </div>

        <div className="text-center">
          <a href="/operator" className="text-white/20 text-xs hover:text-white/40 transition-colors">Switch to Operator view</a>
        </div>
      </div>
    </div>
  )
}
