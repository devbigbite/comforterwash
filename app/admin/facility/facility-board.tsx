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
  if (hrs < 2)  return "text-emerald-500"
  if (hrs < 6)  return "text-amber-500"
  return "text-red-500"
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
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer — light theme */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white border-l border-gray-200 z-50 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0"
          style={{ borderTop: currentPhase ? `3px solid ${currentPhase.color}` : undefined }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
              <span className="text-[#0D2240] font-extrabold text-lg tracking-wider">
                {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
              </span>
              {currentPhase && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: currentPhase.color }}
                >
                  {currentPhase.icon} {currentPhase.label}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">{order.customer_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-600 text-xl leading-none mt-0.5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 bg-[#f8fafc]">

          {/* Key facts */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Service",  value: SERVICE_LABEL[order.service_type] ?? order.service_type },
              { label: "Bags",     value: `${order.num_bags} bag${order.num_bags !== 1 ? "s" : ""}` },
              { label: "Weight",   value: order.actual_weight_lbs ? `${order.actual_weight_lbs} lbs` : "⚠️ Not weighed" },
              { label: "In phase", value: timeSince(order.phase_updated_at) || "—", color: phaseAgeColor(order.phase_updated_at) },
              { label: "Pickup",   value: order.pickup_date },
              { label: "Created",  value: order.created_at ? new Date(order.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—" },
            ].map(f => (
              <div key={f.label} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-sm">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">{f.label}</p>
                <p className={`text-sm font-semibold ${f.color ?? "text-[#0D2240]"}`}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Facility */}
          {order.assigned_facility_id && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
              <p className="text-purple-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Facility</p>
              <p className="text-[#0D2240] text-sm font-semibold">Clean Laundry - Vine East</p>
            </div>
          )}

          {/* Advance phase */}
          {nextPhase ? (
            <button
              onClick={handleAdvance}
              disabled={moving}
              className="w-full flex items-center justify-center gap-2 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-sm py-3.5 rounded-xl transition-colors shadow-sm"
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
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
              <p className="text-emerald-600 font-bold text-sm">✅ Final phase — ready to close out</p>
            </div>
          )}

          {/* Full order link */}
          <a
            href={`/admin/orders/${order.id}`}
            className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-[#0D2240] hover:text-[#E8726A] font-semibold text-sm py-3 rounded-xl transition-colors shadow-sm"
          >
            Open Full Order Detail ↗
          </a>

          {/* Phase history */}
          <div>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-3">Phase History</p>
            {loadingHistory ? (
              <p className="text-gray-400 text-xs text-center py-4">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-gray-300 text-xs text-center py-4">No transitions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-[#E8726A] mt-1.5 shrink-0" />
                      {i < history.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" style={{minHeight:16}} />}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-[#0D2240] text-xs font-semibold">
                        {t.from_phase ? `${t.from_phase.replace(/_/g," ")} → ` : ""}{t.to_phase.replace(/_/g," ")}
                      </p>
                      <p className="text-gray-400 text-[10px] mt-0.5">
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
  const router = useRouter()
  const worker = useWorkerSession()

  const [grouped, setGrouped]         = useState(initialGrouped)
  const [search, setSearch]           = useState("")
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [dragging, setDragging]       = useState<{ order: BoardOrder; fromPhase: string } | null>(null)
  const [dragOver, setDragOver]       = useState<string | null>(null)
  const [moving, setMoving]           = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<BoardOrder | null>(null)
  const isDraggingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

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

  const handlePhaseMove = useCallback(async (orderId: string, toPhase: string) => {
    let order: BoardOrder | undefined
    let fromPhase = ""
    for (const [ph, orders] of Object.entries(grouped)) {
      const found = orders.find(o => o.id === orderId)
      if (found) { order = found; fromPhase = ph; break }
    }
    if (!order || fromPhase === toPhase) return

    setMoving(orderId)
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
    setTimeout(() => { isDraggingRef.current = false }, 100)
  }
  function onDragEnd() {
    setDragging(null)
    setTimeout(() => { isDraggingRef.current = false }, 100)
  }
  function handleBubbleClick(order: BoardOrder) {
    if (isDraggingRef.current) return
    setSelectedOrder(order)
  }

  const refresh = useCallback(async () => {
    const fresh = await getFacilityBoardOrders(selectedFacilityId ?? undefined)
    setGrouped(fresh)
  }, [selectedFacilityId])

  function selectFacility(id: string | null) {
    router.push(id ? `/admin/facility?facility=${id}` : "/admin/facility")
  }

  const totalOrders = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="min-h-screen bg-[#f0f4fa] flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-[#0D2240] font-extrabold text-base">🏭 Facility Board</span>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{totalOrders} orders</span>
        </div>

        {facilities.length > 1 && (
          <select
            value={selectedFacilityId ?? ""}
            onChange={e => selectFacility(e.target.value || null)}
            className="bg-gray-50 text-[#0D2240] text-xs font-bold border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#E8726A]"
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
            className="w-full bg-gray-50 text-[#0D2240] placeholder:text-gray-400 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#E8726A]"
          />
          {search && (
            <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>
          )}
        </div>

        <button
          onClick={refresh}
          className="text-gray-400 hover:text-[#0D2240] text-xs font-bold transition-colors ml-auto"
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
                className={`flex flex-col w-52 rounded-2xl transition-all duration-150 border ${
                  isOver
                    ? "border-[#E8726A] shadow-lg shadow-[#E8726A]/10 bg-orange-50/60"
                    : "border-gray-200 bg-white shadow-sm"
                }`}
                style={{ borderTop: `3px solid ${phase.color}` }}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
                  <span className="text-base">{phase.icon}</span>
                  <span className="text-[#0D2240] font-bold text-xs uppercase tracking-wide flex-1">{phase.label}</span>
                  <span
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: phase.color }}
                  >
                    {orders.length}
                  </span>
                </div>

                {/* Order cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-10rem)]">
                  {orders.length === 0 && (
                    <div className={`text-center text-gray-300 text-xs py-6 rounded-xl border-2 border-dashed transition-colors ${isOver ? "border-[#E8726A]/40 text-[#E8726A]/40" : "border-gray-200"}`}>
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
                          border bg-white transition-all duration-200
                          ${isMoving ? "opacity-40 scale-95" : ""}
                          ${dim ? "opacity-30" : ""}
                          ${isMatch
                            ? "ring-2 ring-[#E8726A] shadow-md border-[#E8726A]/20 scale-105"
                            : "border-gray-100 hover:border-gray-300 hover:shadow-md hover:scale-[1.02]"
                          }
                          ${isDragSrc && dragging?.order.id === order.id ? "opacity-50" : ""}
                        `}
                      >
                        {/* Colored left accent bar using phase color */}
                        <div
                          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                          style={{ backgroundColor: phase.color + "99" }}
                        />

                        {/* Service + code */}
                        <div className="flex items-center gap-1.5 mb-1 pl-2">
                          <span className="text-sm">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
                          <span className="text-[#0D2240] font-extrabold text-xs tracking-wider flex-1">
                            {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
                          </span>
                          {!order.actual_weight_lbs && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Not weighed" />
                          )}
                        </div>

                        {/* Customer name */}
                        <p className="text-gray-500 text-[11px] leading-tight truncate pl-2">{order.customer_name}</p>

                        {/* Bags + weight + time */}
                        <div className="flex items-center gap-2 mt-2 pl-2">
                          <span className="text-gray-400 text-[10px]">
                            {order.num_bags} bag{order.num_bags !== 1 ? "s" : ""}
                          </span>
                          {order.actual_weight_lbs ? (
                            <span className="text-gray-400 text-[10px]">· {order.actual_weight_lbs} lbs</span>
                          ) : (
                            <span className="text-amber-500 text-[10px]">· no weight</span>
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
            setSelectedOrder(prev => prev ? { ...prev, phase, phase_updated_at: new Date().toISOString() } : null)
          }}
        />
      )}

      <style>{`[draggable] { -webkit-user-drag: element; }`}</style>
    </div>
  )
}
