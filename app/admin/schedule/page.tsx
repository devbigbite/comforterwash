"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  getCurrentPunches,
  getShiftsForWeek,
  getTimeSheet,
  getActiveWorkers,
  createShift,
  deleteShift,
  moveShift,
  clockOut,
  updatePunch,
  createPunch,
  deletePunch,
  } from "@/app/actions/staff"
import { minutesBetween, formatDuration, decimalHours } from "@/lib/staff-utils"
import type { TimePunch, ScheduledShift, ActiveWorker } from "@/app/actions/staff"
import { CircularTimePicker, timeValueFrom24h, timeValueTo24h } from "@/components/admin/circular-time-picker"

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

// "HH:MM" (24h, from a native time input) -> "11:00 PM" for display on the
// circular-picker trigger buttons.
function fmtHHMM(hhmm: string): string {
  if (!hhmm) return ""
  const [h, m] = hhmm.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return ""
  const ampm = h >= 12 ? "PM" : "AM"
  let hour = h % 12
  if (hour === 0) hour = 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

// "8-28-2026" -- local calendar date (see toLocalInputValue's note on why
// this can't be sliced off the raw ISO string directly).
function fmtDateShort(isoStr: string) {
  const local = toLocalInputValue(isoStr)
  if (!local) return ""
  const [y, m, d] = local.slice(0, 10).split("-")
  return `${parseInt(m, 10)}-${parseInt(d, 10)}-${y}`
}

// Convert a stored UTC ISO timestamp into the value a <input type="datetime-local">
// needs to *display the correct local time* — datetime-local always shows/edits in
// the browser's local timezone, so we have to do the UTC→local conversion by hand
// via the Date object's local getters (not by slicing the raw ISO string, which
// would just show the UTC clock digits as if they were local).
function toLocalInputValue(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Inverse: a datetime-local input's value ("YYYY-MM-DDTHH:mm") has no timezone of
// its own — the browser means it as local time. `new Date(...)` parses a
// timezone-less string as local time automatically, so toISOString() from there
// gives the correct UTC instant to store. (Previously this was done by blindly
// appending "Z", which mislabeled the admin's local input as if it were already
// UTC — off by the local UTC offset, which is what caused edited punches to show
// a clock-out before the clock-in.)
function localInputToISO(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  if (isNaN(d.getTime())) return ""
  return d.toISOString()
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

const ROLE_BLOCK: Record<string, string> = {
  driver:   "bg-blue-500",
  operator: "bg-violet-600",
  admin:    "bg-slate-500",
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// ── Component ─────────────────────────────────────────────────────────────────

// useSearchParams (used below to support the ?tab=timesheet deep link from
// the admin home page) requires a Suspense boundary around it in the app
// router, otherwise the build fails — so the real page body lives in
// AdminScheduleInner and the default export just wraps it.
export default function AdminSchedulePage() {
  return (
    <Suspense fallback={null}>
      <AdminScheduleInner />
    </Suspense>
  )
}

function AdminScheduleInner() {
  const searchParams = useSearchParams()
  // Lets other pages (e.g. the admin home "Timesheet" quick link) deep-link
  // straight into the timesheet tab via /admin/schedule?tab=timesheet.
  const initialTab = searchParams.get("tab") === "timesheet" ? "timesheet"
    : searchParams.get("tab") === "schedule" ? "schedule"
    : searchParams.get("tab") === "report" ? "report" : "now"
  const [tab, setTab] = useState<"now" | "schedule" | "timesheet" | "report">(initialTab)

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
  // Actual clocked minutes per worker for the visible week, keyed by
  // worker_name -- lets the schedule grid show "worked / scheduled" per
  // person instead of only what was scheduled.
  const [actualMinsByWorker, setActualMinsByWorker] = useState<Record<string, number>>({})

  // ── Time Sheet state ───────────────────────────────────────────────────────
  const [tsFrom, setTsFrom]       = useState(() => getMondayOf(new Date()))
  const [tsTo, setTsTo]           = useState(() => addDays(getMondayOf(new Date()), 6))
  const [punches, setPunches]     = useState<TimePunch[]>([])
  const [tsWorkers, setTsWorkers] = useState<ActiveWorker[]>([])
  const [tsLoading, setTsLoading] = useState(false)
  const [editPunchId, setEditPunchId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState({ clockedInAt: "", clockedOutAt: "", breakMinutes: "0", miles: "" })
  const [deletePunchId, setDeletePunchId] = useState<string | null>(null)
  // Which side of the currently-edited punch (if any) has the circular clock
  // picker open -- only one at a time, keyed by which field it edits.
  const [clockPickerFor, setClockPickerFor] = useState<"clockedInAt" | "clockedOutAt" | null>(null)
  const [shiftPickerFor, setShiftPickerFor] = useState<"startTime" | "endTime" | null>(null)
  // Drag-to-move / (Ctrl or Shift)+drag-to-copy a scheduled shift, à la
  // Sling/7shifts. `dragOverKey` is `${workerName}::${date}` of the cell
  // currently under the pointer, just for a visual drop-target highlight.
  const [draggingShift, setDraggingShift] = useState<ScheduledShift | null>(null)
  const [dragIsCopy, setDragIsCopy] = useState(false)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [deletingPunch, setDeletingPunch] = useState(false)
  // Time Sheet is grouped by worker (one collapsible section per person) so an
  // admin can scan one person's week at a time instead of re-reading the name
  // on every row of a long flat list. Collapsed-state is tracked per worker
  // name; a name not in the set is expanded (the default).
  const [collapsedWorkers, setCollapsedWorkers] = useState<Set<string>>(new Set())
  // Focusing the Time Sheet on one employee -- shows an Employee Info card
  // (name, id, email, role, hourly rate) above just that person's punches,
  // instead of the flat all-workers accordion. Set from the "View" link on
  // a worker's accordion header; cleared by "All Employees" to go back.
  const [focusedWorker, setFocusedWorker] = useState<string | null>(null)

  // ── Daily Summary report state ─────────────────────────────────────────────
  // A payroll-style grid: one row per worker, one column per day in a 14-day
  // window starting at rpStart, hours worked that day in each cell, totals
  // and pay at the end. Its own date range/data so it doesn't fight with the
  // Time Sheet tab's own From/To.
  const [rpStart, setRpStart]     = useState(() => addDays(getMondayOf(new Date()), -7))
  const [rpPunches, setRpPunches] = useState<TimePunch[]>([])
  const [rpWorkers, setRpWorkers] = useState<ActiveWorker[]>([])
  const [rpLoading, setRpLoading] = useState(false)

  // ── Add Punch state ────────────────────────────────────────────────────────
  const [showAddPunch, setShowAddPunch]   = useState(false)
  const [addPunchForm, setAddPunchForm]   = useState({
    workerName: "", role: "", date: new Date().toISOString().split("T")[0],
    startTime: "09:00", endTime: "", breakMinutes: "0", miles: "",
  })
  const [addPunchSaving, setAddPunchSaving] = useState(false)
  const [addPunchError,  setAddPunchError]  = useState<string | null>(null)

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
    const weekEnd = addDays(weekStart, 6)
    const [s, w, weekPunches] = await Promise.all([
      getShiftsForWeek(weekStart),
      getActiveWorkers(),
      getTimeSheet(weekStart, weekEnd),
    ])
    setShifts(s)
    setWorkers(w)
    const mins: Record<string, number> = {}
    for (const p of weekPunches) {
      if (!p.clocked_out_at) continue
      mins[p.worker_name] = (mins[p.worker_name] ?? 0)
        + Math.max(0, minutesBetween(p.clocked_in_at, p.clocked_out_at) - (p.break_minutes ?? 0))
    }
    setActualMinsByWorker(mins)
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

  const loadReport = useCallback(async () => {
    setRpLoading(true)
    const rpEnd = addDays(rpStart, 13)
    const [data, wkrs] = await Promise.all([getTimeSheet(rpStart, rpEnd), getActiveWorkers()])
    setRpPunches(data)
    setRpWorkers(wkrs)
    setRpLoading(false)
  }, [rpStart])

  useEffect(() => { if (tab === "now")       loadNow() },       [tab, loadNow])
  useEffect(() => { if (tab === "schedule")  loadSchedule() },  [tab, loadSchedule])
  useEffect(() => { if (tab === "report")    loadReport() },    [tab, loadReport])
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

  // Drop target for a dragged shift block: `copy` (Ctrl or Shift held)
  // creates a new shift on the target worker/day and leaves the original
  // in place; a plain drag repoints the original shift instead.
  async function handleDropShift(workerName: string, shiftDate: string, isCopy: boolean) {
    const s = draggingShift
    setDraggingShift(null)
    setDragOverKey(null)
    if (!s) return
    if (s.worker_name === workerName && s.shift_date === shiftDate) return // dropped on itself

    if (isCopy) {
      const fd = new FormData()
      fd.set("workerName", workerName)
      fd.set("role",       s.role)
      fd.set("shiftDate",  shiftDate)
      fd.set("startTime",  s.start_time.slice(0, 5))
      fd.set("endTime",    s.end_time.slice(0, 5))
      fd.set("notes",      s.notes ?? "")
      await createShift(fd)
    } else {
      await moveShift(s.id, workerName, shiftDate)
    }
    loadSchedule()
  }

  async function handleSaveEdit(punch: TimePunch) {
    const fd = new FormData()
    fd.append("punchId",        punch.id)
    fd.append("clockedInAt",    editForm.clockedInAt)
    fd.append("clockedOutAt",   editForm.clockedOutAt)
    fd.append("breakMinutes",   editForm.breakMinutes)
    // Only drivers earn mileage; sending "" for anyone else clears the column
    // rather than leaving a stale number behind after a role correction.
    fd.append("miles",          punch.role === "driver" ? editForm.miles : "")
    await updatePunch(fd)
    setEditPunchId(null)
    loadTimeSheet()
  }

  async function handleDeletePunch(punchId: string) {
    setDeletingPunch(true)
    await deletePunch(punchId)
    setDeletingPunch(false)
    setDeletePunchId(null)
    loadTimeSheet()
  }

  async function handleAddPunch(e: React.FormEvent) {
    e.preventDefault()
    setAddPunchSaving(true); setAddPunchError(null)
    const fd = new FormData()
    fd.set("workerName",   addPunchForm.workerName)
    fd.set("role",         addPunchForm.role)
    // Convert date+time to a real UTC ISO instant client-side, where the browser
    // knows the admin's local timezone — the server has no way to know that, so
    // building the timestamp there (as it used to) silently treated the wall-clock
    // time as UTC and stored it off by the local offset.
    fd.set("clockedInAt",  localInputToISO(`${addPunchForm.date}T${addPunchForm.startTime}`))
    fd.set("clockedOutAt", addPunchForm.endTime ? localInputToISO(`${addPunchForm.date}T${addPunchForm.endTime}`) : "")
    fd.set("breakMinutes", addPunchForm.breakMinutes)
    fd.set("miles",        addPunchForm.role === "driver" ? addPunchForm.miles : "")
    const result = await createPunch(fd)
    setAddPunchSaving(false)
    if (result?.error) { setAddPunchError(result.error); return }
    setShowAddPunch(false)
    setAddPunchForm({ workerName: "", role: "", date: new Date().toISOString().split("T")[0], startTime: "09:00", endTime: "", breakMinutes: "0", miles: "" })
    loadTimeSheet()
  }

  // ── Weekly schedule grid helpers ───────────────────────────────────────────
  const weekDates = DAYS.map((_, i) => addDays(weekStart, i))

  const shiftsOn = (date: string) => shifts.filter(s => s.shift_date === date)

  // ── Pay rate lookups: worker name → cents ──────────────────────────────────
  // Punches key off worker_name (staff_time_punches has no worker_id), so the
  // rates are looked up the same way.
  const wageMap: Record<string, number>     = {}
  const mileRateMap: Record<string, number> = {}
  tsWorkers.forEach(w => {
    wageMap[w.name]     = w.hourly_wage_cents ?? 0
    mileRateMap[w.name] = w.driver_per_mile_cents ?? 0
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Staff Schedule</h1>
        <p className="text-sm text-gray-400">Clock in/out records · Weekly roster · Time sheets</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(["now", "schedule", "timesheet", "report"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors capitalize ${
              tab === t ? "bg-white text-[#0D2240] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "now" ? "🟢 Right Now" : t === "schedule" ? "📅 Schedule" : t === "timesheet" ? "⏱ Time Sheet" : "🧾 Daily Summary"}
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
                const elapsed = punch ? minutesBetween(punch.clocked_in_at, null) - (punch.break_minutes ?? 0) : 0
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
      {tab === "schedule" && (() => {
        const today = new Date().toISOString().split("T")[0]

        // All worker names: active workers union shift workers
        const allScheduleWorkers = [
          ...new Set([
            ...workers.map(w => w.name),
            ...shifts.map(s => s.worker_name),
          ])
        ].sort()

        // Per-worker weekly hours
        function shiftMins(s: ScheduledShift) {
          const [sh, sm] = s.start_time.split(":").map(Number)
          const [eh, em] = s.end_time.split(":").map(Number)
          return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
        }

        const totalScheduledHours = shifts.reduce((acc, s) => acc + shiftMins(s), 0) / 60

        return (
          <div>
            {/* Week nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setWeekStart(w => addDays(w, -7))}
                className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors"
              >← Prev</button>
              <p className="font-extrabold text-[#0D2240] text-sm">
                {fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}
              </p>
              <button
                onClick={() => setWeekStart(w => addDays(w, 7))}
                className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors"
              >Next →</button>
            </div>

            {/* Compact stats cluster + Create Shift, right-aligned like a
                real scheduling tool's toolbar instead of a row of separate
                cards. */}
            <div className="flex items-center justify-end gap-6 mb-4">
              <div className="text-right">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">OT Hours</p>
                <p className="text-[#0D2240] font-extrabold text-base tabular-nums">
                  {formatDuration(Math.max(0, ...allScheduleWorkers.map(name =>
                    shifts.filter(s => s.worker_name === name).reduce((acc, s) => acc + shiftMins(s), 0) - 40 * 60
                  ), 0))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Shifts</p>
                <p className="text-[#0D2240] font-extrabold text-base tabular-nums">{shifts.length}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Scheduled Hours</p>
                <p className="text-[#0D2240] font-extrabold text-base tabular-nums">{formatDuration(Math.round(totalScheduledHours * 60))}</p>
              </div>
              <button
                onClick={() => {
                  setNewShift(n => ({ ...n, workerName: "", shiftDate: weekStart }))
                  setShowAddShift(true)
                }}
                className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors shrink-0"
              >+ Create Shift</button>
            </div>

            {/* Sling-style grid */}
            {schedLoading ? (
              <p className="text-gray-400 text-sm text-center py-12">Loading…</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: "700px" }}>
                  {/* Header row */}
                  <thead>
                    <tr>
                      <th className="bg-gray-50 border-b border-r border-gray-100 px-4 py-3 text-left w-44">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Staff</span>
                      </th>
                      {weekDates.map((date, i) => {
                        const isToday = date === today
                        return (
                          <th key={date} className={`border-b border-r border-gray-100 px-2 py-2.5 text-center ${isToday ? "bg-[#E8726A]/8" : "bg-gray-50"}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? "text-[#E8726A]" : "text-gray-400"}`}>{DAYS[i]}</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${isToday ? "text-[#E8726A]" : "text-[#0D2240]"}`}>
                              {new Date(date + "T12:00:00").getDate()}
                            </p>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {allScheduleWorkers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                          No workers yet. Add workers via the Workers page, then create shifts.
                        </td>
                      </tr>
                    ) : (
                      allScheduleWorkers.map(workerName => {
                        const workerObj  = workers.find(w => w.name === workerName)
                        const weekShifts = shifts.filter(s => s.worker_name === workerName)
                        const weekMins   = weekShifts.reduce((acc, s) => acc + shiftMins(s), 0)
                        const firstRole  = weekShifts[0]?.role ?? workerObj?.roles?.[0] ?? "driver"
                        const initials   = workerName.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()

                        return (
                          <tr key={workerName} className="border-b border-gray-100 last:border-0">
                            {/* Worker label */}
                            <td className="border-r border-gray-100 px-3 py-2 w-44">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold text-white shrink-0 ${ROLE_BLOCK[firstRole] ?? "bg-slate-500"}`}>
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-[#0D2240] text-xs leading-tight truncate">{workerName}</p>
                                  {/* worked / scheduled -- worked comes from actual clock-in/out
                                      punches this week, scheduled from the shifts on this grid.
                                      They match once a shift is worked as planned; they diverge
                                      when someone works unscheduled hours or misses a shift. */}
                                  <p className="text-[10px] text-gray-400 tabular-nums">
                                    {formatDuration(actualMinsByWorker[workerName] ?? 0)} / {formatDuration(weekMins)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Day cells */}
                            {weekDates.map(date => {
                              const dayShifts = shifts.filter(s => s.worker_name === workerName && s.shift_date === date)
                              const isToday   = date === today
                              const cellKey = `${workerName}::${date}`
                              return (
                                <td
                                  key={date}
                                  className={`relative border-r border-gray-100 p-1 align-top group/cell transition-colors ${isToday ? "bg-[#E8726A]/5" : ""} ${dragOverKey === cellKey ? (dragIsCopy ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : "bg-indigo-50 ring-2 ring-inset ring-indigo-400") : ""}`}
                                  style={{ minWidth: "80px", minHeight: "56px" }}
                                  onDragOver={e => {
                                    if (!draggingShift) return
                                    e.preventDefault()
                                    const copy = e.ctrlKey || e.shiftKey
                                    e.dataTransfer.dropEffect = copy ? "copy" : "move"
                                    if (dragOverKey !== cellKey) setDragOverKey(cellKey)
                                    if (dragIsCopy !== copy) setDragIsCopy(copy)
                                  }}
                                  onDragLeave={() => { if (dragOverKey === cellKey) setDragOverKey(null) }}
                                  onDrop={e => {
                                    e.preventDefault()
                                    handleDropShift(workerName, date, e.ctrlKey || e.shiftKey)
                                  }}
                                >
                                  {dayShifts.map(s => (
                                    <div
                                      key={s.id}
                                      draggable
                                      onDragStart={e => {
                                        setDraggingShift(s)
                                        e.dataTransfer.effectAllowed = "copyMove"
                                        e.dataTransfer.setData("text/plain", s.id)
                                      }}
                                      onDragEnd={() => { setDraggingShift(null); setDragOverKey(null) }}
                                      className={`group/shift relative rounded-lg px-2 py-1 mb-1 text-white text-[10px] cursor-grab active:cursor-grabbing ${ROLE_BLOCK[s.role] ?? "bg-slate-500"} ${draggingShift?.id === s.id ? "opacity-40" : ""}`}
                                      title="Drag to move -- hold Ctrl or Shift while dragging to copy"
                                    >
                                      <p className="font-bold leading-tight tabular-nums">
                                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                                      </p>
                                      <p className="capitalize opacity-70" style={{ fontSize: "9px" }}>{s.role}</p>
                                      {s.notes && <p className="opacity-50 truncate" style={{ fontSize: "9px" }}>{s.notes}</p>}
                                      <button
                                        onClick={() => handleDeleteShift(s.id)}
                                        className="absolute top-0.5 right-1 opacity-0 group-hover/shift:opacity-100 font-bold hover:text-red-200 transition-opacity text-xs leading-none"
                                      >×</button>
                                    </div>
                                  ))}
                                  {/* Hover "+" to add shift for this worker on this day */}
                                  <button
                                    onClick={() => {
                                      setNewShift(n => ({ ...n, workerName, shiftDate: date }))
                                      setShowAddShift(true)
                                    }}
                                    className="absolute bottom-1 right-1 opacity-0 group-hover/cell:opacity-100 w-5 h-5 bg-gray-200 hover:bg-[#0D2240] hover:text-white text-gray-500 rounded font-bold text-xs flex items-center justify-center transition-all"
                                  >+</button>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Shift Modal */}
            {showAddShift && (
              <div
                className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                onClick={() => setShowAddShift(false)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-extrabold text-[#0D2240] text-lg">New Shift</h3>
                    <button onClick={() => setShowAddShift(false)} className="text-gray-300 hover:text-gray-500 text-2xl font-bold leading-none">×</button>
                  </div>

                  <form onSubmit={handleAddShift} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Worker</label>
                        <select
                          value={newShift.workerName}
                          onChange={e => setNewShift(n => ({ ...n, workerName: e.target.value }))}
                          required
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
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
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                        >
                          <option value="">— Role —</option>
                          <option value="driver">🚐 Driver</option>
                          <option value="operator">🏭 Operator</option>
                          <option value="admin">⚙️ Admin</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date</label>
                      <input
                        type="date"
                        value={newShift.shiftDate}
                        onChange={e => setNewShift(n => ({ ...n, shiftDate: e.target.value }))}
                        required
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Start</label>
                        <button
                          type="button"
                          onClick={() => setShiftPickerFor("startTime")}
                          className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none hover:border-[#0D2240] transition-colors"
                        >
                          <span>{fmtHHMM(newShift.startTime) || "Select"}</span>
                          <span aria-hidden>🕐</span>
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">End</label>
                        <button
                          type="button"
                          onClick={() => setShiftPickerFor("endTime")}
                          className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none hover:border-[#0D2240] transition-colors"
                        >
                          <span>{fmtHHMM(newShift.endTime) || "Select"}</span>
                          <span aria-hidden>🕐</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={newShift.notes}
                        onChange={e => setNewShift(n => ({ ...n, notes: e.target.value }))}
                        placeholder="e.g. Cover for Maria"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] outline-none focus:border-[#0D2240] transition-colors"
                      />
                    </div>

                    {shiftError && <p className="text-red-500 text-sm font-semibold">{shiftError}</p>}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={shiftSaving}
                        className="flex-1 bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                      >
                        {shiftSaving ? "Saving…" : "Save Shift"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddShift(false)}
                        className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm py-3 rounded-xl transition-colors"
                      >Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          {/* Add Punch Modal */}
        {showAddPunch && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddPunch(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-extrabold text-[#0D2240] text-lg">Add Punch</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Manually log a clock-in/out record</p>
                </div>
                <button onClick={() => setShowAddPunch(false)} className="text-gray-300 hover:text-gray-500 text-2xl font-bold leading-none">×</button>
              </div>

              <form onSubmit={handleAddPunch} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Worker</label>
                    <select
                      value={addPunchForm.workerName}
                      onChange={e => setAddPunchForm(f => ({ ...f, workerName: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    >
                      <option value="">— Select —</option>
                      {tsWorkers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Role</label>
                    <select
                      value={addPunchForm.role}
                      onChange={e => setAddPunchForm(f => ({ ...f, role: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    >
                      <option value="">— Role —</option>
                      <option value="driver">🚐 Driver</option>
                      <option value="operator">🏭 Operator</option>
                      <option value="admin">⚙️ Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date</label>
                  <input
                    type="date"
                    value={addPunchForm.date}
                    onChange={e => setAddPunchForm(f => ({ ...f, date: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Clock In</label>
                    <input
                      type="time"
                      value={addPunchForm.startTime}
                      onChange={e => setAddPunchForm(f => ({ ...f, startTime: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Clock Out <span className="normal-case font-normal text-gray-300">(optional)</span></label>
                    <input
                      type="time"
                      value={addPunchForm.endTime}
                      onChange={e => setAddPunchForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                </div>

                <div className={addPunchForm.role === "driver" ? "grid grid-cols-2 gap-3" : ""}>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Break (minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={addPunchForm.breakMinutes}
                      onChange={e => setAddPunchForm(f => ({ ...f, breakMinutes: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                  {/* Mileage applies to drivers only, and prices out from the
                      per-mile rate on the worker's own profile. */}
                  {addPunchForm.role === "driver" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Miles driven</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0.0"
                        value={addPunchForm.miles}
                        onChange={e => setAddPunchForm(f => ({ ...f, miles: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                      />
                      {addPunchForm.workerName && (
                        (mileRateMap[addPunchForm.workerName] ?? 0) === 0 ? (
                          <p className="text-[10px] text-yellow-600 font-semibold mt-1">
                            No per-mile rate on this worker&apos;s profile — miles are recorded but pay $0.
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-400 mt-1">
                            {(parseFloat(addPunchForm.miles || "0") || 0).toFixed(1)} mi × $
                            {((mileRateMap[addPunchForm.workerName] ?? 0) / 100).toFixed(2)}/mi ={" "}
                            <span className="font-bold text-green-600">
                              ${(((parseFloat(addPunchForm.miles || "0") || 0) * (mileRateMap[addPunchForm.workerName] ?? 0)) / 100).toFixed(2)}
                            </span>
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>

                {addPunchError && <p className="text-red-500 text-sm font-semibold">{addPunchError}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={addPunchSaving}
                    className="flex-1 bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                  >
                    {addPunchSaving ? "Saving…" : "Save Punch"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPunch(false)}
                    className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm py-3 rounded-xl transition-colors"
                  >Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        </div>
        )
      })()}

      {/* ── TIME SHEET ──────────────────────────────────────────────────────── */}
      {tab === "timesheet" && (() => {
        // Per-worker totals: minutes worked, hourly pay, and driver mileage pay.
        // Mileage is additive — a driver earns their hourly wage for the shift
        // *plus* their per-mile rate for the miles logged on it.
        const totals: Record<string, {
          mins: number; payCents: number; wageCents: number
          miles: number; mileCents: number
        }> = {}
        punches.forEach(p => {
          if (!p.clocked_out_at) return
          const mins = Math.max(0, minutesBetween(p.clocked_in_at, p.clocked_out_at) - (p.break_minutes ?? 0))
          const wage = wageMap[p.worker_name] ?? 0
          const pay  = Math.round((mins / 60) * wage)
          // Miles only pay out on driver punches, at that worker's mile rate.
          const miles     = p.role === "driver" ? (Number(p.miles) || 0) : 0
          const mileCents = Math.round(miles * (mileRateMap[p.worker_name] ?? 0))
          if (!totals[p.worker_name]) {
            totals[p.worker_name] = { mins: 0, payCents: 0, wageCents: wage, miles: 0, mileCents: 0 }
          }
          totals[p.worker_name].mins      += mins
          totals[p.worker_name].payCents  += pay + mileCents
          totals[p.worker_name].miles     += miles
          totals[p.worker_name].mileCents += mileCents
        })
        const grandPayCents = Object.values(totals).reduce((s, t) => s + t.payCents, 0)
        const hasWages      = Object.values(totals).some(t => t.wageCents > 0 || t.mileCents > 0)
        const grandMiles    = Object.values(totals).reduce((s, t) => s + t.miles, 0)
        const grandMileCents = Object.values(totals).reduce((s, t) => s + t.mileCents, 0)

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
            <button
              onClick={() => setShowAddPunch(true)}
              className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors ml-auto"
            >+ Add Punch</button>
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
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 mb-4 flex items-center justify-between shadow-sm" style={{ borderTop: "3px solid #059669" }}>
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Total Payroll</p>
                <p className="text-[#0D2240] font-extrabold text-3xl mt-0.5">
                  ${(grandPayCents / 100).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs">{Object.keys(totals).length} workers</p>
                <p className="text-gray-400 text-xs">
                  {formatDuration(Object.values(totals).reduce((s, t) => s + t.mins, 0))} total
                  {" · "}
                  {decimalHours(Object.values(totals).reduce((s, t) => s + t.mins, 0))} hrs
                </p>
                {grandMileCents > 0 && (
                  <p className="text-blue-500 text-xs font-semibold">
                    incl. ${(grandMileCents / 100).toFixed(2)} mileage · {grandMiles.toFixed(1)} mi
                  </p>
                )}
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
                  <p className="text-gray-400 text-xs mt-0.5">{decimalHours(t.mins)} hrs</p>
                  {t.wageCents > 0 || t.mileCents > 0 ? (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-green-600 font-extrabold text-base">${(t.payCents / 100).toFixed(2)}</p>
                      <p className="text-gray-300 text-[10px]">${(t.wageCents / 100).toFixed(2)}/hr</p>
                      {t.mileCents > 0 && (
                        <p className="text-blue-500 text-[10px] font-semibold">
                          + ${(t.mileCents / 100).toFixed(2)} · {t.miles.toFixed(1)} mi
                        </p>
                      )}
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

          {/* Punch records — grouped by worker so you can scan one person's
              week at a time instead of re-reading a name on every row of a
              long flat list. Ordered by total hours worked (busiest first),
              same order as the summary cards above. */}
          {!tsLoading && punches.length > 0 && (() => {
            const flagStyles: Record<string, string> = {
              unscheduled: "bg-red-50 text-red-600 border-red-200",
              early_in:    "bg-amber-50 text-amber-600 border-amber-200",
              late_in:     "bg-amber-50 text-amber-600 border-amber-200",
              early_out:   "bg-orange-50 text-orange-600 border-orange-200",
              late_out:    "bg-orange-50 text-orange-600 border-orange-200",
            }
            const flagText: Record<string, string> = {
              unscheduled: "Unscheduled",
              early_in:    "Early in",
              late_in:     "Late in",
              early_out:   "Early out",
              late_out:    "Late out",
            }

            let workerOrder = Object.entries(totals).sort((a, b) => b[1].mins - a[1].mins).map(([name]) => name)
            // Any worker with punches but no completed shift yet (still active,
            // so not in `totals`) still needs a section — append them at the end.
            for (const p of punches) if (!workerOrder.includes(p.worker_name)) workerOrder.push(p.worker_name)
            // Employee focus: "View" on a worker's header (below) narrows the
            // whole list down to just them, with an Info card above it.
            if (focusedWorker) workerOrder = workerOrder.filter(n => n === focusedWorker)
            const focusedWorkerObj = focusedWorker ? tsWorkers.find(w => w.name === focusedWorker) : null

            function toggleWorker(name: string) {
              setCollapsedWorkers(prev => {
                const next = new Set(prev)
                if (next.has(name)) next.delete(name); else next.add(name)
                return next
              })
            }

            return (
              <div className="space-y-3">
                {focusedWorker && (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-1">
                    <div className="flex items-center justify-between px-5 py-2.5 bg-[#0D2240]">
                      <span className="text-white font-extrabold text-xs uppercase tracking-widest">Employee Info</span>
                      <button
                        onClick={() => setFocusedWorker(null)}
                        className="text-white/70 hover:text-white text-xs font-bold"
                      >← All Employees</button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</p>
                        <p className="text-[#0D2240] font-bold text-sm mt-0.5">{focusedWorker}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee ID</p>
                        <p className="text-[#0D2240] font-bold text-sm mt-0.5 font-mono">{focusedWorkerObj?.id.slice(0, 8) ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</p>
                        <p className="text-[#0D2240] font-bold text-sm mt-0.5 capitalize">{focusedWorkerObj?.roles?.join(", ") || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hourly Rate</p>
                        <p className="text-[#0D2240] font-bold text-sm mt-0.5">
                          {focusedWorkerObj?.hourly_wage_cents ? `$${(focusedWorkerObj.hourly_wage_cents / 100).toFixed(2)}` : "Not set"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {workerOrder.map(workerName => {
                  const workerPunches = punches
                    .filter(p => p.worker_name === workerName)
                    .sort((a, b) => b.clocked_in_at.localeCompare(a.clocked_in_at))
                  if (workerPunches.length === 0) return null
                  const t = totals[workerName]
                  const collapsed = collapsedWorkers.has(workerName)
                  const wageCents     = wageMap[workerName] ?? 0
                  const mileRateCents = mileRateMap[workerName] ?? 0

                  return (
                    <div key={workerName} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      {/* Worker header — click to expand/collapse */}
                      <button
                        onClick={() => toggleWorker(workerName)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`text-gray-400 text-xs transition-transform ${collapsed ? "" : "rotate-90"}`}>▶</span>
                          <span className="font-bold text-[#0D2240] text-sm">{workerName}</span>
                          <span className="text-gray-300 text-xs">{workerPunches.length} punch{workerPunches.length === 1 ? "" : "es"}</span>
                          {!focusedWorker && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={e => { e.stopPropagation(); setFocusedWorker(workerName) }}
                              className="text-[#2FA8A0] hover:underline text-xs font-bold"
                            >View</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#0D2240] text-sm tabular-nums">
                            {formatDuration(t?.mins ?? 0)}
                            {/* Decimal hours is what payroll multiplies by the
                                rate, so show it next to the h/m reading. */}
                            <span className="text-gray-400 font-semibold ml-1.5">({decimalHours(t?.mins ?? 0)})</span>
                          </span>
                          {(t?.miles ?? 0) > 0 && (
                            <span className="text-blue-500 text-xs font-semibold tabular-nums">
                              🚗 {(t?.miles ?? 0).toFixed(1)} mi
                            </span>
                          )}
                          {wageCents > 0 || (t?.mileCents ?? 0) > 0 ? (
                            <span className="font-bold text-green-600 text-sm tabular-nums">${((t?.payCents ?? 0) / 100).toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">No rate</span>
                          )}
                        </div>
                      </button>

                      {/* Individual punches */}
                      {!collapsed && (
                        <div className="divide-y divide-gray-50">
                          {workerPunches.map(punch => {
                            const isEditing = editPunchId === punch.id
                            const isDeleting = deletePunchId === punch.id
                            const mins = punch.clocked_out_at
                              ? Math.max(0, minutesBetween(punch.clocked_in_at, punch.clocked_out_at) - (punch.break_minutes ?? 0))
                              : null
                            const hourCents = mins !== null && wageCents > 0
                              ? Math.round((mins / 60) * wageCents)
                              : null
                            const punchMiles = punch.role === "driver" ? (Number(punch.miles) || 0) : 0
                            const mileCents  = Math.round(punchMiles * mileRateCents)
                            // null means "nothing to pay yet" (still clocked in,
                            // or no rates configured) — not "$0.00".
                            const payCents = hourCents === null && mileCents === 0
                              ? null
                              : (hourCents ?? 0) + mileCents

                            if (isDeleting) return (
                              <div key={punch.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-red-50">
                                <p className="text-sm text-red-700">
                                  Delete this punch — <strong>{toLocalInputValue(punch.clocked_in_at).slice(0, 10)}</strong>,{" "}
                                  {fmtTime(punch.clocked_in_at)}
                                  {punch.clocked_out_at ? ` – ${fmtTime(punch.clocked_out_at)}` : " (still active)"}? This can't be undone.
                                </p>
                                <div className="flex gap-2 shrink-0">
                                  <button
                                    onClick={() => handleDeletePunch(punch.id)}
                                    disabled={deletingPunch}
                                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                                  >{deletingPunch ? "Deleting…" : "Delete"}</button>
                                  <button onClick={() => setDeletePunchId(null)}
                                    className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-lg">Cancel</button>
                                </div>
                              </div>
                            )

                            if (isEditing) return (
                              <div key={punch.id} className="px-4 py-3 bg-blue-50">
                                <div className={`grid gap-2 items-end ${punch.role === "driver" ? "grid-cols-4" : "grid-cols-3"}`}>
                                  <div>
                                    <label className="text-xs text-gray-400 font-bold">Clock In</label>
                                    <div className="flex gap-1 mt-0.5">
                                      <input type="date" value={toLocalInputValue(editForm.clockedInAt).slice(0, 10)}
                                        onChange={e => {
                                          const time = toLocalInputValue(editForm.clockedInAt).slice(10) || "T09:00"
                                          setEditForm(f => ({ ...f, clockedInAt: localInputToISO(`${e.target.value}${time}`) }))
                                        }}
                                        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                                      {/* Circular clock picker instead of a raw time input -- click to open
                                          the dial (hour, then minute) rather than typing digits. */}
                                      <button type="button" onClick={() => setClockPickerFor("clockedInAt")}
                                        className="shrink-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-[#0D2240] hover:border-[#0D2240] transition-colors">
                                        🕐 {editForm.clockedInAt ? fmtTime(editForm.clockedInAt) : "Set"}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-400 font-bold">Clock Out</label>
                                    <div className="flex gap-1 mt-0.5">
                                      <input type="date" value={toLocalInputValue(editForm.clockedOutAt).slice(0, 10)}
                                        onChange={e => {
                                          const time = toLocalInputValue(editForm.clockedOutAt).slice(10) || "T17:00"
                                          setEditForm(f => ({ ...f, clockedOutAt: localInputToISO(`${e.target.value}${time}`) }))
                                        }}
                                        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                                      <button type="button" onClick={() => setClockPickerFor("clockedOutAt")}
                                        className="shrink-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-[#0D2240] hover:border-[#0D2240] transition-colors">
                                        🕐 {editForm.clockedOutAt ? fmtTime(editForm.clockedOutAt) : "Set"}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-400 font-bold">Break (min)</label>
                                    <input type="number" min="0" value={editForm.breakMinutes}
                                      onChange={e => setEditForm(f => ({ ...f, breakMinutes: e.target.value }))}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none mt-0.5" />
                                  </div>
                                  {punch.role === "driver" && (
                                    <div>
                                      <label className="text-xs text-gray-400 font-bold">Miles</label>
                                      <input type="number" min="0" step="0.1" placeholder="0.0" value={editForm.miles}
                                        onChange={e => setEditForm(f => ({ ...f, miles: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none mt-0.5" />
                                    </div>
                                  )}
                                </div>
                                {punch.role === "driver" && mileRateCents > 0 && (
                                  <p className="text-[10px] text-gray-400 mt-1.5">
                                    {(parseFloat(editForm.miles || "0") || 0).toFixed(1)} mi × ${(mileRateCents / 100).toFixed(2)}/mi ={" "}
                                    <span className="font-bold text-green-600">
                                      ${(((parseFloat(editForm.miles || "0") || 0) * mileRateCents) / 100).toFixed(2)}
                                    </span> mileage, on top of hourly
                                  </p>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => handleSaveEdit(punch)}
                                    className="bg-[#0D2240] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Save</button>
                                  <button onClick={() => setEditPunchId(null)}
                                    className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-lg">Cancel</button>
                                </div>
                              </div>
                            )

                            return (
                              <div key={punch.id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm">
                                {/* Full date + time on both sides, always -- no separate role
                                    column, no relying on a badge to notice a shift crosses
                                    midnight. "8-28-2026 10:00 PM  to  8-29-2026 3:00 AM" reads
                                    correctly on its own with nothing to compare against. */}
                                <div className="w-48 shrink-0 text-gray-700 font-semibold tabular-nums">
                                  {fmtDateShort(punch.clocked_in_at)} {fmtTime(punch.clocked_in_at)}
                                </div>
                                <div className="w-6 shrink-0 text-gray-300 text-center text-xs">to</div>
                                <div className="w-48 shrink-0 tabular-nums">
                                  {punch.clocked_out_at
                                    ? <span className="text-gray-700 font-semibold">{fmtDateShort(punch.clocked_out_at)} {fmtTime(punch.clocked_out_at)}</span>
                                    : <span className="text-green-500 font-bold text-xs">Active ●</span>}
                                </div>
                                <div className="w-16 shrink-0 font-bold text-[#0D2240] tabular-nums leading-tight">
                                  {mins !== null ? formatDuration(mins) : "—"}
                                  {mins !== null && (
                                    <span className="block text-[10px] font-semibold text-gray-400">{decimalHours(mins)}</span>
                                  )}
                                </div>
                                <div className="w-20 shrink-0 tabular-nums">
                                  {payCents !== null ? (
                                    <span className="font-bold text-green-600">${(payCents / 100).toFixed(2)}</span>
                                  ) : wageCents === 0 ? (
                                    <span className="text-gray-300 text-xs">No rate</span>
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </div>
                                {punch.schedule_flag && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase shrink-0 ${flagStyles[punch.schedule_flag] ?? ""}`}>
                                    ⚠ {flagText[punch.schedule_flag] ?? punch.schedule_flag}{punch.flag_minutes ? ` ${punch.flag_minutes}m` : ""}
                                  </span>
                                )}
                                {punch.break_minutes > 0 && (
                                  <span className="text-gray-300 text-xs shrink-0">−{punch.break_minutes}m break</span>
                                )}
                                {punchMiles > 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                                    🚗 {punchMiles.toFixed(1)} mi{mileCents > 0 ? ` · $${(mileCents / 100).toFixed(2)}` : ""}
                                  </span>
                                )}
                                <div className="ml-auto flex gap-3 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditPunchId(punch.id)
                                      setEditForm({
                                        clockedInAt:  punch.clocked_in_at,
                                        clockedOutAt: punch.clocked_out_at ?? "",
                                        breakMinutes: String(punch.break_minutes ?? 0),
                                        miles:        punch.miles != null ? String(punch.miles) : "",
                                      })
                                    }}
                                    className="text-gray-300 hover:text-gray-500 text-xs font-bold transition-colors"
                                  >Edit</button>
                                  <button
                                    onClick={() => setDeletePunchId(punch.id)}
                                    className="text-gray-300 hover:text-red-500 text-xs font-bold transition-colors"
                                  >Delete</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        {/* Add Punch Modal */}
        {showAddPunch && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddPunch(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-extrabold text-[#0D2240] text-lg">Add Punch</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Manually log a clock-in/out record</p>
                </div>
                <button onClick={() => setShowAddPunch(false)} className="text-gray-300 hover:text-gray-500 text-2xl font-bold leading-none">×</button>
              </div>

              <form onSubmit={handleAddPunch} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Worker</label>
                    <select
                      value={addPunchForm.workerName}
                      onChange={e => setAddPunchForm(f => ({ ...f, workerName: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    >
                      <option value="">— Select —</option>
                      {tsWorkers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Role</label>
                    <select
                      value={addPunchForm.role}
                      onChange={e => setAddPunchForm(f => ({ ...f, role: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    >
                      <option value="">— Role —</option>
                      <option value="driver">🚐 Driver</option>
                      <option value="operator">🏭 Operator</option>
                      <option value="admin">⚙️ Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date</label>
                  <input
                    type="date"
                    value={addPunchForm.date}
                    onChange={e => setAddPunchForm(f => ({ ...f, date: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Clock In</label>
                    <input
                      type="time"
                      value={addPunchForm.startTime}
                      onChange={e => setAddPunchForm(f => ({ ...f, startTime: e.target.value }))}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Clock Out <span className="normal-case font-normal text-gray-300">(optional)</span></label>
                    <input
                      type="time"
                      value={addPunchForm.endTime}
                      onChange={e => setAddPunchForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                </div>

                <div className={addPunchForm.role === "driver" ? "grid grid-cols-2 gap-3" : ""}>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Break (minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={addPunchForm.breakMinutes}
                      onChange={e => setAddPunchForm(f => ({ ...f, breakMinutes: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                    />
                  </div>
                  {/* Mileage applies to drivers only, and prices out from the
                      per-mile rate on the worker's own profile. */}
                  {addPunchForm.role === "driver" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Miles driven</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0.0"
                        value={addPunchForm.miles}
                        onChange={e => setAddPunchForm(f => ({ ...f, miles: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                      />
                      {addPunchForm.workerName && (
                        (mileRateMap[addPunchForm.workerName] ?? 0) === 0 ? (
                          <p className="text-[10px] text-yellow-600 font-semibold mt-1">
                            No per-mile rate on this worker&apos;s profile — miles are recorded but pay $0.
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-400 mt-1">
                            {(parseFloat(addPunchForm.miles || "0") || 0).toFixed(1)} mi × $
                            {((mileRateMap[addPunchForm.workerName] ?? 0) / 100).toFixed(2)}/mi ={" "}
                            <span className="font-bold text-green-600">
                              ${(((parseFloat(addPunchForm.miles || "0") || 0) * (mileRateMap[addPunchForm.workerName] ?? 0)) / 100).toFixed(2)}
                            </span>
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>

                {addPunchError && <p className="text-red-500 text-sm font-semibold">{addPunchError}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={addPunchSaving}
                    className="flex-1 bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                  >
                    {addPunchSaving ? "Saving…" : "Save Punch"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPunch(false)}
                    className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm py-3 rounded-xl transition-colors"
                  >Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        </div>
        )
      })()}

      {/* -- DAILY SUMMARY -------------------------------------------------- */}
      {tab === "report" && (() => {
        const rpEnd   = addDays(rpStart, 13)
        const rpDates = Array.from({ length: 14 }, (_, i) => addDays(rpStart, i))
        const wage: Record<string, number> = {}
        rpWorkers.forEach(w => { wage[w.name] = w.hourly_wage_cents ?? 0 })

        // minsByWorkerDay["Melissa Bello"]["2026-02-18"] = worked minutes that day
        const minsByWorkerDay: Record<string, Record<string, number>> = {}
        const roleByWorker: Record<string, string> = {}
        rpPunches.forEach(p => {
          if (!p.clocked_out_at) return
          const day  = toLocalInputValue(p.clocked_in_at).slice(0, 10)
          const mins = Math.max(0, minutesBetween(p.clocked_in_at, p.clocked_out_at) - (p.break_minutes ?? 0))
          minsByWorkerDay[p.worker_name] ??= {}
          minsByWorkerDay[p.worker_name][day] = (minsByWorkerDay[p.worker_name][day] ?? 0) + mins
          roleByWorker[p.worker_name] ??= p.role
        })

        let reportWorkers = Object.keys(minsByWorkerDay).sort((a, b) => a.localeCompare(b))
        if (reportWorkers.length === 0 && !rpLoading) reportWorkers = []

        const grandTotalMins = reportWorkers.reduce(
          (sum, w) => sum + Object.values(minsByWorkerDay[w]).reduce((a, b) => a + b, 0), 0
        )
        const grandTotalPayCents = reportWorkers.reduce((sum, w) => {
          const totalMins = Object.values(minsByWorkerDay[w]).reduce((a, b) => a + b, 0)
          return sum + Math.round((totalMins / 60) * (wage[w] ?? 0))
        }, 0)

        return (
          <div>
            {/* Report parameters */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Start Date</label>
                  <input
                    type="date"
                    value={rpStart}
                    onChange={e => setRpStart(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none focus:border-[#0D2240] transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-400 pb-2.5">
                  {fmtDateShort(rpStart + "T00:00:00")} – {fmtDateShort(rpEnd + "T00:00:00")} (14 days)
                </p>
                <button
                  onClick={loadReport}
                  className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors ml-auto"
                >Run Report</button>
              </div>
            </div>

            {rpLoading && <p className="text-gray-400 text-sm text-center py-8">Loading…</p>}

            {!rpLoading && reportWorkers.length === 0 && (
              <div className="bg-gray-50 rounded-2xl px-6 py-8 text-center">
                <p className="text-gray-500 font-semibold">No punches found for this period.</p>
              </div>
            )}

            {!rpLoading && reportWorkers.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-[#0D2240]">
                  <span className="text-white font-extrabold text-xs uppercase tracking-widest">Employee Daily Summary — Two Weeks</span>
                  <span className="text-white/70 text-xs">Records: {reportWorkers.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left font-bold text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap">Employee</th>
                        <th className="text-left font-bold text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap">Role</th>
                        {rpDates.map(d => {
                          const dt = new Date(d + "T00:00:00")
                          return (
                            <th key={d} className="text-center font-bold text-gray-500 uppercase tracking-wider px-2 py-2 whitespace-nowrap">
                              {dt.toLocaleDateString("en-US", { weekday: "short" })}<br />
                              <span className="font-mono normal-case">{fmtDateShort(d + "T00:00:00").slice(0, 5)}</span>
                            </th>
                          )
                        })}
                        <th className="text-right font-bold text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap">Total Hours</th>
                        <th className="text-right font-bold text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap">Hourly Rate</th>
                        <th className="text-right font-bold text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap">Total Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportWorkers.map(w => {
                        const totalMins = Object.values(minsByWorkerDay[w]).reduce((a, b) => a + b, 0)
                        const wageCents = wage[w] ?? 0
                        const payCents  = Math.round((totalMins / 60) * wageCents)
                        return (
                          <tr key={w} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 font-bold text-[#0D2240] whitespace-nowrap">{w}</td>
                            <td className="px-3 py-2 text-gray-500 capitalize whitespace-nowrap">{roleByWorker[w] ?? "—"}</td>
                            {rpDates.map(d => {
                              const mins = minsByWorkerDay[w]?.[d] ?? 0
                              return (
                                <td key={d} className="px-2 py-2 text-center tabular-nums text-gray-700">
                                  {mins > 0 ? decimalHours(mins) : "0.00"}
                                </td>
                              )
                            })}
                            <td className="px-3 py-2 text-right font-bold text-[#0D2240] tabular-nums whitespace-nowrap">{decimalHours(totalMins)}</td>
                            <td className="px-3 py-2 text-right text-gray-500 tabular-nums whitespace-nowrap">{wageCents > 0 ? `$${(wageCents / 100).toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2 text-right font-bold text-green-600 tabular-nums whitespace-nowrap">{wageCents > 0 ? `$${(payCents / 100).toFixed(2)}` : "—"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td className="px-3 py-2 font-extrabold text-[#0D2240]" colSpan={2}>Total</td>
                        {rpDates.map(d => (
                          <td key={d} className="px-2 py-2 text-center tabular-nums text-gray-400 font-semibold">
                            {decimalHours(reportWorkers.reduce((s, w) => s + (minsByWorkerDay[w]?.[d] ?? 0), 0))}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-extrabold text-[#0D2240] tabular-nums">{decimalHours(grandTotalMins)}</td>
                        <td></td>
                        <td className="px-3 py-2 text-right font-extrabold text-green-700 tabular-nums">${(grandTotalPayCents / 100).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Circular clock picker modal -- shared by the Clock In / Clock Out
          buttons in the Time Sheet edit row, wherever that row currently is. */}
      {clockPickerFor && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setClockPickerFor(null)}>
          <div onClick={e => e.stopPropagation()}>
            <CircularTimePicker
              initial={(() => {
                const iso = editForm[clockPickerFor]
                const local = toLocalInputValue(iso)
                if (!local) return timeValueFrom24h(9, 0)
                const [h, m] = local.slice(11).split(":").map(Number)
                return timeValueFrom24h(h, m)
              })()}
              onCancel={() => setClockPickerFor(null)}
              onApply={v => {
                const { hour24, minute } = timeValueTo24h(v)
                const field = clockPickerFor
                setEditForm(f => {
                  const currentIso = f[field]
                  const datePart = toLocalInputValue(currentIso).slice(0, 10) || new Date().toISOString().slice(0, 10)
                  const pad = (n: number) => String(n).padStart(2, "0")
                  return { ...f, [field]: localInputToISO(`${datePart}T${pad(hour24)}:${pad(minute)}`) }
                })
                setClockPickerFor(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Circular clock picker modal for the New Shift form's Start / End
          buttons above -- newShift.startTime / endTime are plain "HH:MM"
          24h strings (native <input type="time"> shape), not ISO. */}
      {shiftPickerFor && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setShiftPickerFor(null)}>
          <div onClick={e => e.stopPropagation()}>
            <CircularTimePicker
              initial={(() => {
                const hhmm = newShift[shiftPickerFor]
                if (!hhmm) return timeValueFrom24h(9, 0)
                const [h, m] = hhmm.split(":").map(Number)
                if (isNaN(h) || isNaN(m)) return timeValueFrom24h(9, 0)
                return timeValueFrom24h(h, m)
              })()}
              onCancel={() => setShiftPickerFor(null)}
              onApply={v => {
                const { hour24, minute } = timeValueTo24h(v)
                const field = shiftPickerFor
                const pad = (n: number) => String(n).padStart(2, "0")
                setNewShift(n => ({ ...n, [field]: `${pad(hour24)}:${pad(minute)}` }))
                setShiftPickerFor(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
