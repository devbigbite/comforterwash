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
    for (const [ph, or