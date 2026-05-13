"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { moveOrderPhase, getFacilityBoardOrders, type BoardOrder, type FacilitySummary } from "@/app/actions/facility-board"
import { useWorkerSession } from "@/components/pin-gate"

const SERVICE_ICON: Record<string, string> = {
  comforter_wash: "🛏️",
  wash_fold:      "👕",
  wash_only:      "🫧",
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
  if (hrs < 2)  return "text-green-500"
  if (hrs < 6)  return "text-amber-500"
  return "text-red-500"
}

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
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Search: highlight matching order bubble ───────────────────────────────
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

  // ── Drag and drop ─────────────────────────────────────────────────────────
  function onDragStart(order: BoardOrder, fromPhase: string) {
    setDragging({ order, fromPhase })
  }

  function onDragOver(e: React.DragEvent, toPhase: string) {
    e.preventDefault()
    setDragOver(toPhase)
  }

  function onDragLeave() {
    setDragOver(null)
  }

  async function onDrop(e: React.DragEvent, toPhase: string) {
    e.preventDefault()
    setDragOver(null)
    if (!dragging || dragging.fromPhase === toPhase) { setDragging(null); return }

    const { order, fromPhase } = dragging
    setDragging(null)
    setMoving(order.id)

    // Optimistic update
    setGrouped(prev => {
      const next = { ...prev }
      next[fromPhase] = prev[fromPhase].filter(o => o.id !== order.id)
      next[toPhase]   = [{ ...order, phase: toPhase, phase_updated_at: new Date().toISOString() }, ...prev[toPhase]]
      return next
    })

    const result = await moveOrderPhase(
      order.id,
      toPhase,
      worker?.workerId ?? null,
      worker?.workerName ?? null
    )

    if (result.error) {
      // Revert on error
      setGrouped(prev => {
        const next = { ...prev }
        next[toPhase]   = prev[toPhase].filter(o => o.id !== order.id)
        next[fromPhase] = [order, ...prev[fromPhase]]
        return next
      })
    }

    setMoving(null)
  }

  // ── Refresh board ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const fresh = await getFacilityBoardOrders(selectedFacilityId ?? undefined)
    setGrouped(fresh)
  }, [selectedFacilityId])

  // ── Facility filter ───────────────────────────────────────────────────────
  function selectFacility(id: string | null) {
    const params = id ? `?facility=${id}` : ""
    router.push(`/facility${params}`)
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

        {/* Facility selector */}
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

        {/* Search */}
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
            const orders   = grouped[phase.key] ?? []
            const isOver   = dragOver === phase.key
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

                {/* Order bubbles */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-10rem)]">
                  {orders.length === 0 && (
                    <div className={`text-center text-white/20 text-xs py-6 rounded-xl border-2 border-dashed transition-colors ${isOver ? "border-[#E8726A]/40" : "border-white/10"}`}>
                      Drop here
                    </div>
                  )}
                  {orders.map(order => {
                    const isMatch = highlighted === order.id
                    const isMoving = moving === order.id
                    const dim = highlighted && !isMatch

                    return (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={() => onDragStart(order, phase.key)}
                        onDragEnd={() => setDragging(null)}
                        className={`
                          relative rounded-xl p-3 cursor-grab active:cursor-grabbing select-none
                          border transition-all duration-200
                          ${isMoving ? "opacity-40 scale-95" : ""}
                          ${dim ? "opacity-20" : ""}
                          ${isMatch ? "ring-2 ring-[#E8726A] shadow-lg shadow-[#E8726A]/20 scale-105" : ""}
                          ${isDragSrc && dragging?.order.id === order.id ? "opacity-50" : ""}
                          bg-white/10 border-white/10 hover:border-white/30 hover:bg-white/15
                        `}
                      >
                        {/* Service icon + order code */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-sm">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
                          <span className="text-white font-extrabold text-xs tracking-wider">
                            {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
                          </span>
                        </div>

                        {/* Customer name */}
                        <p className="text-white/70 text-[11px] leading-tight truncate">{order.customer_name}</p>

                        {/* Bags + weight */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-white/50 text-[10px]">
                            {order.num_bags} bag{order.num_bags !== 1 ? "s" : ""}
                          </span>
                          {order.actual_weight_lbs && (
                            <span className="text-white/50 text-[10px]">
                              · {order.actual_weight_lbs} lbs
                            </span>
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

      <style>{`
        [draggable] { -webkit-user-drag: element; }
      `}</style>
    </div>
  )
}
