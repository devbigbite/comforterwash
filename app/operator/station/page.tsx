"use client"

import { useState, useEffect, useCallback } from "react"
import { PinGate } from "@/components/pin-gate"
import {
  getUnprintedOrders, markReceiptsPrinted, getPrintedOrders,
  type UnprintedOrder, type PrintedOrder,
} from "@/app/actions/operator-queue"

/**
 * Shared "print station" screen — meant to stay open indefinitely on a
 * dedicated packing-table PC connected to the thermal receipt printer.
 * Log in once as Owner on this browser (bypasses per-operator order
 * assignment so any operator's finished order shows up here), then leave
 * this tab open. Lists every order that's Ready with its Floor/Storage
 * decision made but not yet printed — tap Print, it opens the receipts
 * (one per packed bag) and fires the print dialog automatically. A second
 * tab shows recently-printed orders in case any need a reprint.
 */
function StationInner() {
  const [tab, setTab] = useState<"unprinted" | "printed">("unprinted")
  const [orders, setOrders] = useState<UnprintedOrder[]>([])
  const [printed, setPrinted] = useState<PrintedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [printingId, setPrintingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [unprintedData, printedData] = await Promise.all([getUnprintedOrders(), getPrintedOrders()])
    setOrders(unprintedData)
    setPrinted(printedData)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000) // pick up newly-finished orders automatically
    return () => clearInterval(interval)
  }, [refresh])

  async function handlePrint(order: UnprintedOrder) {
    setPrintingId(order.id)
    window.open(`/operator/order/${order.id}/labels?autoprint=1`, "_blank")
    await markReceiptsPrinted(order.id)
    setPrintingId(null)
    refresh()
  }

  function handleReprint(order: PrintedOrder) {
    window.open(`/operator/order/${order.id}/labels?autoprint=1`, "_blank")
    // Intentionally does NOT call markReceiptsPrinted again — receipts_printed_at
    // stays as the original print time, this is just a history-backed reprint.
  }

  function timeAgo(iso: string) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="bg-[#0D2240] px-5 py-5 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between mb-4">
          <div>
            <p className="text-[#E8726A] text-[11px] font-bold uppercase tracking-widest">Print Station</p>
            <h1 className="text-white font-extrabold text-xl">
              {tab === "unprinted" ? "Unprinted Receipts" : "Reprint"}
            </h1>
          </div>
          <span className="text-white/50 text-sm font-bold">
            {tab === "unprinted" ? `${orders.length} waiting` : `${printed.length} recent`}
          </span>
        </div>
        <div className="max-w-lg mx-auto flex gap-2">
          <button
            onClick={() => setTab("unprinted")}
            className={`flex-1 text-sm font-bold py-2 rounded-full transition-colors ${tab === "unprinted" ? "bg-[#E8726A] text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
          >
            🖨️ To Print {orders.length > 0 && `(${orders.length})`}
          </button>
          <button
            onClick={() => setTab("printed")}
            className={`flex-1 text-sm font-bold py-2 rounded-full transition-colors ${tab === "printed" ? "bg-[#E8726A] text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
          >
            🔁 Already Printed
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {loading && (
          <p className="text-center text-gray-400 text-base py-10">Loading…</p>
        )}

        {/* ── To print ── */}
        {!loading && tab === "unprinted" && orders.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-[#0D2240] font-bold text-lg">All caught up</p>
            <p className="text-gray-400 text-base mt-1">No finished orders waiting on receipts. This list updates automatically.</p>
          </div>
        )}

        {!loading && tab === "unprinted" && orders.map(order => (
          <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono font-extrabold text-2xl text-[#0D2240] tracking-wide">
                {(order.short_code ?? order.id.slice(0, 8)).toUpperCase()}
              </p>
              <p className="text-gray-400 text-sm mt-0.5">
                {order.bag_count} bag{order.bag_count !== 1 ? "s" : ""} ·{" "}
                {order.hold_at_facility ? "📍 Floor" : "📦 Storage"}
              </p>
            </div>
            <button
              onClick={() => handlePrint(order)}
              disabled={printingId === order.id}
              className="shrink-0 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-50 text-white font-extrabold text-base px-6 py-3.5 rounded-xl transition-colors"
            >
              {printingId === order.id ? "Opening…" : "🖨️ Print"}
            </button>
          </div>
        ))}

        {/* ── Already printed / reprint ── */}
        {!loading && tab === "printed" && printed.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-4xl mb-3">🗂️</p>
            <p className="text-[#0D2240] font-bold text-lg">Nothing printed yet</p>
            <p className="text-gray-400 text-base mt-1">Orders show up here once their receipts have been printed.</p>
          </div>
        )}

        {!loading && tab === "printed" && printed.map(order => (
          <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono font-extrabold text-2xl text-[#0D2240] tracking-wide">
                {(order.short_code ?? order.id.slice(0, 8)).toUpperCase()}
              </p>
              <p className="text-gray-400 text-sm mt-0.5">
                {order.bag_count} bag{order.bag_count !== 1 ? "s" : ""} · Printed {timeAgo(order.receipts_printed_at)}
              </p>
            </div>
            <button
              onClick={() => handleReprint(order)}
              className="shrink-0 bg-white border-2 border-[#0D2240] text-[#0D2240] hover:bg-[#0D2240] hover:text-white font-extrabold text-base px-5 py-3.5 rounded-xl transition-colors"
            >
              🔁 Reprint
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StationPage() {
  return (
    <PinGate role="operator">
      <StationInner />
    </PinGate>
  )
}
