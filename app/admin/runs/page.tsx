"use client"

import { useState, useEffect, useTransition } from "react"
import { createTransportRun, cancelTransportRun, getTransportRuns, getEligibleOrdersForRun, getActiveFacilities, checkFacilityAccessNow, getStorageSpacesForFacility, type TransportRun, type StorageSpaceOption } from "@/app/actions/transport-runs"
import Link from "next/link"

// ─── This page needs server-fetched data — use a thin server wrapper ──────────
// We keep it client for the interactive create form.
// Data is loaded via useEffect calls to the server actions.

interface Facility { id: string; name: string; address: string | null; supports_own_operator: boolean; supports_partner_attendant: boolean }
interface EligibleOrder {
  id: string; short_code: string | null; customer_name: string
  customer_address: string; num_bags: number | null; service_type: string
  actual_weight_lbs: number | null
}

const RUN_TYPE_LABEL: Record<string, string> = {
  to_facility:  "Storage → Facility",
  to_warehouse: "Facility → Storage",
}
const RUN_TYPE_ICON: Record<string, string> = {
  to_facility:  "🏭",
  to_warehouse: "📦",
}
const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
}

function serviceLabel(st: string) {
  if (st === "wash_fold") return "W&F"
  if (st === "wash_only") return "Wash Only"
  return "Comforter"
}

