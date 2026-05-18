"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWorkerSession } from "@/components/pin-gate"
import {
  startTransferSession,
  getActiveSession,
  getOrdersForSession,
  startTrip,
  certifyTripLoaded,
  certifyTripUnloaded,
  completeSession,
  getActiveTrip,
  type TransferSession,
  type TransferTrip,
  type TripOrder,
} from "@/app/actions/transfer-sessions"
import { getActiveFacilities, type FacilitySummary } from "@/app/actions/facility-board"

// ── Direction config ──────────────────────────────────────────────────────────
const DIRECTIONS = [
  { key: "storage_to_facility",  label: "Storage → Facility",  icon: "📦➡️🏭", desc: "Bring unprocessed orders from storage to the facility" },
  { key: "facility_to_storage",  label: "Facility → Storage",  icon: "🏭➡️📦", desc: "Move completed orders back to storage for delivery routes" },
  { key: "customer_to_facility", label: "Customer → Facility", icon: "🏠➡️🏭", desc: "Just picked up from customer — dropping directly at facility, skipping storage" },
] as const

type Direction = typeof DIRECTIONS[number]["key"]

const SERVICE_ICON: Record<string, string> = {
  comforter_wash: "🛏️",
  wash_fold:      "👕",
  wash_only:      "🫧",
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TransferPage() {
  const router = useRouter()
  const worker = useWorkerSession()

  const [facilities, setFacilities]   = useState<FacilitySummary[]>([])
  const [session, setSession]         = useState<TransferSession | null>(null)
  const [activeTrip, setActiveTrip]   = useState<(TransferTrip & { orders: TripOrder[] }) | null>(null)
  const [step, setStep]               = useState<"direction" | "orders" | "loading" | "transit" | "unloading" | "weighing" | "done">("direction")
  const [direction, setDirection]     = useState<Direction>("storage_to_facility")
  const [facilityId, setFacilityId]   = useState<string | null>(null)
  const [availableOrders, setAvailableOrders] = useState<{ id: string; short_code: string | null; customer_name: string; service_type: string; num_bags: number; phase: string; actual_weight_lbs: number | null }[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bagCount, setBagCount]       = useState(0)
  const [expectedBags, setExpectedBags] = useState(0)
  const [busy, setBusy]               = useState(false)
  const [loading, setLoading]         = useState(true)

  // Bag weights state: { [bookingId]: number[] }
  const [bagWeights, setBagWeights]   = useState<Record<string, number[]>>({})

  useEffect(() => {
    async function init() {
      const [facs] = await Promise.all([getActiveFacilities()])
      setFacilities(facs)
      if (facs.length === 1) setFacilityId(facs[0].id)

      if (worker?.workerId) {
        const sess = await getActiveSession(worker.workerId)
        if (sess) {
          setSession(sess)
          setDirection(sess.direction as Direction)
          setFacilityId(sess.facility_id)
          const trip = await getActiveTrip(sess.id)
          if (trip) {
            setActiveTrip(trip)
            setExpectedBags(trip.bags_expected)
            if (trip.status === "loading") setStep("loading")
            else if (trip.status === "in_transit") setStep("transit")
            else if (trip.status === "unloading") setStep("unloading")
          } else {
            await loadAvailableOrders(sess.id, sess.direction, sess.facility_id)
            setStep("orders")
          }
        }
      }
      setLoading(false)
    }
    init()
  }, [worker?.workerId])

  async function loadAvailableOrders(sessId: string, dir: string, facId: string | null) {
    const orders = await getOrdersForSession(sessId, dir, facId)
    setAvailableOrders(orders)
    setSelectedIds(new Set())
  }

  // ── Start session ──────────────────────────────────────────────────────────
  async function handleStartSession() {
    if (!worker?.workerId) return
    setBusy(true)
    const { session: sess, error } = await startTransferSession(worker.workerId, direction, facilityId)
    if (error || !sess) { setBusy(false); return }
    setSession(sess)
    await loadAvailableOrders(sess.id, direction, facilityId)
    setStep("orders")
    setBusy(false)
  }

  // ── Toggle order selection ─────────────────────────────────────────────────
  function toggleOrder(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedOrders = availableOrders.filter(o => selectedIds.has(o.id))
  const selectedBagTotal = selectedOrders.reduce((s, o) => s + o.num_bags, 0)

  // ── Start trip (load this batch) ───────────────────────────────────────────
  async function handleStartTrip() {
    if (!session || selectedIds.size === 0) return
    setBusy(true)
    const { trip, error } = await startTrip(session.id, [...selectedIds], direction)
    if (error || !trip) { setBusy(false); return }
    const full = await getActiveTrip(session.id)
    setActiveTrip(full)
    setExpectedBags(selectedBagTotal)
    setBagCount(0)
    setStep("loading")
    setBusy(false)
  }

  // ── Certify load count ─────────────────────────────────────────────────────
  async function handleCertifyLoaded() {
    if (!activeTrip) return
    setBusy(true)
    const { flagged } = await certifyTripLoaded(activeTrip.id, bagCount)
    const fresh = await getActiveTrip(session!.id)
    setActiveTrip(fresh)
    setStep(flagged ? "transit" : "transit") // proceed either way, flag is noted
    setBusy(false)
  }

  // ── Certify unload ─────────────────────────────────────────────────────────
  async function handleCertifyUnloaded() {
    if (!activeTrip || !session) return

    const needsWeighing = activeTrip.orders.some(o => o.needs_weighing)
    if (needsWeighing) {
      // Init weight arrays
      const init: Record<string, number[]> = {}
      activeTrip.orders.filter(o => o.needs_weighing).forEach(o => {
        init[o.booking_id] = Array(o.bags_expected).fill(0)
      })
      setBagWeights(init)
      setStep("weighing")
      return
    }

    await submitUnload([])
  }

  async function submitUnload(weights: { bookingId: string; weights: number[] }[]) {
    if (!activeTrip || !session) return
    setBusy(true)
    await certifyTripUnloaded({
      tripId:      activeTrip.id,
      sessionId:   session.id,
      bagsUnloaded: bagCount,
      direction,
      bagWeights:  weights.length > 0 ? weights : undefined,
      workerId:    worker?.workerId ?? null,
      workerName:  worker?.workerName ?? null,
    })

    // Check if more orders to move
    const remaining = await getOrdersForSession(session.id, direction, facilityId)
    if (remaining.length > 0) {
      setAvailableOrders(remaining)
      setSelectedIds(new Set())
      setBagCount(0)
      setActiveTrip(null)
      setStep("orders")
    } else {
      await completeSession(session.id)
      setStep("done")
    }
    setBusy(false)
  }

  // ── Bag count controls ─────────────────────────────────────────────────────
  function addBags(n: number) {
    setBagCount(prev => Math.max(0, prev + n))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D2240] flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: Choose direction
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "direction") {
    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
        <button onClick={() => router.back()} className="text-white/40 text-sm mb-8 self-start">← Back</button>
        <h1 className="text-white font-extrabold text-2xl mb-2">Internal Transfer</h1>
        <p className="text-white/40 text-sm mb-8 text-center">Move orders between storage and facility</p>

        <div className="w-full max-w-sm space-y-3 mb-6">
          {DIRECTIONS.map(d => (
            <button
              key={d.key}
              onClick={() => setDirection(d.key)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                direction === d.key
                  ? "border-[#E8726A] bg-[#E8726A]/10"
                  : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">{d.icon}</span>
                <span className="text-white font-extrabold text-sm">{d.label}</span>
              </div>
              <p className="text-white/40 text-xs leading-snug">{d.desc}</p>
            </button>
          ))}
        </div>

        {facilities.length > 1 && (
          <div className="w-full max-w-sm mb-6">
            <label className="text-white/40 text-xs uppercase tracking-wide block mb-2">Facility</label>
            <select
              value={facilityId ?? ""}
              onChange={e => setFacilityId(e.target.value || null)}
              className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 focus:outline-none"
            >
              <option value="">Select facility…</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleStartSession}
          disabled={busy}
          className="w-full max-w-sm bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors"
        >
          {busy ? "Starting…" : "Start Session"}
        </button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: Select orders for this trip
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "orders") {
    const dirLabel = DIRECTIONS.find(d => d.key === direction)?.label ?? direction
    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-white/40 text-sm">← Back</button>
          <div>
            <h1 className="text-white font-extrabold text-lg">{dirLabel}</h1>
            <p className="text-white/40 text-xs">Trip {(session?.trip_count ?? 0) + 1} · Select orders for this load</p>
          </div>
        </div>

        {availableOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-5xl mb-4">✅</span>
            <p className="text-white font-bold text-xl mb-2">All orders moved!</p>
            <p className="text-white/40 text-sm mb-8">No more orders to transfer in this direction.</p>
            <button
              onClick={async () => { await completeSession(session!.id); setStep("done") }}
              className="bg-[#E8726A] text-white font-extrabold px-8 py-3 rounded-2xl"
            >
              Complete Session
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2 flex-1 overflow-y-auto mb-4">
              {availableOrders.map(order => {
                const selected = selectedIds.has(order.id)
                return (
                  <button
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      selected
                        ? "border-[#E8726A] bg-[#E8726A]/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-extrabold text-sm">
                            {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
                          </span>
                          <span className="text-white/40 text-xs">{order.customer_name}</span>
                        </div>
                        <p className="text-white/40 text-xs mt-0.5">
                          {order.num_bags} bag{order.num_bags !== 1 ? "s" : ""}
                          {order.actual_weight_lbs ? ` · ${order.actual_weight_lbs} lbs` : " · needs weighing"}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-[#E8726A] bg-[#E8726A]" : "border-white/20"}`}>
                        {selected && <span className="text-white text-xs font-extrabold">✓</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedIds.size > 0 && (
              <div className="bg-white/10 rounded-2xl p-4 mb-4">
                <p className="text-white/60 text-xs mb-1">This trip</p>
                <p className="text-white font-extrabold text-lg">{selectedIds.size} orders · {selectedBagTotal} bags</p>
              </div>
            )}

            <button
              onClick={handleStartTrip}
              disabled={busy || selectedIds.size === 0}
              className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors"
            >
              {busy ? "Starting trip…" : `Load Trip — ${selectedBagTotal} bags`}
            </button>
          </>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: Count bags as loading into vehicle
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "loading") {
    const manifest = activeTrip?.orders ?? []
    const over     = bagCount > expectedBags
    const exact    = bagCount === expectedBags

    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Trip {activeTrip?.trip_number} · Loading</p>
            <h1 className="text-white font-extrabold text-2xl mb-1">Count bags as you load</h1>
            <p className="text-white/40 text-sm">Tap the amount you're putting in with each carry</p>
          </div>

          {/* Manifest reference */}
          <div className="bg-white/5 rounded-2xl p-4 mb-6 space-y-2">
            {manifest.map(o => (
              <div key={o.booking_id} className="flex items-center justify-between text-xs">
                <span className="text-white/60">{o.customer_name ?? o.short_code}</span>
                <span className="text-white font-bold">{o.bags_expected} bags</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 flex items-center justify-between text-sm font-extrabold">
              <span className="text-white/60">Expected total</span>
              <span className="text-white">{expectedBags} bags</span>
            </div>
          </div>

          {/* Big counter */}
          <div className={`text-center text-7xl font-extrabold mb-2 transition-colors ${over ? "text-red-400" : exact ? "text-green-400" : "text-white"}`}>
            {bagCount}
          </div>
          {over && <p className="text-red-400 text-center text-sm mb-4">⚠️ More bags than expected — recount</p>}
          {exact && <p className="text-green-400 text-center text-sm mb-4">✓ Count matches manifest</p>}

          {/* Quick-add buttons */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => addBags(n)}
                className="bg-white/10 hover:bg-white/20 text-white font-extrabold text-lg py-4 rounded-xl transition-colors active:scale-95"
              >
                +{n}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => addBags(-1)}
              disabled={bagCount === 0}
              className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              −1 Correct
            </button>
            <button
              onClick={() => setBagCount(0)}
              disabled={bagCount === 0}
              className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              Reset
            </button>
          </div>

          <button
            onClick={handleCertifyLoaded}
            disabled={busy || bagCount === 0}
            className={`w-full font-extrabold text-base py-4 rounded-2xl transition-colors ${
              exact
                ? "bg-green-600 hover:bg-green-700 text-white"
                : over
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-[#E8726A] hover:bg-[#d45f57] text-white disabled:opacity-40"
            }`}
          >
            {busy ? "Certifying…" : over ? "Flag & Proceed Anyway" : `Confirm — ${bagCount} bags loaded`}
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: In transit — heading to destination
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "transit") {
    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="text-7xl mb-6 animate-bounce">🚐</div>
          <h1 className="text-white font-extrabold text-2xl mb-2">In Transit</h1>
          <p className="text-white/40 text-sm mb-2">{activeTrip?.bags_loaded ?? bagCount} bags on board</p>
          <p className="text-white/40 text-sm mb-10">Drive safely. Tap when you arrive.</p>
          <button
            onClick={() => { setBagCount(0); setStep("unloading") }}
            className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold text-base px-10 py-4 rounded-2xl transition-colors"
          >
            Arrived — Start Unloading
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: Count bags as unloading
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "unloading") {
    const loaded  = activeTrip?.bags_loaded ?? expectedBags
    const over    = bagCount > loaded
    const exact   = bagCount === loaded

    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Trip {activeTrip?.trip_number} · Unloading</p>
            <h1 className="text-white font-extrabold text-2xl mb-1">Count bags as you unload</h1>
            <p className="text-white/40 text-sm">Loaded: <span className="text-white font-bold">{loaded}</span> bags</p>
          </div>

          <div className={`text-center text-7xl font-extrabold mb-2 transition-colors ${over ? "text-red-400" : exact ? "text-green-400" : "text-white"}`}>
            {bagCount}
          </div>
          {over && <p className="text-red-400 text-center text-sm mb-4">⚠️ More bags than loaded — recount</p>}
          {exact && <p className="text-green-400 text-center text-sm mb-4">✓ Count matches</p>}

          <div className="grid grid-cols-5 gap-2 mb-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => addBags(n)}
                className="bg-white/10 hover:bg-white/20 text-white font-extrabold text-lg py-4 rounded-xl transition-colors active:scale-95"
              >
                +{n}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-8">
            <button onClick={() => addBags(-1)} disabled={bagCount === 0}
              className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white font-bold py-3 rounded-xl text-sm">−1 Correct</button>
            <button onClick={() => setBagCount(0)} disabled={bagCount === 0}
              className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white font-bold py-3 rounded-xl text-sm">Reset</button>
          </div>

          <button
            onClick={handleCertifyUnloaded}
            disabled={busy || bagCount === 0}
            className={`w-full font-extrabold text-base py-4 rounded-2xl transition-colors ${
              exact ? "bg-green-600 hover:bg-green-700 text-white"
              : over ? "bg-red-500 text-white"
              : "bg-[#E8726A] hover:bg-[#d45f57] text-white disabled:opacity-40"
            }`}
          >
            {busy ? "Certifying…" : `Confirm — ${bagCount} bags unloaded`}
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: Enter bag weights (first drop-off)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "weighing") {
    const weighingOrders = (activeTrip?.orders ?? []).filter(o => o.needs_weighing)

    function setWeight(bookingId: string, bagIdx: number, val: string) {
      const num = parseFloat(val) || 0
      setBagWeights(prev => {
        const arr = [...(prev[bookingId] ?? [])]
        arr[bagIdx] = num
        return { ...prev, [bookingId]: arr }
      })
    }

    function orderTotal(bookingId: string) {
      return (bagWeights[bookingId] ?? []).reduce((s, w) => s + w, 0).toFixed(1)
    }

    const allWeighed = weighingOrders.every(o =>
      (bagWeights[o.booking_id] ?? []).every(w => w > 0)
    )

    async function handleSubmitWeights() {
      const weights = weighingOrders.map(o => ({
        bookingId: o.booking_id,
        weights:   bagWeights[o.booking_id] ?? [],
      }))
      await submitUnload(weights)
    }

    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col px-4 py-6">
        <div className="mb-6">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-1">First drop-off · Weighing</p>
          <h1 className="text-white font-extrabold text-xl mb-1">Enter bag weights</h1>
          <p className="text-white/40 text-sm">Place each bag on the scale and enter its weight</p>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto mb-6">
          {weighingOrders.map(order => (
            <div key={order.booking_id} className="bg-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{SERVICE_ICON[order.service_type ?? ""] ?? "📦"}</span>
                <div>
                  <p className="text-white font-extrabold text-sm">
                    {order.short_code?.toUpperCase() ?? order.booking_id.slice(0, 6).toUpperCase()}
                  </p>
                  <p className="text-white/40 text-xs">{order.customer_name} · {order.bags_expected} bags</p>
                </div>
              </div>

              <div className="space-y-2">
                {Array.from({ length: order.bags_expected }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-white/40 text-sm w-12">Bag {i + 1}</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        value={bagWeights[order.booking_id]?.[i] || ""}
                        onChange={e => setWeight(order.booking_id, i, e.target.value)}
                        className="w-full bg-white/10 text-white font-bold text-right border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E8726A] pr-14"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">lbs</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-white/40 text-xs">Order total</span>
                <span className="text-white font-extrabold">{orderTotal(order.booking_id)} lbs</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmitWeights}
          disabled={busy || !allWeighed}
          className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors"
        >
          {busy ? "Saving…" : "Confirm Weights & Certify Drop-off"}
        </button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: Done
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-7xl mb-6">🎉</div>
        <h1 className="text-white font-extrabold text-2xl mb-2">Session Complete</h1>
        <p className="text-white/40 text-sm mb-10">All orders have been moved and certified.</p>
        <button
          onClick={() => router.push("/driver")}
          className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold px-10 py-4 rounded-2xl transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return null
}
f57] text-white font-extrabold px-10 py-4 rounded-2xl transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return null
}
