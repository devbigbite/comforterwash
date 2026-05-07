"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getCurrentPunches,
  getShiftsForWeek,
  getTimeSheet,
  getActiveWorkers,
  createShift,
  deleteShift,
  clockOut,
  updatePunch,
  formatDuration,
  minutesBetween,
} from "@/app/actions/staff"
import type { TimePunch, ScheduledShift, ActiveWorker } from "@/app/actions/staff"

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split("T")[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split("T")[0]
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function fmtTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

const ROLE_COLOR: Record<string, string> = {
  driver:   "bg-blue-100 text-blue-700",
  operator: "bg-purple-100 text-purple-700",
  admin:    "bg-gray-100 text-gray-600",
}

const ROLE_DOT: Record<string, string> = {
  driver:   "bg-blue-400",
  operator: "bg-purple-400",
  admin:    "bg-gray-400",
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminSchedulePage() {
  const [tab, setTab] = useState<"now" | "schedule" | "timesheet">("now")

  // ── Right Now state ────────────────────────────────────────────────────────
  const [currentPunches, setCurrentPunches] = useState<TimePunch[]>([])
  const [allWorkers, setAllWorkers]         = useState<ActiveWorker[]>([])
  const [nowLoading, setNowLoading]         = useState(true)
  const [clockOutId, setClockOutId]         = useState<string | null>(null)
  const [tick, setTick]                     = useState(0)

  // ── Schedule state ─────────────────────────────────────────────────────────
  const [weekStart, setWeekStart]   = useState(() => getMondayOf(new Date()))
  const [shifts, setShifts]         = useState<ScheduledShift[]>([])
  const [workers, setWorkers]       = useState<ActiveWorker[]>([])
  const [schedLoading, setSchedLoading] = useState(true)
  const [showAddShift, setShowAddShift] = useState(false)
  const [newShift, setNewShift]     = useState({
    workerName: "", role: "", shiftDate: addDays(getMondayOf(new Date()), 0), startTime: "09:00", endTime: "17:00", notes: ""
  })
  const [shiftSaving, setShiftSaving] = useState(false)
  const [shiftError, setShiftError]   = useState<string | null>(null)

  // ── Time Sheet state ───────────────────────────────────────────────────────
  const [tsFrom, setTsFrom]       = useState(() => getMondayOf(new Date()))
  const [tsTo, setTsTo]           = useState(() => addDays(getMondayOf(new Date()), 6))
  const [punches, setPunches]     = useState<TimePunch[]>([])
  const [tsWorkers, setTsWorkers] = useState<ActiveWorker[]>([])
  const [tsLoading, setTsLoading] = useState(false)
  const [editPunchId, setEditPunchId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState({ clockedInAt: "", clockedOutAt: "", breakMinutes: "0" })

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadNow = useCallback(async () => {
    setNowLoading(true)
    const [punches, wkrs] = await Promise.all([getCurrentPunches(), getActiveWorkers()])
    setCurrentPunches(punches)
    setAllWorkers(wkrs)
    setNowLoading(false)
  }, [])

  const loadSchedule = useCallback(async () => {
    setSchedLoading(true)
    const [s, w] = await Promise.all([getShiftsForWeek(weekStart), getActiveWorkers()])
    setShifts(s)
    setWorkers(w)
    setSchedLoading(false)
  }, [weekStart])

  const loadTimeSheet = useCallback(async () => {
    setTsLoading(true)
    const [data, wkrs] = await Promise.all([getTimeSheet(tsFrom, tsTo), getActiveWorkers()])
    setPunches(data)
    // Merge wage map into existing workers if schedule tab hasn't loaded yet
    setWorkers(prev => prev.length > 0 ? prev : wkrs)
    setTsWorkers(wkrs)
    setTsLoading(false)
  }, [tsFrom, tsTo])

  useEffect(() => { if (tab === "now")       loadNow() },       [tab, loadNow])
  useEffect(() => { if (tab === "schedule")  loadSchedule() },  [tab, loadSchedule])
  useEffect(() => { if (tab === "timesheet") loadTimeSheet() }, [tab, loadTimeSheet])

  // Tick every minute to keep elapsed timers fresh
  useEffect(() => {
    if (tab !== "now") return
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [tab])

  // ── Auto-update role when worker changes ───────────────────────────────────
  useEffect(() => {
    const w = workers.find(x => x.name === newShift.workerName)
    if (w?.roles?.length === 1) setNewShift(n => ({ ...n, role: w.roles[0] }))
  }, [newShift.workerName, workers])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleAdminClockOut(punch: TimePunch) {
    setClockOutId(punch.id)
    const fd = new FormData()
    fd.append("punchId", punch.id)
    fd.append("breakMinutes", "0")
    await clockOut(fd)
    setClockOutId(null)
    loadNow()
  }

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault()
    setShiftSaving(true); setShiftError(null)
    const fd = new FormData()
    Object.entries(newShift).forEach(([k, v]) => fd.append(k === "workerName" ? "workerName" : k === "shiftDate" ? "shiftDate" : k === "startTime" ? "startTime" : k === "endTime" ? "endTime" : k, v))
    fd.set("workerName", newShift.workerName)
    fd.set("role",       newShift.role)
    fd.set("shiftDate",  newShift.shiftDate)
    fd.set("startTime",  newShift.startTime)
    fd.set("endTime",    newShift.endTime)
    fd.set("notes",      newShift.notes)
    const result = await createShift(fd)
    setShiftSaving(false)
    if (result?.error) { setShiftError(result.error); return }
    setShowAddShift(false)
    loadSchedule()
  }

  async function handleDeleteShift(id: string) {
    await deleteShift(id)
    loadSchedule()
  }

  async function handleSaveEdit(punch: TimePunch) {
    const fd = new FormData()
    fd.append("punchId",        punch.id)
    fd.append("clockedInAt",    editForm.clockedInAt)
    fd.append("clockedOutAt",   editForm.clockedOutAt)
    fd.append("breakMinutes",   editForm.breakMinutes)
    await updatePunch(fd)
    setEditPunchId(null)
    loadTimeSheet()
  }

  // ── Weekly schedule grid helpers ───────────────────────────────────────────
  const weekDates = DAYS.map((_, i) => addDays(weekStart, i))

  const shiftsOn = (date: string) => shifts.filter(s => s.shift_date === date)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Staff Schedule</h1>
        <p className="text-sm text-gray-400">Clock in/out records · Weekly roster · Time sheets</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(["now", "schedule", "timesheet"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors capitalize ${
              tab === t ? "bg-white text-[#0D2240] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "now" ? "🟢 Right Now" : t === "schedule" ? "📅 Schedule" : "⏱ Time Sheet"}
          </button>
        ))}
      </div>

      {/* ── RIGHT NOW ───────────────────────────────────────────────────────── */}
      {tab === "now" && (
        <div>
          {/* Status bar */}
          <div className="flex items-center justify-between mb-5">
            {nowLoading ? (
              <p className="text-gray-400 text-sm">Loading…</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-bold text-[#0D2240]">
                    {currentPunches.length} In
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="font-bold text-gray-400">
                    {allWorkers.length - currentPunches.length} Out
                  </span>
                </div>
                <div className="text-gray-300 text-sm">
                  of {allWorkers.length} staff
                </div>
              </div>
            )}
            <button
              onClick={loadNow}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              ↻ Refresh
            </button>
          </div>

          {/* Visual status board */}
          {!nowLoading && allWorkers.length === 0 && (
            <div className="bg-gray-50 rounded-2xl px-6 py-8 text-center">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-gray-500 font-semibold">No active workers yet.</p>
              <p className="text-gray-400 text-sm mt-1">Add workers via the Workers page, then mark them active.</p>
            </div>
          )}

          {!nowLoading && allWorkers.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {allWorkers.map(worker => {
                // Find their open punch (may be multiple roles — show most recent)
                const punch = currentPunches.find(p => p.worker_name === worker.name) ?? null
                const isIn  = punch !== null
                // `tick` triggers re-render every minute so elapsed time updates live
                const elapsed = punch ? minutesBetween(punch.clocked_in_at, null) - (punch.break_minutes ?? 0) + (tick * 0) : 0
                // Determine display role: clocked-in role, or first role in their list
                const displayRole = punch?.role ?? worker.roles?.[0] ?? "driver"

                return (
                  <div
                    key={worker.id}
                    className={`relative rounded-2xl border-2 p-4 transition-all ${
                      isIn
                        ? "border-green-300 bg-green-50 shadow-md shadow-green-100"
                        : "border-gray-200 bg-white opacity-60"
                    }`}
                  >
                    {/* Status dot — top right */}
                    <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${
                      isIn ? "bg-green-400 animate-pulse" : "bg-gray-300"
                    }`} />

                    {/* Role icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${
                      isIn ? "bg-green-100" : "bg-gray-100"
                    }`}>
                      {displayRole === "driver" ? "🚐" : displayRole === "operator" ? "🏭" : "⚙️"}
                    </div>

                    {/* Name */}
                    <p className={`font-bold text-sm leading-tight mb-0.5 ${isIn ? "text-[#0D2240]" : "text-gray-400"}`}>
                      {worker.name}
                    </p>

                    {/* Role badge */}
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      isIn ? ROLE_COLOR[displayRole] ?? "bg-gray-100 text-gray-600" : "bg-gray-100 text-gray-400"
                    }`}>
                      {displayRole}
                    </span>

                    {/* Clocked-in info */}
                    {isIn && punch && (
                      <div className="mt-2.5 space-y-0.5">
                        <p className="text-green-700 font-extrabold text-lg tabular-nums leading-none">
                          {formatDuration(elapsed)}
                        </p>
                        <p className="text-green-600/60 text-xs">
                          since {fmtTime(punch.clocked_in_at)}
                        </p>
                      </div>
                    )}

                    {/* Out indicator */}
                    {!isIn && (
                      <p className="mt-2.5 text-gray-300 text-xs font-semibold uppercase tracking-widest">
                        Off clock
                      </p>
                    )}

                    {/* Admin clock-out button */}
                    {isIn && punch && (
                      <button
                        onClick={() => handleAdminClockOut(punch)}
                        disabled={clockOutId === punch.id}
                        className="mt-3 w-full bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-400 hover:text-red-500 text-xs font-bold py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {clockOutId === punch.id ? "…" : "Clock Out"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!nowLoading && allWorkers.length > 0 && (
            <p className="text-xs text-gray-300 text-center mt-5">
              Updates every minute · Staff clock in/out at <strong className="text-gray-400">/staff</strong>
            </p>
          )}
        </div>
      )}

      {/* ── SCHEDULE ────────────────────────────────────────────────────────── */}
      {tab === "schedule" && (
        <div>
          {/* Week nav */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors"
            >← Prev</button>
            <div className="text-center">
              <p className="font-extrabold text-[#0D2240] text-sm">
                {fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}
              </p>
            </div>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors"
            >Next →</button>
          </div>

          {/* Weekly grid */}
          {schedLoading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
          ) : (
            <div className="grid grid-cols-7 gap-2 mb-4">
              {DAYS.map((day, i) => {
                const date    = weekDates[i]
                const isToday = date === new Date().toISOString().split("T")[0]
                const dayShifts = shiftsOn(date)
                return (
                  <div key={day} className={`rounded-xl border min-h-[100px] ${isToday ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-200 bg-white"}`}>
                    <div className={`px-2 py-1.5 border-b text-xs font-bold ${isToday ? "border-[#E8726A]/30 text-[#E8726A]" : "border-gray-100 text-gray-500"}`}>
                      <span className="block">{day}</span>
                      <span className="font-normal text-gray-400">{new Date(date + "T12:00:00").getDate()}</span>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {dayShifts.map(s => (
                        <div key={s.id} className="group relative bg-blue-50 rounded-lg px-1.5 py-1 text-[10px]">
                          <p className="font-bold text-[#0D2240] truncate leading-tight">{s.worker_name}</p>
                          <p className="text-gray-500">{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</p>
                          <span className={`inline-block mt-0.5 px-1.5 rounded-full font-bold capitalize ${ROLE_COLOR[s.role]}`}
                            style={{ fontSize: "9px" }}>
                            {s.role}
                          </span>
                          <button
                            onClick={() => handleDeleteShift(s.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity"
                          >×</button>
                        </div>
                      ))}
                      {dayShifts.length === 0 && (
                        <p className="text-gray-200 text-[10px] text-center py-1">—</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add shift */}
          <button
            onClick={() => setShowAddShift(v => !v)}
            className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {showAddShift ? "✕ Cancel" : "+ Add Shift"}
          </button>

          {showAddShift && (
            <form onSubmit={handleAddShift} className="mt-4 bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-[#0D2240] text-sm">New Shift</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Worker</label>
                  <select
                    value={newShift.workerName}
                    onChange={e => setNewShift(n => ({ ...n, workerName: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                  >
                    <option value="">— Select —</option>
                    {workers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Role</label>
                  <select
                    value={newShift.role}
                    onChange={e => setNewShift(n => ({ ...n, role: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                  >
                    <option value="">— Role —</option>
                    <option value="driver">Driver</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date</label>
                  <input
                    type="date"
                    value={newShift.shiftDate}
                    onChange={e => setNewShift(n => ({ ...n, shiftDate: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Start</label>
                    <input
                      type="time"
                      value={newShift.startTime}
                      onChange={e => setNewShift(n => ({ ...n, startTime: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">End</label>
                    <input
                      type="time"
                      value={newShift.endTime}
                      onChange={e => setNewShift(n => ({ ...n, endTime: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={newShift.notes}
                  onChange={e => setNewShift(n => ({ ...n, notes: e.target.value }))}
                  placeholder="e.g. Cover for Maria"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] outline-none focus:border-[#0D2240] transition-colors"
                />
              </div>

              {shiftError && <p className="text-red-500 text-sm font-semibold">{shiftError}</p>}

              <button
                type="submit"
                disabled={shiftSaving}
                className="bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                {shiftSaving ? "Saving…" : "Save Shift"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── TIME SHEET ──────────────────────────────────────────────────────── */}
      {tab === "timesheet" && (() => {
        // Build wage lookup: worker name → hourly_wage_cents
        const wageMap: Record<string, number> = {}
        tsWorkers.forEach(w => { wageMap[w.name] = w.hourly_wage_cents ?? 0 })

        // Per-worker totals: mins worked + pay cents
        const totals: Record<string, { mins: number; payCents: number; wageCents: number }> = {}
        punches.forEach(p => {
          if (!p.clocked_out_at) return
          const mins = Math.max(0, minutesBetween(p.clocked_in_at, p.clocked_out_at) - (p.break_minutes ?? 0))
          const wage = wageMap[p.worker_name] ?? 0
          const pay  = Math.round((mins / 60) * wage)
          if (!totals[p.worker_name]) totals[p.worker_name] = { mins: 0, payCents: 0, wageCents: wage }
          totals[p.worker_name].mins     += mins
          totals[p.worker_name].payCents += pay
        })
        const grandPayCents = Object.values(totals).reduce((s, t) => s + t.payCents, 0)
        const hasWages      = Object.values(totals).some(t => t.wageCents > 0)

        return (
        <div>
          {/* Date range picker */}
          <div className="flex items-end gap-3 mb-5 flex-wrap">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">From</label>
              <input type="date" value={tsFrom} onChange={e => setTsFrom(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">To</label>
              <input type="date" value={tsTo} onChange={e => setTsTo(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors" />
            </div>
            <button
              onClick={loadTimeSheet}
              className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
            >Load</button>
          </div>

          {/* No-wage notice */}
          {!tsLoading && Object.keys(totals).length > 0 && !hasWages && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              <p className="text-amber-700 text-sm">
                No hourly wages set. Go to <strong>Workers → Set Pay Rates</strong> to add an hourly wage per worker.
              </p>
            </div>
          )}

          {/* Grand total banner */}
          {!tsLoading && hasWages && grandPayCents > 0 && (
            <div className="bg-[#0D2240] rounded-2xl px-5 py-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Total Payroll</p>
                <p className="text-white font-extrabold text-3xl mt-0.5">
                  ${(grandPayCents / 100).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-xs">{Object.keys(totals).length} workers</p>
                <p className="text-white/40 text-xs">
                  {formatDuration(Object.values(totals).reduce((s, t) => s + t.mins, 0))} total
                </p>
              </div>
            </div>
          )}

          {/* Per-worker summary cards */}
          {!tsLoading && Object.keys(totals).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {Object.entries(totals).sort((a, b) => b[1].mins - a[1].mins).map(([name, t]) => (
                <div key={name} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                  <p className="font-bold text-[#0D2240] text-sm truncate">{name}</p>
                  <p className="text-2xl font-extrabold text-[#0D2240] mt-1">{formatDuration(t.mins)}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{(t.mins / 60).toFixed(1)}h</p>
                  {t.wageCents > 0 ? (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-green-600 font-extrabold text-base">${(t.payCents / 100).toFixed(2)}</p>
                      <p className="text-gray-300 text-[10px]">${(t.wageCents / 100).toFixed(2)}/hr</p>
                    </div>
                  ) : (
                    <p className="text-gray-300 text-[10px] mt-2">No wage set</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tsLoading && <p className="text-gray-400 text-sm text-center py-8">Loading…</p>}

          {!tsLoading && punches.length === 0 && (
            <div className="bg-gray-50 rounded-2xl px-6 py-8 text-center">
              <p className="text-gray-500 font-semibold">No punches found for this period.</p>
            </div>
          )}

          {/* Punch records */}
          {!tsLoading && punches.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Worker</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">In</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Out</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Hrs</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Pay</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {punches.map(punch => {
                    const isEditing = editPunchId === punch.id
                    const mins = punch.clocked_out_at
                      ? Math.max(0, minutesBetween(punch.clocked_in_at, punch.clocked_out_at) - (punch.break_minutes ?? 0))
                      : null
                    const wageCents = wageMap[punch.worker_name] ?? 0
                    const payCents  = mins !== null && wageCents > 0
                      ? Math.round((mins / 60) * wageCents)
                      : null

                    if (isEditing) return (
                      <tr key={punch.id} className="border-b border-gray-50 bg-blue-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div>
                              <label className="text-xs text-gray-400 font-bold">Clock In</label>
                              <input type="datetime-local" value={editForm.clockedInAt.slice(0,16)}
                                onChange={e => setEditForm(f => ({ ...f, clockedInAt: e.target.value + ":00Z" }))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none mt-0.5" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 font-bold">Clock Out</label>
                              <input type="datetime-local" value={(editForm.clockedOutAt || "").slice(0,16)}
                                onChange={e => setEditForm(f => ({ ...f, clockedOutAt: e.target.value + ":00Z" }))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none mt-0.5" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 font-bold">Break (min)</label>
                              <input type="number" min="0" value={editForm.breakMinutes}
                                onChange={e => setEditForm(f => ({ ...f, breakMinutes: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none mt-0.5" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleSaveEdit(punch)}
                              className="bg-[#0D2240] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Save</button>
                            <button onClick={() => setEditPunchId(null)}
                              className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-lg">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )

                    return (
                      <tr key={punch.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-[#0D2240]">{punch.worker_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${ROLE_COLOR[punch.role]}`}>
                            {punch.role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                          {fmtTime(punch.clocked_in_at)}
                          <br/><span className="text-gray-300 text-xs">{punch.clocked_in_at.split("T")[0]}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                          {punch.clocked_out_at ? fmtTime(punch.clocked_out_at) : <span className="text-green-500 font-bold text-xs">Active ●</span>}
                          {punch.break_minutes > 0 && <span className="text-gray-300 text-xs block">−{punch.break_minutes}m break</span>}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-[#0D2240] tabular-nums">
                          {mins !== null ? formatDuration(mins) : "—"}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {payCents !== null ? (
                            <span className="font-bold text-green-600">${(payCents / 100).toFixed(2)}</span>
                          ) : wageCents === 0 ? (
                            <span className="text-gray-300 text-xs">No rate</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => {
                              setEditPunchId(punch.id)
                              setEditForm({
                                clockedInAt:  punch.clocked_in_at,
                                clockedOutAt: punch.clocked_out_at ?? "",
                                breakMinutes: String(punch.break_minutes ?? 0),
                              })
                            }}
                            className="text-gray-300 hover:text-gray-500 text-xs font-bold transition-colors"
                          >Edit</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )
      })()}
      )}
    </div>
  )
}
