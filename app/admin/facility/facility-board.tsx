"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  moveOrderPhase, getFacilityBoardOrders, getPhaseHistory,
  type BoardOrder, type FacilitySummary, type PhaseTransition,
} from "@/app/actions/facility-board"
import { useWorkerSession } from "@/components/pin-gate"
import { PHASES } from "@/lib/facility-phases"

// ── Helpers ───────────────────────────────────────────────────────────────────

const SERVICE_ICON: Record<string, string> = {
  comforter_wash: "🛏️",
  wash_fold:      "👕",
  wash_only:      "🫧",
}
const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter Wash",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

function timeSince(iso: string | null): string {
  if (!iso) return ""
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function phaseAgeColor(iso: string | null): string {
  if (!iso) return "text-gray-400"
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000
  if (hrs < 2)  return "text-green-400"
  if (hrs < 6)  return "text-amber-400"
  return "text-red-400"
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

// ── Order Detail Drawer ───────────────────────────────────────────────────────

function OrderDrawer({
  order,
  onClose,
  onPhaseMove,
}: {
  order: BoardOrder
  onClose: () => void
  onPhaseMove: (orderId: string, toPhase: string) => void
}) {
  const worker = useWorkerSession()
  const [history, setHistory] = useState<PhaseTransition[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [moving, setMoving] = useState(false)

  const currentIndex = PHASES.findIndex(p => p.key === order.phase)
  const nextPhase    = currentIndex >= 0 && currentIndex < PHASES.length - 1 ? PHASES[currentIndex + 1] : null
  const currentPhase = PHASES[currentIndex]

  useEffect(() => {
    setLoadingHistory(true)
    getPhaseHistory(order.id).then(h => {
      setHistory(h)
      setLoadingHistory(false)
    })
  }, [order.id])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  async function handleAdvance() {
    if (!nextPhase) return
    setMoving(true)
    await onPhaseMove(order.id, nextPhase.key)
    setMoving(false)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0D2240] border-l border-white/10 z-50 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
              <span className="text-white font-extrabold text-lg tracking-wider">
                {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
              </span>
              {currentPhase && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: currentPhase.color + "88" }}
                >
                  {currentPhase.icon} {currentPhase.label}
                </span>
              )}
            </div>
            <p className="text-white/60 text-sm">{order.customer_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white text-xl leading-none mt-0.5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Key facts */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Service",    value: SERVICE_LABEL[order.service_type] ?? order.service_type },
              { label: "Bags",       value: `${order.num_bags} bag${order.num_bags !== 1 ? "s" : ""}` },
              { label: "Weight",     value: order.actual_weight_lbs ? `${order.actual_weight_lbs} lbs` : "⚠️ Not weighed" },
              { label: "In phase",   value: timeSince(order.phase_updated_at) || "—", color: phaseAgeColor(order.phase_updated_at) },
              { label: "Pickup",     value: order.pickup_date },
              { label: "Created",    value: order.created_at ? new Date(order.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—" },
            ].map(f => (
              <div key={f.label} className="bg-white/5 rounded-xl px-3 py-2.5">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-0.5">{f.label}</p>
                <p className={`text-sm font-semibold ${f.color ?? "text-white"}`}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Facility */}
          {order.assigned_facility_id && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2.5">
              <p className="text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-0.5">Facility</p>
              <p className="text-white text-sm font-semibold">Clean Laundry - Vine East</p>
            </div>
          )}

          {/* Advance phase */}
          {nextPhase ? (
            <button
              onClick={handleAdvance}
              disabled={moving}
              className="w-full flex items-center justify-center gap-2 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-sm py-3.5 rounded-xl transition-colors"
            >
              {moving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Moving…
                </span>
              ) : (
                <>Move to {nextPhase.icon} {nextPhase.label} →</>
              )}
            </button>
          ) : (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-center">
              <p className="text-green-400 font-bold text-sm">✅ Final phase — ready to close out</p>
            </div>
          )}

          {/* Full order link */}
          <a
            href={`/admin/orders/${order.id}`}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            Open Full Order Detail ↗
          </a>

          {/* Phase history timeline */}
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">Phase History</p>
            {loadingHistory ? (
              <p className="text-white/30 text-xs text-center py-4">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-4">No transitions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-[#E8726A] mt-1.5 shrink-0" />
                      {i < history.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1" style={{minHeight:16}} />}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-white text-xs font-semibold">
                        {t.from_phase ? `${t.from_phase.replace(/_/g," ")} → ` : ""}{t.to_phase.replace(/_/g," ")}
                      </p>
                      <p className="text-white/30 text-[10px] mt-0.5">
                        {formatDateTime(t.created_at)}
                        {t.worker_name && ` · ${t.worker_name}`}
                        {t.source && ` · ${t.source.replace(/_/g," ")}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}

// ── Board ─────────────────────────────────────────────────────────────────────

interface Phase {
  key: string
  label: string
  icon: string
  color: string
}

interface Props {
  initialGrouped: Record<string, BoardOrder[]>
  facilities: FacilitySummary[]
  selectedFacilityId: string | null
  phases: readonly Phase[]
}

export function FacilityBoard({ initialGrouped, facilities, selectedFacilityId, phases }: Props) {
  const router  = useRouter()
  const worker  = useWorkerSession()

  const [grouped, setGrouped]         = useState(initialGrouped)
  const [search, setSearch]           = useState("")
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [dragging, setDragging]       = useState<{ order: BoardOrder; fromPhase: string } | null>(null)
  const [dragOver, setDragOver]       = useState<string | null>(null)
  const [moving, setMoving]           = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<BoardOrder | null>(null)
  const isDraggingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Search ────────────────────────────────────────────────────────────────
  function handleSearch(q: string) {
    setSearch(q)
    if (!q.trim()) { setHighlighted(null); return }
    const lower = q.toLowerCase()
    for (const orders of Object.values(grouped)) {
      const match = orders.find(o =>
        o.short_code?.toLowerCase().includes(lower) ||
        o.customer_name.toLowerCase().includes(lower)
      )
      if (match) { setHighlighted(match.id); return }
    }
    setHighlighted(null)
  }

  // ── Phase move (used by drag-drop AND drawer advance button) ──────────────
  const handlePhaseMove = useCallback(async (orderId: string, toPhase: string) => {
    // Find the order and its current phase
    let order: BoardOrder | undefined
    let fromPhase = ""
    for (const [ph, orders] of Object.entries(grouped)) {
      const found = orders.find(o => o.id === orderId)
      if (found) { order = found; fromPhase = ph; break }
    }
    if (!order || fromPhase === toPhase) return

    setMoving(orderId)

    // Optimistic update
    setGrouped(prev => {
      const next = { ...prev }
      next[fromPhase] = prev[fromPhase].filter(o => o.id !== orderId)
      next[toPhase]   = [{ ...order!, phase: toPhase, phase_updated_at: new Date().toISOString() }, ...prev[toPhase]]
      return next
    })

    const result = await moveOrderPhase(
      orderId, toPhase,
      worker?.workerId ?? null,
      worker?.workerName ?? null
    )

    if (result.error) {
      setGrouped(prev => {
        const next = { ...prev }
        next[toPhase]   = prev[toPhase].filter(o => o.id !== orderId)
        next[fromPhase] = [order!, ...prev[fromPhase]]
        return next
      })
    }
    setMoving(null)
  }, [grouped, worker])

  // ── Drag and drop ─────────────────────────────────────────────────────────
  function onDragStart(order: BoardOrder, fromPhase: string) {
    isDraggingRef.current = true
    setDragging({ order, fromPhase })
  }

  function onDragOver(e: React.DragEvent, toPhase: string) {
    e.preventDefault()
    setDragOver(toPhase)
  }

  function onDragLeave() { setDragOver(null) }

  async function onDrop(e: React.DragEvent, toPhase: string) {
    e.preventDefault()
    setDragOver(null)
    if (!dragging || dragging.fromPhase === toPhase) { setDragging(null); return }
    const { order, fromPhase } = dragging
    setDragging(null)
    await handlePhaseMove(order.id, toPhase)
    // small delay before re-enabling click
    setTimeout(() => { isDraggingRef.current = false }, 100)
  }

  function onDragEnd() {
    setDragging(null)
    setTimeout(() => { isDraggingRef.current = false }, 100)
  }

  // ── Bubble click — open drawer ────────────────────────────────────────────
  function handleBubbleClick(order: BoardOrder) {
    if (isDraggingRef.current) return
    setSelectedOrder(order)
  }

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const fresh = await getFacilityBoardOrders(selectedFacilityId ?? undefined)
    setGrouped(fresh)
  }, [selectedFacilityId])

  // ── Facility filter ───────────────────────────────────────────────────────
  function selectFacility(id: string | null) {
    router.push(id ? `/admin/facility?facility=${id}` : "/admin/facility")
  }

  const totalOrders = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-[#0D2240] border-b border-white/10 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-white font-extrabold text-base">🏭 Facility Board</span>
          <span className="text-white/40 text-xs font-semibold">{totalOrders} orders</span>
        </div>

        {facilities.length > 1 && (
          <select
            value={selectedFacilityId ?? ""}
            onChange={e => selectFacility(e.target.value || null)}
            className="bg-white/10 text-white text-xs font-bold border border-white/20 rounded-lg px-3 py-1.5 focus:outline-none"
          >
            <option value="">All Facilities</option>
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}

        <div className="relative flex-1 max-w-xs">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search order or customer…"
            className="w-full bg-white/10 text-white placeholder:text-white/30 text-xs border border-white/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#E8726A]/60"
          />
          {search && (
            <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-sm">×</button>
          )}
        </div>

        <button
          onClick={refresh}
          className="text-white/40 hover:text-white text-xs font-bold transition-colors ml-auto"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Kanban columns ── */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 p-4 min-w-max h-full">
          {phases.map(phase => {
            const orders    = grouped[phase.key] ?? []
            const isOver    = dragOver === phase.key
            const isDragSrc = dragging?.fromPhase === phase.key

            return (
              <div
                key={phase.key}
                onDragOver={e => onDragOver(e, phase.key)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, phase.key)}
                className={`flex flex-col w-52 rounded-2xl transition-all duration-150 ${
                  isOver ? "ring-2 ring-[#E8726A] bg-white/10" : "bg-white/5"
                }`}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
                  <span className="text-base">{phase.icon}</span>
                  <span className="text-white font-bold text-xs uppercase tracking-wide flex-1">{phase.label}</span>
                  <span
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: phase.color + "66" }}
                  >
                    {orders.length}
                  </span>
                </div>

                {/* Bubbles */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-10rem)]">
                  {orders.length === 0 && (
                    <div className={`text-center text-white/20 text-xs py-6 rounded-xl border-2 border-dashed transition-colors ${isOver ? "border-[#E8726A]/40" : "border-white/10"}`}>
                      Drop here
                    </div>
                  )}
                  {orders.map(order => {
                    const isMatch  = highlighted === order.id
                    const isMoving = moving === order.id
                    const dim      = highlighted && !isMatch

                    return (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={() => onDragStart(order, phase.key)}
                        onDragEnd={onDragEnd}
                        onClick={() => handleBubbleClick(order)}
                        className={`
                          relative rounded-xl p-3 cursor-pointer select-none
                          border transition-all duration-200
                          ${isMoving ? "opacity-40 scale-95" : ""}
                          ${dim ? "opacity-20" : ""}
                          ${isMatch ? "ring-2 ring-[#E8726A] shadow-lg shadow-[#E8726A]/20 scale-105" : ""}
                          ${isDragSrc && dragging?.order.id === order.id ? "opacity-50" : ""}
                          bg-white/10 border-white/10 hover:border-white/30 hover:bg-white/15 hover:scale-[1.02]
                        `}
                      >
                        {/* Service + code */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
                          <span className="text-white font-extrabold text-xs tracking-wider flex-1">
                            {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
                          </span>
                          {/* Unweighed warning dot */}
                          {!order.actual_weight_lbs && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Not weighed" />
                          )}
                        </div>

                        {/* Customer name */}
                        <p className="text-white/70 text-[11px] leading-tight truncate">{order.customer_name}</p>

                        {/* Bags + weight + time */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-white/50 text-[10px]">
                            {order.num_bags} bag{order.num_bags !== 1 ? "s" : ""}
                          </span>
                          {order.actual_weight_lbs ? (
                            <span className="text-white/50 text-[10px]">· {order.actual_weight_lbs} lbs</span>
                          ) : (
                            <span className="text-amber-400/70 text-[10px]">· no weight</span>
                          )}
                          <span className={`text-[10px] ml-auto font-semibold ${phaseAgeColor(order.phase_updated_at)}`}>
                            {timeSince(order.phase_updated_at)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Order detail drawer ── */}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onPhaseMove={async (id, phase) => {
            await handlePhaseMove(id, phase)
            // Update the selected order's phase so drawer reflects the move
            setSelectedOrder(prev => prev ? { ...prev, phase, phase_updated_at: new Date().toISOString() } : null)
          }}
        />
      )}

      <style>{`[draggable] { -webkit-user-drag: element; }`}</style>
    </div>
  )
}
