"use client"

import { useState, useEffect, useRef } from "react"
import {
  getActiveWorkers,
  getOpenPunch,
  clockIn,
  clockOut,
  } from "@/app/actions/staff"
import { minutesBetween, formatDuration } from "@/lib/staff-utils"
import type { ActiveWorker, TimePunch } from "@/app/actions/staff"

const ROLE_LABELS: Record<string, string> = {
  driver:   "🚐 Driver",
  operator: "🏭 Operator",
  admin:    "⚙️ Admin",
}

export default function StaffClockPage() {
  const [workers, setWorkers]         = useState<ActiveWorker[]>([])
  const [selectedName, setSelectedName] = useState("")
  const [selectedRole, setSelectedRole] = useState("")
  const [openPunch, setOpenPunch]     = useState<TimePunch | null>(null)
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [done, setDone]               = useState<"in" | "out" | null>(null)
  const [breakMinutes, setBreakMinutes] = useState("0")
  const [elapsedMins, setElapsedMins] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load workers once
  useEffect(() => {
    getActiveWorkers().then(list => {
      setWorkers(list)
      setLoading(false)
    })
  }, [])

  // When name changes, check if already clocked in
  useEffect(() => {
    if (!selectedName) { setOpenPunch(null); return }
    getOpenPunch(selectedName).then(punch => {
      setOpenPunch(punch)
      if (punch) setElapsedMins((punch.clocked_in_at, null))
    })
  }, [selectedName])

  // Live timer when clocked in
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (openPunch) {
      timerRef.current = setInterval(() => {
        setElapsedMins((openPunch.clocked_in_at, null))
      }, 60000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [openPunch])

  // Derive available roles for the selected worker
  const workerObj = workers.find(w => w.name === selectedName)
  const availableRoles = workerObj?.roles ?? []

  // Auto-select role if only one option
  useEffect(() => {
    if (availableRoles.length === 1) setSelectedRole(availableRoles[0])
    else setSelectedRole(openPunch?.role ?? "")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName, openPunch])

  async function handleClockIn() {
    if (!selectedName || !selectedRole) { setError("Select your name and role"); return }
    setSubmitting(true); setError(null)
    const fd = new FormData()
    fd.append("workerName", selectedName)
    fd.append("role",       selectedRole)
    const result = await clockIn(fd)
    setSubmitting(false)
    if (result?.error) { setError(result.error); return }
    setOpenPunch(result.punch ?? null)
    setElapsedMins(0)
    setDone("in")
    setTimeout(() => setDone(null), 3000)
  }

  async function handleClockOut() {
    if (!openPunch) return
    setSubmitting(true); setError(null)
    const fd = new FormData()
    fd.append("punchId",      openPunch.id)
    fd.append("breakMinutes", breakMinutes)
    const result = await clockOut(fd)
    setSubmitting(false)
    if (result?.error) { setError(result.error); return }
    setOpenPunch(null)
    setElapsedMins(0)
    setDone("out")
    setTimeout(() => setDone(null), 3000)
  }

  const netMinutes = elapsedMins - (parseInt(breakMinutes || "0", 10) || 0)

  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">
          🕐
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Staff Clock</h1>
        <p className="text-white/50 text-sm">WashFold Orlando</p>
      </div>

      <div className="px-4 space-y-4 pb-10 max-w-sm mx-auto w-full">

        {loading && (
          <div className="text-center py-8">
            <p className="text-white/30 text-sm">Loading…</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Name selector */}
            <div className="bg-white rounded-2xl p-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Your Name
              </label>
              <select
                value={selectedName}
                onChange={e => { setSelectedName(e.target.value); setError(null); setDone(null) }}
                className="w-full border-2 border-gray-200 focus:border-[#0D2240] rounded-xl px-3 py-2.5 text-[#0D2240] font-semibold text-sm outline-none transition-colors bg-white appearance-none cursor-pointer"
              >
                <option value="">— Select your name —</option>
                {workers.map(w => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Role selector — only show when multiple roles available and not clocked in */}
            {selectedName && availableRoles.length > 1 && !openPunch && (
              <div className="bg-white rounded-2xl p-4">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Role Today
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`py-3 rounded-xl font-bold text-sm transition-colors ${
                        selectedRole === role
                          ? "bg-[#0D2240] text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {ROLE_LABELS[role] ?? role}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Currently clocked in — show timer */}
            {selectedName && openPunch && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-5 text-center">
                <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">Currently Clocked In</p>
                <p className="text-white font-extrabold text-4xl mb-1 tabular-nums">
                  {(elapsedMins)}
                </p>
                <p className="text-white/40 text-xs">
                  {ROLE_LABELS[openPunch.role] ?? openPunch.role} · since {new Date(openPunch.clocked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>

                {/* Break deduction */}
                <div className="mt-4 bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-white/60 text-xs font-semibold shrink-0">Break (min)</span>
                  <input
                    type="number"
                    min="0"
                    max="240"
                    value={breakMinutes}
                    onChange={e => setBreakMinutes(e.target.value)}
                    className="w-16 bg-white/20 text-white font-bold text-center rounded-lg px-2 py-1 text-sm outline-none"
                  />
                  {parseInt(breakMinutes || "0") > 0 && (
                    <span className="text-white/40 text-xs">Net: {(netMinutes)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Success flash */}
            {done && (
              <div className="bg-white/10 rounded-2xl px-4 py-3 text-center">
                <p className="text-white font-bold">
                  {done === "in" ? "✅ Clocked in! Have a great shift." : "👋 Clocked out. See you next time!"}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-4 py-3">
                <p className="text-red-300 text-sm font-semibold">{error}</p>
              </div>
            )}

            {/* Action button */}
            {selectedName && (
              openPunch ? (
                <button
                  onClick={handleClockOut}
                  disabled={submitting}
                  className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-lg py-5 rounded-2xl transition-colors shadow-lg"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Clocking out…
                    </span>
                  ) : "🏁 Clock Out"}
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  disabled={submitting || !selectedRole}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-extrabold text-lg py-5 rounded-2xl transition-colors shadow-lg"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Clocking in…
                    </span>
                  ) : "▶ Clock In"}
                </button>
              )
            )}

            {!selectedName && (
              <div className="bg-white/5 rounded-2xl px-5 py-6 text-center">
                <p className="text-white/30 text-sm">Select your name above to clock in or out.</p>
              </div>
            )}
          </>
        )}

        <div className="text-center pt-2">
          <a href="/driver" className="text-white/20 text-xs hover:text-white/40 transition-colors mr-4">Driver →</a>
          <a href="/operator" className="text-white/20 text-xs hover:text-white/40 transition-colors">Operator →</a>
        </div>
      </div>
    </div>
  )
}
