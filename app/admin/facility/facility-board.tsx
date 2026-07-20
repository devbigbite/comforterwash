"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  moveOrderPhase, getFacilityBoardOrders, getPhaseHistory,
  updateFacilityDetails, getFloorPhotoUploadUrl,
  type BoardOrder, type FacilitySummary, type PhaseTransition,
} from "@/app/actions/facility-board"
import { useWorkerSession } from "@/components/pin-gate"
import { PHASES } from "@/lib/facility-phases"
import { createClient } from "@/lib/supabase/client"

// ── Color key palette (matching the label roll set) ──────────────────────────

// "yellow" is intentionally excluded — it is reserved exclusively for the
// remote-storage marker sticker (see the Floor vs Storage panel below) so it
// never collides with a per-order color key on the same day.
export const COLOR_KEYS = [
  { key: "red",      label: "Red",       hex: "#ef4444" },
  { key: "blue",     label: "Blue",      hex: "#3b82f6" },
  { key: "sky",      label: "Sky Blue",  hex: "#38bdf8" },
  { key: "green",    label: "Green",     hex: "#22c55e" },
  { key: "lime",     label: "Lime",      hex: "#84cc16" },
  { key: "pink",     label: "Pink",      hex: "#f472b6" },
  { key: "hotpink",  label: "Hot Pink",  hex: "#ec4899" },
  { key: "orange",   label: "Orange",    hex: "#f97316" },
  { key: "purple",   label: "Purple",    hex: "#a855f7" },
] as const

export const STORAGE_MARKER_HEX = "#eab308"

type ColorKey = typeof COLOR_KEYS[number]["key"] | null

function colorHex(key: string | null): string {
  return COLOR_KEYS.find(c => c.key === key)?.hex ?? "#d1d5db"
}

// Phases where color key + photo are mandatory on every order
const FINISHED_PHASES = new Set(["ready", "staged", "out_for_delivery"])
// Phase where color key must be assigned BEFORE advancing
const REQUIRES_COLOR_KEY_BEFORE = "ready"  // i.e. must be set when leaving "folding"

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

function deliveryUrgency(deliveryDate: string): { label: string; className: string } {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (deliveryDate === today)     return { label: "Today",    className: "text-red-500 font-extrabold" }
  if (deliveryDate === tomorrow)  return { label: "Tomorrow", className: "text-amber-500 font-bold" }
  return { label: deliveryDate, className: "text-gray-400" }
}

// ── Order Detail Drawer ───────────────────────────────────────────────────────