export default function RunsPage() {
  const [runs, setRuns]           = useState<TransportRun[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [eligible, setEligible]   = useState<EligibleOrder[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Create-form state
  const [runType, setRunType]         = useState<"to_facility" | "to_warehouse">("to_facility")
  const [facilityId, setFacilityId]   = useState("")
  const [assignedTo, setAssignedTo]   = useState("")
  const [assignedRole, setAssignedRole] = useState<"driver" | "operator">("driver")
  const [notes, setNotes]             = useState("")
  const [processingMode, setProcessingMode] = useState<"own_operator" | "partner_attendant" | "">("")
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [eligibleLoading, setEligibleLoading] = useState(false)
  const [tabFilter, setTabFilter]     = useState<"pending" | "completed">("pending")
  const [accessStatus, setAccessStatus] = useState<{ accessible: boolean; windows: { label: string | null; days_of_week: number[]; start_time: string; end_time: string; overnight: boolean }[] } | null>(null)
  const [storageSpaces, setStorageSpaces] = useState<StorageSpaceOption[]>([])
  const [storageSpaceId, setStorageSpaceId] = useState("")

  async function loadData() {
    setLoading(true)
    const [runsData] = await Promise.all([
      getTransportRuns(["pending", "completed", "cancelled"]),
    ])
    setRuns(runsData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    getActiveFacilities().then(setFacilities)
  }, [])

  // Check facility access window + load storage spaces when facilityId changes
  useEffect(() => {
    setAccessStatus(null)
    setStorageSpaces([])
    setStorageSpaceId("")
    if (!facilityId) return
    checkFacilityAccessNow(facilityId).then(setAccessStatus)
    getStorageSpacesForFacility(facilityId).then(spaces => {
      setStorageSpaces(spaces)
      // Auto-select if only one option
      if (spaces.length === 1) setStorageSpaceId(spaces[0].id)
    })
  }, [facilityId])

  // Re-fetch eligible orders when runType or facilityId changes
  useEffect(() => {
    if (!showCreate) return
    setEligibleLoading(true)
    setSelectedOrderIds(new Set())
    getEligibleOrdersForRun(runType, facilityId || undefined)
      .then(data => { setEligible(data as EligibleOrder[]); setEligibleLoading(false) })
  }, [runType, facilityId, showCreate])

  function toggleOrder(id: string) {
    setSelectedOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedOrderIds.size === eligible.length) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(eligible.map(o => o.id)))
    }
  }

  async function handleCreate() {
    if (!facilityId || !assignedTo.trim() || selectedOrderIds.size === 0) return
    const selFacility = facilities.find(f => f.id === facilityId)
    const isHybrid = selFacility?.supports_own_operator && selFacility?.supports_partner_attendant
    if (isHybrid && !processingMode) return
    const fd = new FormData()
    fd.append("runType",        runType)
    fd.append("facilityId",     facilityId)
    fd.append("assignedTo",     assignedTo.trim())
    fd.append("assignedRole",   assignedRole)
    fd.append("notes",          notes)
    fd.append("orderIds",       [...selectedOrderIds].join(","))
    if (processingMode)  fd.append("processingMode",  processingMode)
    if (storageSpaceId)  fd.append("storageSpaceId",  storageSpaceId)

    startTransition(async () => {
      const result = await createTransportRun(fd)
      if (result.error) { alert(result.error); return }
      setShowCreate(false)
      setRunType("to_facility")
      setFacilityId("")
      setProcessingMode("")
      setAssignedTo("")
      setNotes("")
      setSelectedOrderIds(new Set())
      await loadData()
    })
  }

  async function handleCancel(runId: string) {
    if (!confirm("Cancel this run? Orders will remain at their current status.")) return
    await cancelTransportRun(runId)
    await loadData()
  }

  const filteredRuns = runs.filter(r =>
    tabFilter === "pending" ? r.status === "pending" : r.status !== "pending"
  )

  const pendingCount   = runs.filter(r => r.status === "pending").length
  const completedCount = runs.filter(r => r.status === "completed").length

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Facility Transfers</h1>
            <p className="text-sm text-gray-400 mt-0.5">Internal batch transfers between storage and processing facilities</p>
          </div>
          <button
            onClick={() => setShowCreate(s => !s)}
            className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {showCreate ? "✕ Cancel" : "+ New Run"}
          </button>
        </div>

        {/* ── Create Run Panel ──────────────────────────────────────── */}
        {showCreate && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 space-y-5">
            <h2 className="font-extrabold text-[#0D2240] text-lg">Create Facility Transfer</h2>

            {/* Run type */}
            <div className="grid grid-cols-2 gap-3">
              {(["to_facility", "to_warehouse"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRunType(type)}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    runType === type
                      ? "border-[#E8726A] bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-2xl mb-1">{RUN_TYPE_ICON[type]}</p>
                  <p className="font-bold text-[#0D2240] text-sm">{RUN_TYPE_LABEL[type]}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {type === "to_facility"
                      ? "Pick up orders from storage → drop at processing facility"
                      : "Pick up ready orders from facility → return to storage"}
                  </p>
                </button>
              ))}
            </div>

            {/* Facility */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                {runType === "to_facility" ? "Destination Facility" : "Source Facility"} *
              </label>
              {facilities.length > 0 ? (
                <select
                  value={facilityId}
                  onChange={e => setFacilityId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                >
                  <option value="">— select facility —</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}{f.address ? ` · ${f.address}` : ""}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={facilityId}
                  onChange={e => setFacilityId(e.target.value)}
                  placeholder="Facility ID (facilities loading…)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none"
                />
              )}
            </div>

            {/* Storage Space */}
            {facilityId && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Storage Space
                  {storageSpaces.length === 0 && <span className="ml-2 font-normal text-amber-600">(none configured — add in Facilities)</span>}
                </label>
                {storageSpaces.length > 0 ? (
                  <select
                    value={storageSpaceId}
                    onChange={e => setStorageSpaceId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                  >
                    <option value="">— no specific storage space —</option>
                    {storageSpaces.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.unit ? ` · ${s.unit}` : ""}{s.address ? ` · ${s.address}` : ""}{s.city ? `, ${s.city}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5">
                    No storage spaces set up for this facility.{" "}
                    <a href="/admin/facilities" className="text-[#E8726A] hover:underline">Add one in Facilities →</a>
                  </p>
                )}
              </div>
            )}

            {/* Access window warning */}
            {facilityId && accessStatus && (
              <div className={`rounded-xl px-4 py-3 border text-sm flex items-start gap-2.5 ${
                accessStatus.accessible
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}>
                <span className="text-base mt-0.5">{accessStatus.accessible ? "✅" : "⚠️"}</span>
                <div>
                  {accessStatus.windows.length === 0 ? (
                    <p className="font-semibold">No access restrictions — facility available anytime.</p>
                  ) : accessStatus.accessible ? (
                    <p className="font-semibold">Currently within access window — good to go.</p>
                  ) : (
                    <p className="font-semibold">Outside facility access hours right now.</p>
                  )}
                  {accessStatus.windows.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {accessStatus.windows.map((w, i) => {
                        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
                        const fmt = (t: string) => { const [h,m] = t.split(":"); const hr=parseInt(h); return `${hr%12||12}:${m} ${hr>=12?"PM":"AM"}` }
                        const dayList = w.days_of_week.sort((a,b)=>a-b).map(d=>days[d]).join(", ")
                        return (
                          <li key={i} className="text-xs opacity-80">
                            {w.label && <strong>{w.label}: </strong>}{dayList} · {fmt(w.start_time)}–{fmt(w.end_time)}{w.overnight ? " (overnight)" : ""}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Processing mode — only for hybrid facilities */}
            {facilityId && (() => {
              const selF = facilities.find(f => f.id === facilityId)
              const isHybrid = selF?.supports_own_operator && selF?.supports_partner_attendant
              const ownOnly  = selF?.supports_own_operator && !selF?.supports_partner_attendant
              const partOnly = !selF?.supports_own_operator && selF?.supports_partner_attendant
              if (!selF) return null
              if (ownOnly)  return <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-semibold"><span>🔵</span> WashFold operator handles all work at this facility</div>
              if (partOnly) return <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-700 font-semibold"><span>🟣</span> Facility attendant handles all work at this facility</div>
              if (isHybrid) return (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Who handles this batch? <span className="text-[#E8726A]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setProcessingMode("own_operator")}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                        processingMode === "own_operator"
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-500 hover:border-blue-300"
                      }`}>
                      <span className="text-lg">🔵</span>
                      <div className="text-left">
                        <p>Our Operator</p>
                        <p className="text-[10px] font-normal opacity-70">WashFold staff runs the machines</p>
                      </div>
                    </button>
                    <button type="button" onClick={() => setProcessingMode("partner_attendant")}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                        processingMode === "partner_attendant"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-gray-200 text-gray-500 hover:border-purple-300"
                      }`}>
                      <span className="text-lg">🟣</span>
                      <div className="text-left">
                        <p>Their Attendant</p>
                        <p className="text-[10px] font-normal opacity-70">Facility staff handles washing</p>
                      </div>
                    </button>
                  </div>
                  {!processingMode && <p className="text-xs text-amber-600 font-semibold mt-1.5">⚠ Select who handles this batch before creating the run.</p>}
                </div>
              )
              return null
            })()}

            {/* Assign to */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Assign To *
                </label>
                <input
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  placeholder="Worker name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Role *
                </label>
                <select
                  value={assignedRole}
                  onChange={e => setAssignedRole(e.target.value as "driver" | "operator")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                >
                  <option value="driver">Driver</option>
                  <option value="operator">Operator</option>
                </select>
              </div>
            </div>

            {/* Orders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Orders to Include *
                  {selectedOrderIds.size > 0 && (
                    <span className="ml-2 text-[#E8726A]">({selectedOrderIds.size} selected)</span>
                  )}
                </label>
                {eligible.length > 0 && (
                  <button type="button" onClick={toggleAll}
                    className="text-xs text-[#E8726A] font-semibold hover:underline">
                    {selectedOrderIds.size === eligible.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>

              {!facilityId && (
                <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-xl">
                  Select a facility first to see eligible orders.
                </p>
              )}

              {facilityId && eligibleLoading && (
                <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-xl">Loading orders…</p>
              )}

              {facilityId && !eligibleLoading && eligible.length === 0 && (
                <div className="bg-gray-50 rounded-xl py-6 text-center">
                  <p className="text-gray-400 text-sm font-semibold">No eligible orders</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {runType === "to_facility"
                      ? "No orders are currently at storage waiting for transfer."
                      : "No orders are ready at this facility for return to storage."}
                  </p>
                </div>
              )}

              {facilityId && !eligibleLoading && eligible.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {eligible.map(o => (
                    <label
                      key={o.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        selectedOrderIds.has(o.id)
                          ? "border-[#E8726A] bg-orange-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(o.id)}
                        onChange={() => toggleOrder(o.id)}
                        className="mt-0.5 accent-[#E8726A]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0D2240] text-sm">{o.customer_name}</span>
                          <span className="font-mono text-xs text-gray-400">{o.short_code ?? o.id.slice(0,6).toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{o.customer_address}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-gray-600">{serviceLabel(o.service_type)}</p>
                        <p className="text-xs text-gray-400">{o.num_bags ?? "?"} bags</p>
                        {o.actual_weight_lbs && (
                          <p className="text-xs text-green-600 font-semibold">{o.actual_weight_lbs} lbs</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any instructions for the driver/operator…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 resize-none"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={isPending || !facilityId || !assignedTo.trim() || selectedOrderIds.size === 0}
              className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white font-extrabold py-3.5 rounded-xl text-sm transition-colors"
            >
              {isPending
                ? "Creating…"
                : `Create Run · ${selectedOrderIds.size} order${selectedOrderIds.size !== 1 ? "s" : ""} · ${
                    runType === "to_facility"
                      ? `→ ${facilities.find(f => f.id === facilityId)?.name ?? "facility"}`
                      : `→ Storage`
                  }`
              }
            </button>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-4">
          {([["pending", `Pending (${pendingCount})`], ["completed", `History (${completedCount})`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTabFilter(key)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
                tabFilter === key
                  ? "bg-[#0D2240] text-white"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Run List ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading runs…</div>
        ) : filteredRuns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-3xl mb-3">{tabFilter === "pending" ? "🚐" : "✅"}</p>
            <p className="text-gray-400 text-sm font-semibold">
              {tabFilter === "pending" ? "No pending runs. Create one above." : "No completed runs yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRuns.map(run => (
              <div key={run.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xl">{RUN_TYPE_ICON[run.run_type]}</span>
                      <span className="font-extrabold text-[#0D2240]">{RUN_TYPE_LABEL[run.run_type]}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[run.status]}`}>
                        {run.status}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        run.assigned_role === "driver"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {run.assigned_role}
                      </span>
                      {run.processing_mode && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          run.processing_mode === "own_operator"
                            ? "bg-blue-50 text-blue-600 border border-blue-200"
                            : "bg-purple-50 text-purple-600 border border-purple-200"
                        }`}>
                          {run.processing_mode === "own_operator" ? "🔵 Our Operator" : "🟣 Their Attendant"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      <strong>{run.facility_name ?? "Facility"}</strong>
                      {run.storage_space_name && (
                        <span className="text-gray-400"> ↔ <span className="text-indigo-600 font-semibold">📦 {run.storage_space_name}</span></span>
                      )}
                      {" · "}
                      {run.order_ids.length} order{run.order_ids.length !== 1 ? "s" : ""}
                      {" · Assigned to "}
                      <strong>{run.assigned_to}</strong>
                    </p>
                    {run.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{run.notes}"</p>
                    )}
                    {run.completed_at && (
                      <p className="text-xs text-green-600 mt-1 font-semibold">
                        ✅ Completed {new Date(run.completed_at).toLocaleString()} by {run.completed_by}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>Created {new Date(run.cre