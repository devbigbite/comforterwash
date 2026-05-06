"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PinGate } from "@/components/pin-gate"

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
}

const STATUS_LABEL: Record<string, string> = {
  at_facility: "At Facility",
  in_washer:   "In Washer",
  in_dryer:    "In Dryer",
  folded:      "Folded",
  ready:       "Ready",
}

const STATUS_DOT: Record<string, string> = {
  at_facility: "bg-purple-400",
  in_washer:   "bg-cyan-400",
  in_dryer:    "bg-orange-400",
  folded:      "bg-yellow-400",
  ready:       "bg-green-400",
}

export default function OperatorHome() {
  const [code, setCode] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [error, setError] = useState("")
  const [queue, setQueue] = useState<WorkOrder[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadQueue() {
      const supabase = createClient()

      // Get all bookings with bags currently in the operator's zone
      const { data: bags } = await supabase
        .from("order_bags")
        .select("booking_id, status")
        .in("status", ["at_facility", "in_washer", "in_dryer", "folded"])

      if (!bags?.length) { setQueueLoading(false); return }

      const bookingIds = [...new Set(bags.map(b => b.booking_id))]

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, short_code, customer_name, service_type, delivery_date, status, num_bags, facility_processing_mode")
        .in("id", bookingIds)
        .not("facility_processing_mode", "eq", "partner_attendant") // partner portal handles those
        .order("delivery_date")

      if (!bookings) { setQueueLoading(false); return }

      // Enrich with bag status info
      const STATUS_ORDER = ["at_facility", "in_washer", "in_dryer", "folded", "ready"]
      const enriched: WorkOrder[] = bookings.map(b => {
        const orderBags = bags.filter(bag => bag.booking_id === b.id)
        const statuses = orderBags.map(bag => bag.status)
        const mostAdvanced = [...statuses].sort((a, z) => STATUS_ORDER.indexOf(z) - STATUS_ORDER.indexOf(a))[0]
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
        }
      })

      setQueue(enriched)
      setQueueLoading(false)
    }
    loadQueue()
  }, [])

  async function lookup() {
    const cleaned = code.trim().replace(/\D/g, "") // digits only
    if (cleaned.length < 4) { setError("Enter at least 4 digits"); return }
    setLookupLoading(true)
    setError("")
    const supabase = createClient()
    // Exact 6-digit match
    const { data: byCode } = await supabase
      .from("bookings")
      .select("id")
      .eq("short_code", cleaned)
      .maybeSingle()
    if (byCode) { router.push(`/operator/order/${byCode.id}`); return }
    // Fallback prefix match for legacy orders
    const { data: byId } = await supabase
      .from("bookings")
      .select("id")
      .ilike("id", `${cleaned}%`)
      .limit(1)
      .maybeSingle()
    setLookupLoading(false)
    if (!byId) { setError("Order not found. Check the number on the bag label."); return }
    router.push(`/operator/order/${byId.id}`)
  }

  // Hidden input captures barcode scanner keystrokes (scanners type fast then send Enter)
  function handleScannerInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    setError("")
  }
  function handleScannerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && code.length >= 4) lookup()
  }

  return (
    <PinGate role="operator">
    <div className="min-h-screen bg-[#0D2240]">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">
          🏭
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Operator Station</h1>
        <p className="text-white/50 text-sm">Laundry processing · Wash · Dry · Fold</p>
      </div>

      {/* Capability description */}
      <div className="px-4 pb-4 max-w-sm mx-auto">
        <div className="bg-white/8 rounded-2xl px-5 py-4 space-y-3">
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest">What you can do here</p>
          <div className="space-y-2.5">
            {[
              { icon: "⚖️", text: "Enter actual bag weight — triggers final billing and captures pre-authorization" },
              { icon: "🧺", text: "Track each bag through Washer → Dryer → Folded → Ready stages" },
              { icon: "📋", text: "View all orders currently in process at this facility" },
              { icon: "✅", text: "Mark orders ready for driver pickup when all bags are folded" },
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

        {/* Work queue */}
        {queueLoading && (
          <div className="text-center py-4">
            <p className="text-white/30 text-sm">Loading queue…</p>
          </div>
        )}

        {!queueLoading && queue.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
              🏭 In Process ({queue.length})
            </p>
            <div className="space-y-2">
              {queue.map((o) => (
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
                        {o.bags_at_facility}/{o.bags_total} bags ·{" "}
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

        {!queueLoading && queue.length === 0 && (
          <div className="bg-white/5 rounded-2xl px-5 py-5 text-center">
            <p className="text-2xl mb-2">🧺</p>
            <p className="text-white/50 text-sm font-semibold">No bags at the facility right now.</p>
            <p className="text-white/30 text-xs mt-1 leading-relaxed">
              When a driver checks in bags, they&apos;ll appear here ready to process.<br />
              Use the lookup below to find a specific order by its bag label code.
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
            disabled={lookupLoading || code.length < 4}
            className="w-full mt-3 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors">
            {lookupLoading ? "Looking up…" : "Find Order →"}
          </button>

          <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <span className="text-sm mt-0.5">📷</span>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <strong className="text-gray-500">Using a barcode scanner?</strong> It will auto-fill the number and submit.
            </p>
          </div>
        </div>

        <div className="text-center">
          <a href="/driver" className="text-white/20 text-xs hover:text-white/40 transition-colors">Switch to Driver view</a>
        </div>
      </div>
    </div>
    </PinGate>
  )
}