function OrderDrawer({
  order: initialOrder,
  allOrdersInPhase,
  onClose,
  onPhaseMove,
  onOrderUpdated,
}: {
  order: BoardOrder
  allOrdersInPhase: BoardOrder[]
  onClose: () => void
  onPhaseMove: (orderId: string, toPhase: string) => void
  onOrderUpdated: (updated: Partial<BoardOrder>) => void
}) {
  const worker = useWorkerSession()
  const [order, setOrder] = useState(initialOrder)
  const [history, setHistory] = useState<PhaseTransition[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [moving, setMoving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentIndex = PHASES.findIndex(p => p.key === order.phase)
  const nextPhase    = currentIndex >= 0 && currentIndex < PHASES.length - 1 ? PHASES[currentIndex + 1] : null
  const currentPhase = PHASES[currentIndex]

  // Detect same-color neighbors in the same phase column
  const sameColorNeighbors = allOrdersInPhase.filter(
    o => o.id !== order.id && o.color_key && o.color_key === order.color_key
  )

  useEffect(() => {
    setLoadingHistory(true)
    getPhaseHistory(order.id).then(h => { setHistory(h); setLoadingHistory(false) })
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

  async function saveField(updates: Partial<BoardOrder>) {
    setSaving(true); setMsg(null)
    const result = await updateFacilityDetails(order.id, updates as Parameters<typeof updateFacilityDetails>[1])
    setSaving(false)
    if (result.error) { setMsg({ type: "err", text: result.error }); return }
    const updated = { ...order, ...updates }
    setOrder(updated)
    onOrderUpdated(updates)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true); setMsg(null)
    try {
      const { url, path, error } = await getFloorPhotoUploadUrl(order.id)
      if (error || !url || !path) throw new Error(error ?? "Failed to get upload URL")

      const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      if (!res.ok) throw new Error("Upload failed")

      // Get public URL from Supabase
      const supabase = createClient()
      const { data: { publicUrl } } = supabase.storage.from("worker-docs").getPublicUrl(path)
      await saveField({ facility_floor_photo_url: publicUrl })
      setMsg({ type: "ok", text: "Photo saved." })
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Upload failed" })
    }
    setUploadingPhoto(false)
  }

  const urgency = deliveryUrgency(order.delivery_date)
  const isFinished = FINISHED_PHASES.has(order.phase)
  // Must have color key before advancing INTO ready
  const advanceBlockedNoColorKey = nextPhase?.key === REQUIRES_COLOR_KEY_BEFORE && !order.color_key
  // Must have photo before advancing OUT OF ready (or any finished phase)
  const advanceBlockedNoPhoto = isFinished && !order.facility_floor_photo_url

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white border-l border-gray-200 z-50 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0"
          style={{ borderTop: currentPhase ? `3px solid ${currentPhase.color}` : undefined }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-2xl">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
              <span className="text-[#0D2240] font-extrabold text-lg tracking-wider">
                {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
              </span>
              {currentPhase && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: currentPhase.color }}>
                  {currentPhase.icon} {currentPhase.label}
                </span>
              )}
              {order.hold_at_facility && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  📍 Held at Facility
                </span>
              )}
              {/* Color key badge */}
              {order.color_key && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ borderColor: colorHex(order.color_key), color: colorHex(order.color_key), background: colorHex(order.color_key) + "18" }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: colorHex(order.color_key) }} />
                  {COLOR_KEYS.find(c => c.key === order.color_key)?.label}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">{order.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-xl leading-none mt-0.5 transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 bg-[#f8fafc]">

          {/* Delivery date — prominent */}
          <div className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 shadow-sm ${urgency.label === "Today" ? "border-red-200 bg-red-50" : urgency.label === "Tomorrow" ? "border-amber-100 bg-amber-50" : "border-gray-100"}`}>
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Delivery Date</p>
              <p className={`text-base ${urgency.className}`}>{urgency.label === "Today" || urgency.label === "Tomorrow" ? urgency.label : new Date(order.delivery_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
            </div>
            <span className="text-2xl">{urgency.label === "Today" ? "🔴" : urgency.label === "Tomorrow" ? "🟡" : "📅"}</span>
          </div>

          {/* Key facts */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Service",    value: SERVICE_LABEL[order.service_type] ?? order.service_type },
              { label: "Picked-up bags", value: `${order.num_bags} bag${order.num_bags !== 1 ? "s" : ""}` },
              { label: "Weight",     value: order.actual_weight_lbs ? `${order.actual_weight_lbs} lbs` : "⚠️ Not weighed" },
              { label: "In phase",   value: timeSince(order.phase_updated_at) || "—", color: phaseAgeColor(order.phase_updated_at) },
            ].map(f => (
              <div key={f.label} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-sm">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">{f.label}</p>
                <p className={`text-sm font-semibold ${f.color ?? "text-[#0D2240]"}`}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* ── Folded bag count ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              Folded Bag Count
              <span className="text-gray-300 font-normal normal-case ml-1">(may differ from pickup)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" step="1"
                defaultValue={order.folded_bag_count ?? order.num_bags}
                onBlur={e => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v) && v !== (order.folded_bag_count ?? order.num_bags)) {
                    saveField({ folded_bag_count: v })
                  }
                }}
                className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-[#0D2240] focus:outline-none focus:border-[#E8726A]"
              />
              <span className="text-xs text-gray-400">bags after folding</span>
            </div>
          </div>

          {/* ── Color Key Selector ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Color Key Sticker</p>

            {/* Same-color warning */}
            {order.color_key && sameColorNeighbors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                <span className="text-amber-500 shrink-0">⚠️</span>
                <p className="text-xs text-amber-700 font-semibold leading-snug">
                  {sameColorNeighbors.map(o => o.short_code?.toUpperCase() ?? o.id.slice(0,6)).join(", ")} in this phase also {sameColorNeighbors.length === 1 ? "has" : "have"} a <strong>{COLOR_KEYS.find(c=>c.key===order.color_key)?.label}</strong> sticker. Do not place these orders adjacent to each other.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {COLOR_KEYS.map(c => (
                <button
                  key={c.key}
                  onClick={() => saveField({ color_key: order.color_key === c.key ? null : c.key })}
                  title={c.label}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${order.color_key === c.key ? "border-[#0D2240] scale-110 shadow-md" : "border-transparent"}`}
                  style={{ background: c.hex }}
                />
              ))}
              {order.color_key && (
                <button onClick={() => saveField({ color_key: null })} className="text-xs text-gray-400 hover:text-red-400 font-semibold px-2 self-center">
                  Clear
                </button>
              )}
            </div>
            {order.color_key && (
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: colorHex(order.color_key) }} />
                {COLOR_KEYS.find(c => c.key === order.color_key)?.label} sticker assigned
              </p>
            )}
          </div>

          {/* ── Placement Photo — required for ALL finished orders ── */}
          {isFinished && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Placement Photo</p>
                {!order.facility_floor_photo_url && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">Required</span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-snug">
                Photograph the finished bags and their location — floor or storage — so the driver has a reference on arrival.
              </p>

              {order.facility_floor_photo_url ? (
                <div className="space-y-2">
                  <img src={order.facility_floor_photo_url} alt="Placement" className="w-full rounded-xl border border-gray-200 object-cover max-h-48" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-xs font-bold text-gray-500 border border-gray-200 bg-white py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    📷 Replace Photo
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-red-300 hover:border-red-400 bg-red-50 rounded-xl py-5 text-sm text-red-400 hover:text-red-500 transition-colors font-semibold"
                >
                  {uploadingPhoto ? (
                    <><span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> Uploading…</>
                  ) : (
                    <>📷 Take placement photo (required)</>
                  )}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
            </div>
          )}

          {/* ── Floor vs Storage decision ── */}
          {isFinished && (
            <div className={`rounded-xl border shadow-sm p-4 ${order.hold_at_facility ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-100"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#0D2240]">
                    {order.hold_at_facility ? "📍 Kept on Facility Floor" : "📦 Send to Storage"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                    {order.hold_at_facility
                      ? "Staying on the facility floor temp space. Apply color key sticker only."
                      : <>Sending to remote storage. Apply color key sticker <strong>+ YELLOW marker sticker</strong>.</>
                    }
                    {!order.hold_at_facility && urgency.label === "Today" && <span className="text-red-500 font-semibold ml-1">Delivery is today — recommend floor.</span>}
                    {!order.hold_at_facility && urgency.label === "Tomorrow" && <span className="text-amber-600 font-semibold ml-1">Delivery is tomorrow — consider floor.</span>}
                  </p>
                </div>
                <button
                  onClick={() => saveField({ hold_at_facility: !order.hold_at_facility })}
                  disabled={saving}
                  className={`shrink-0 w-12 h-6 rounded-full transition-all relative ${order.hold_at_facility ? "bg-emerald-500" : "bg-gray-200"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${order.hold_at_facility ? "left-6" : "left-0.5"}`} />
                </button>
              </div>

              {/* Storage marker sticker — always YELLOW, reserved and never used as a per-order color key */}
              {!order.hold_at_facility && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full shrink-0 mt-0.5 border border-amber-300" style={{ background: STORAGE_MARKER_HEX }} />
                  <p className="text-xs text-amber-700 leading-snug">
                    <strong>YELLOW marker sticker required</strong> for orders going to remote storage — apply it alongside the color key sticker so the driver immediately identifies this as a storage order. Yellow is reserved for this and is never used as a per-order color key.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Flash msg */}
          {msg && (
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${msg.type === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
              {msg.text}
            </div>
          )}

          {/* Advance phase */}
          {nextPhase ? (
            <>
              {advanceBlockedNoColorKey && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center space-y-1">
                  <p className="text-red-600 font-bold text-sm">🏷️ Color key required to mark as Ready</p>
                  <p className="text-red-400 text-xs">Assign a color key sticker before moving to {nextPhase.label}.</p>
                </div>
              )}
              {!advanceBlockedNoColorKey && advanceBlockedNoPhoto && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center space-y-1">
                  <p className="text-red-600 font-bold text-sm">📷 Photo required to advance</p>
                  <p className="text-red-400 text-xs">Take the placement photo before moving this order further.</p>
                </div>
              )}
              {!advanceBlockedNoColorKey && !advanceBlockedNoPhoto && (
                <button
                  onClick={handleAdvance} disabled={moving}
                  className="w-full flex items-center justify-center gap-2 bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-sm py-3.5 rounded-xl transition-colors shadow-sm"
                >
                  {moving ? (
                    <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Moving…</span>
                  ) : (
                    <>Move to {nextPhase.icon} {nextPhase.label} →</>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
              <p className="text-emerald-600 font-bold text-sm">✅ Final phase — ready to close out</p>
            </div>
          )}

          {/* Full order link */}
          <a href={`/admin/orders/${order.id}`} className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-[#0D2240] hover:text-[#E8726A] font-semibold text-sm py-3 rounded-xl transition-colors shadow-sm">
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
                        {formatDateTime(t.created_at)}{t.worker_name && ` · ${t.worker_name}`}{t.source && ` · ${t.source.replace(/_/g," ")}`}
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

interface Phase { key: string; label: string; icon: string; color: string }
interface Props {
  initialGrouped: Record<string, BoardOrder[]>
  facilities: FacilitySummary[]
  selectedFacilityId: string | null
  phases: readonly Phase[]
}

export function FacilityBoard({ initialGrouped, facilities, selectedFacilityId, phases }: Props) {
  const router = useRouter()
  const worker = useWorkerSession()

  const [grouped, setGrouped]             = useState(initialGrouped)
  const [search, setSearch]               = useState("")
  const [highlighted, setHighlighted]     = useState<string | null>(null)
  const [dragging, setDragging]           = useState<{ order: BoardOrder; fromPhase: string } | null>(null)
  const [dragOver, setDragOver]           = useState<string | null>(null)
  const [moving, setMoving]               = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<BoardOrder | null>(null)
  const [showHeldOnly, setShowHeldOnly]   = useState(false)
  const isDraggingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

  function handleSearch(q: string) {
    setSearch(q)
    if (!q.trim()) { setHighlighted(null); return }
    const lower = q.toLowerCase()
    for (const orders of Object.values(grouped)) {
      const match = orders.find(o => o.short_code?.toLowerCase().includes(lower) || o.customer_name.toLowerCase().includes(lower))
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
    const result = await moveOrderPhase(orderId, toPhase, worker?.workerId ?? null, worker?.workerName ?? null)
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

  function onDragStart(order: BoardOrder, fromPhase: string) { isDraggingRef.current = true; setDragging({ order, fromPhase }) }
  function onDragOver(e: React.DragEvent, toPhase: string) { e.preventDefault(); setDragOver(toPhase) }
  function onDragLeave() { setDragOver(null) }
  async function onDrop(e: React.DragEvent, toPhase: string) {
    e.preventDefault(); setDragOver(null)
    if (!dragging || dragging.fromPhase === toPhase) { setDragging(null); return }
    const { order, fromPhase } = dragging; setDragging(null)
    await handlePhaseMove(order.id, toPhase)
    setTimeout(() => { isDraggingRef.current = false }, 100)
  }
  function onDragEnd() { setDragging(null); setTimeout(() => { isDraggingRef.current = false }, 100) }
  function handleBubbleClick(order: BoardOrder) { if (isDraggingRef.current) return; setSelectedOrder(order) }

  const refresh = useCallback(async () => {
    const fresh = await getFacilityBoardOrders(selectedFacilityId ?? undefined)
    setGrouped(fresh)
  }, [selectedFacilityId])

  function selectFacility(id: string | null) {
    router.push(id ? `/admin/facility?facility=${id}` : "/admin/facility")
  }

  function handleOrderUpdated(orderId: string, updates: Partial<BoardOrder>) {
    setGrouped(prev => {
      const next = { ...prev }
      for (const phase of Object.keys(next)) {
        next[phase] = next[phase].map(o => o.id === orderId ? { ...o, ...updates } : o)
      }
      return next
    })
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  const totalOrders = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)
  const heldCount   = Object.values(grouped).reduce((s, arr) => s + arr.filter(o => o.hold_at_facility).length, 0)
  const today = new Date().toISOString().slice(0, 10)

  // Build a set of order IDs that have a same-color conflict within their column
  const colorConflicts = new Set<string>()
  for (const orders of Object.values(grouped)) {
    const colorMap: Record<string, string[]> = {}
    for (const o of orders) {
      if (o.color_key) {
        if (!colorMap[o.color_key]) colorMap[o.color_key] = []
        colorMap[o.color_key].push(o.id)
      }
    }
    for (const ids of Object.values(colorMap)) {
      if (ids.length > 1) ids.forEach(id => colorConflicts.add(id))
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4fa] flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-[#0D2240] font-extrabold text-base">🏭 Facility Board</span>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{totalOrders} orders</span>
          {heldCount > 0 && (
            <button
              onClick={() => setShowHeldOnly(!showHeldOnly)}
              className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${showHeldOnly ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
            >
              📍 {heldCount} held
            </button>
          )}
        </div>

        {facilities.length > 1 && (
          <select value={selectedFacilityId ?? ""} onChange={e => selectFacility(e.target.value || null)}
            className="bg-gray-50 text-[#0D2240] text-xs font-bold border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#E8726A]">
            <option value="">All Facilities</option>
            {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}

        <div className="relative flex-1 max-w-xs">
          <input ref={searchRef} type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search order or customer…"
            className="w-full bg-gray-50 text-[#0D2240] placeholder:text-gray-400 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#E8726A]" />
          {search && <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>}
        </div>

        <button onClick={refresh} className="text-gray-400 hover:text-[#0D2240] text-xs font-bold transition-colors ml-auto">↻ Refresh</button>
      </div>

      {/* ── Kanban columns ── */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 p-4 min-w-max h-full">
          {phases.map(phase => {
            let orders = grouped[phase.key] ?? []
            if (showHeldOnly) orders = orders.filter(o => o.hold_at_facility)
            const isOver    = dragOver === phase.key
            const isDragSrc = dragging?.fromPhase === phase.key

            return (
              <div key={phase.key}
                onDragOver={e => onDragOver(e, phase.key)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, phase.key)}
                className={`flex flex-col w-52 rounded-2xl transition-all duration-150 border ${isOver ? "border-[#E8726A] shadow-lg shadow-[#E8726A]/10 bg-orange-50/60" : "border-gray-200 bg-white shadow-sm"}`}
                style={{ borderTop: `3px solid ${phase.color}` }}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
                  <span className="text-base">{phase.icon}</span>
                  <span className="text-[#0D2240] font-bold text-xs uppercase tracking-wide flex-1">{phase.label}</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: phase.color }}>{orders.length}</span>
                </div>

                {/* Order cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-10rem)]">
                  {orders.length === 0 && (
                    <div className={`text-center text-gray-300 text-xs py-6 rounded-xl border-2 border-dashed transition-colors ${isOver ? "border-[#E8726A]/40 text-[#E8726A]/40" : "border-gray-200"}`}>
                      {showHeldOnly ? "No held orders" : "Drop here"}
                    </div>
                  )}
                  {orders.map(order => {
                    const isMatch   = highlighted === order.id
                    const isMoving  = moving === order.id
                    const dim       = highlighted && !isMatch
                    const urgent    = deliveryUrgency(order.delivery_date)
                    const hasConflict = colorConflicts.has(order.id)

                    return (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={() => onDragStart(order, phase.key)}
                        onDragEnd={onDragEnd}
                        onClick={() => handleBubbleClick(order)}
                        className={`
                          relative rounded-xl p-3 cursor-pointer select-none border bg-white
                          transition-all duration-200
                          ${isMoving ? "opacity-40 scale-95" : ""}
                          ${dim ? "opacity-30" : ""}
                          ${isMatch ? "ring-2 ring-[#E8726A] shadow-md border-[#E8726A]/20 scale-105" : "border-gray-100 hover:border-gray-300 hover:shadow-md hover:scale-[1.02]"}
                          ${isDragSrc && dragging?.order.id === order.id ? "opacity-50" : ""}
                        `}
                      >
                        {/* Colored left accent */}
                        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: phase.color + "99" }} />

                        {/* Top row: service icon + code + color dot + hold pin */}
                        <div className="flex items-center gap-1.5 mb-1 pl-2">
                          <span className="text-sm">{SERVICE_ICON[order.service_type] ?? "📦"}</span>
                          <span className="text-[#0D2240] font-extrabold text-xs tracking-wider flex-1">
                            {order.short_code?.toUpperCase() ?? order.id.slice(0, 6).toUpperCase()}
                          </span>
                          {/* Color key dot */}
                          {order.color_key && (
                            <span className={`w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-white shadow ${hasConflict ? "ring-2 ring-amber-400" : ""}`}
                              style={{ background: colorHex(order.color_key) }}
                              title={`${COLOR_KEYS.find(c=>c.key===order.color_key)?.label}${hasConflict?" — SAME COLOR CONFLICT":""}`}
                            />
                          )}
                          {/* Hold pin */}
                          {order.hold_at_facility && (
                            <span title="Held at facility floor" className="text-emerald-500 text-xs shrink-0">📍</span>
                          )}
                          {/* Missing photo warning — all finished orders */}
                          {FINISHED_PHASES.has(order.phase) && !order.facility_floor_photo_url && (
                            <span title="Placement photo required" className="text-red-500 text-xs shrink-0">📷</span>
                          )}
                          {/* Missing color key warning — all finished orders */}
                          {FINISHED_PHASES.has(order.phase) && !order.color_key && (
                            <span title="Color key sticker required" className="text-red-500 text-xs shrink-0">🏷️</span>
                          )}
                          {/* Unweighed dot */}
                          {!order.actual_weight_lbs && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Not weighed" />}
                        </div>

                        {/* Customer */}
                        <p className="text-gray-500 text-[11px] leading-tight truncate pl-2">{order.customer_name}</p>

                        {/* Delivery date */}
                        <p className={`text-[10px] pl-2 mt-0.5 ${urgent.className}`}>
                          🗓 {urgent.label === "Today" || urgent.label === "Tomorrow" ? urgent.label : new Date(order.delivery_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>

                        {/* Bags + weight + time */}
                        <div className="flex items-center gap-2 mt-1.5 pl-2">
                          <span className="text-gray-400 text-[10px]">
                            {order.folded_bag_count ?? order.num_bags} bag{(order.folded_bag_count ?? order.num_bags) !== 1 ? "s" : ""}
                            {order.folded_bag_count && order.folded_bag_count !== order.num_bags && (
                              <span className="text-purple-400 ml-0.5">(was {order.num_bags})</span>
                            )}
                          </span>
                          {order.actual_weight_lbs
                            ? <span className="text-gray-400 text-[10px]">· {order.actual_weight_lbs} lbs</span>
                            : <span className="text-amber-500 text-[10px]">· no weight</span>
                          }
                          <span className={`text-[10px] ml-auto font-semibold ${phaseAgeColor(order.phase_updated_at)}`}>
                            {timeSince(order.phase_updated_at)}
                          </span>
                        </div>

                        {/* Floor photo thumbnail */}
                        {order.facility_floor_photo_url && (
                          <div className="mt-2 pl-2">
                            <img src={order.facility_floor_photo_url} alt="Floor" className="w-full h-16 object-cover rounded-lg border border-gray-100" />
                          </div>
                        )}

                        {/* Same-color conflict warning */}
                        {hasConflict && (
                          <p className="text-[10px] text-amber-600 font-bold mt-1.5 pl-2 flex items-center gap-1">
                            ⚠️ Same color in this phase — don&apos;t place adjacent
                          </p>
                        )}
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
          allOrdersInPhase={grouped[selectedOrder.phase] ?? []}
          onClose={() => setSelectedOrder(null)}
          onPhaseMove={async (id, phase) => {
            await handlePhaseMove(id, phase)
            setSelectedOrder(prev => prev ? { ...prev, phase, phase_updated_at: new Date().toISOString() } : null)
          }}
          onOrderUpdated={(updates) => handleOrderUpdated(selectedOrder.id, updates)}
        />
      )}

      <style>{`[draggable] { -webkit-user-drag: element; }`}</style>
    </div>
  )
}
