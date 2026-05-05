"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface WorkOrder {
  id: string
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
        .select("id, customer_name, service_type, delivery_date, status, num_bags, facility_processing_mode")
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
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (cleaned.length < 6) { setError("Enter at least 6 characters"); return }
    setLookupLoading(true)
    setError("")
    const supabase = createClient()
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .ilike("id", `${cleaned}%`)
      .limit(1)
      .maybeSingle()
    setLookupLoading(false)
    if (!data) { setError("Order not found."); return }
    router.push(`/operator/order/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[#0D2240]">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">
          🏭
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Operator</h1>
        <p className="text-white/40 text-sm">Wash · Dry · Fold</p>
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
                      <span className="text-white/60 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</span>
                      <p className="text-white/30 text-xs mt-0.5">Del: {o.delivery_date}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!queueLoading && queue.length === 0 && (
          <div className="text-center py-4">
            <p className="text-white/30 text-sm">No bags at facility right now.</p>
            <p className="text-white/20 text-xs mt-1">Use the lookup below to find an order by code.</p>
          </div>
        )}

        {/* Manual lookup */}
        <div className="bg-white rounded-3xl p-5 shadow-2xl">
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
            disabled={lookupLoading || code.length < 6}
            className="w-full mt-3 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-3.5 rounded-2xl transition-colors"
          >
            {lookupLoading ? "Looking up…" : "Find Order →"}
          </button>
        </div>

        <div className="text-center">
          <a href="/driver" className="text-white/20 text-xs hover:text-white/40 transition-colors">Switch to Driver view</a>
        </div>
      </div>
    </div>
  )
}
