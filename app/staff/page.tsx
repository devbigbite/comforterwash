"use client"

import { useState, useEffect, useRef } from "react"
import {
  getActiveWorkers,
  getOpenPunch,
  clockIn,
  clockOut,
  verifyWorkerPin,
} from "@/app/actions/staff"
import { minutesBetween, formatDuration } from "@/lib/staff-utils"
import type { ActiveWorker, TimePunch, ScheduleWarning } from "@/app/actions/staff"

const ROLE_LABELS: Record<string, string> = {
  driver:   "🚐 Driver",
  operator: "🏭 Operator",
  admin:    "⚙️ Admin",
}

const FLAG_LABELS: Record<string, { label: string; color: string }> = {
  unscheduled: { label: "Not scheduled today", color: "text-red-300" },
  early_in:    { label: "Clocking in early",   color: "text-amber-300" },
  late_in:     { label: "Clocking in late",     color: "text-amber-300" },
  early_out:   { label: "Clocking out early",   color: "text-amber-300" },
  late_out:    { label: "Clocking out late",    color: "text-amber-300" },
}

type Step = "select" | "pin" | "warning" | "ready"

export default function StaffClockPage() {
  const [workers, setWorkers]             = useState<ActiveWorker[]>([])
  const [selectedName, setSelectedName]   = useState("")
  const [selectedRole, setSelectedRole]   = useState("")
  const [openPunch, setOpenPunch]         = useState<TimePunch | null>(null)
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [done, setDone]                   = useState<"in" | "out" | null>(null)
  const [breakMinutes, setBreakMinutes]   = useState("0")
  const [elapsedMins, setElapsedMins]     = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // PIN flow
  const [step, setStep]         = useState<Step>("select")
  const [pin, setPin]           = useState("")
  const [pinError, setPinError] = useState("")
  const [noPinSet, setNoPinSet] = useState(false)

  // Schedule warning (Level 2)
  const [warning, setWarning]   = useState<ScheduleWarning | null>(null)

  useEffect(() => {
    getActiveWorkers().then(list => { setWorkers(list); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!selectedName) { setOpenPunch(null); setStep("select"); return }
    getOpenPunch(selectedName).then(punch => {
      setOpenPunch(punch)
      if (punch) {
        setElapsedMins(minutesBetween(punch.clocked_in_at, null))
        setStep("pin")   // still need PIN to clock out
      }
    })
  }, [selectedName])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (openPunch) {
      timerRef.current = setInterval(() => {
        setElapsedMins(minutesBetween(openPunch.clocked_in_at, null))
      }, 60000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [openPunch])

  const workerObj      = workers.find(w => w.name === selectedName)
  const availableRoles = workerObj?.roles ?? []

  useEffect(() => {
    if (availableRoles.length === 1) setSelectedRole(availableRoles[0])
    else setSelectedRole(openPunch?.role ?? "")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName, openPunch])

  // ── PIN pad handler ──────────────────────────────────────────────
  function handlePinDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setPinError("")
    if (next.length === 4) handlePinSubmit(next)
  }

  function handlePinDelete() { setPin(p => p.slice(0, -1)); setPinError("") }

  async function handlePinSubmit(p: string) {
    const { valid, noPinSet: noPin } = await verifyWorkerPin(selectedName, p)
    if (noPin) { setNoPinSet(true); setStep("ready"); return }
    if (!valid) { setPin(""); setPinError("Incorrect PIN. Try again."); return }
    setStep("ready")
  }

  // ── Clock in ─────────────────────────────────────────────────────
  async function handleClockIn(confirmed = false) {
    if (!selectedName || !selectedRole) { setError("Select your name and role"); return }
    setSubmitting(true); setError(null)
    const fd = new FormData()
    fd.append("workerName", selectedName)
    fd.append("role",       selectedRole)
    if (confirmed) fd.append("confirmed", "true")
    const result = await clockIn(fd)
    setSubmitting(false)
    if (!result) return
    if ("error" in result && result.error) { setError(result.error); return }
    if ("scheduleWarning" in result && result.scheduleWarning) {
      setWarning(result.scheduleWarning)
      setStep("warning")
      return
    }
    if ("punch" in result) {
      setOpenPunch(result.punch ?? null)
      setElapsedMins(0)
      setWarning(null)
      setDone("in")
      setTimeout(() => setDone(null), 3500)
    }
  }

  // ── Clock out ────────────────────────────────────────────────────
  async function handleClockOut(confirmed = false) {
    if (!openPunch) return
    setSubmitting(true); setError(null)
    const fd = new FormData()
    fd.append("punchId",      openPunch.id)
    fd.append("breakMinutes", breakMinutes)
    if (confirmed) fd.append("confirmed", "true")
    const result = await clockOut(fd)
    setSubmitting(false)
    if (!result) return
    if ("error" in result && result.error) { setError(result.error); return }
    if ("scheduleWarning" in result && result.scheduleWarning) {
      setWarning(result.scheduleWarning)
      setStep("warning")
      return
    }
    setOpenPunch(null); setElapsedMins(0); setWarning(null)
    setPin(""); setStep("select"); setSelectedName(""); setSelectedRole("")
    setDone("out")
    setTimeout(() => setDone(null), 3500)
  }

  const netMinutes = elapsedMins - (parseInt(breakMinutes || "0", 10) || 0)

  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">🕐</div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Staff Clock</h1>
        <p className="text-white/50 text-sm">WashFold Orlando</p>
      </div>

      <div className="px-4 space-y-4 pb-10 max-w-sm mx-auto w-full">

        {loading && <div className="text-center py-8"><p className="text-white/30 text-sm">Loading…</p></div>}

        {!loading && (
          <>
            {/* ── Step 1: Name selector ── */}
            <div className="bg-white rounded-2xl p-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Your Name</label>
              <select
                value={selectedName}
                onChange={e => {
                  setSelectedName(e.target.value)
                  setPin(""); setPinError(""); setStep(e.target.value ? "pin" : "select")
                  setError(null); setDone(null); setWarning(null)
                }}
                className="w-full border-2 border-gray-200 focus:border-[#0D2240] rounded-xl px-3 py-2.5 text-[#0D2240] font-semibold text-sm outline-none transition-colors bg-white appearance-none cursor-pointer"
              >
                <option value="">— Select your name —</option>
                {workers.map(w => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* ── Step 2: Role (multi-role workers, not clocked in) ── */}
            {selectedName && availableRoles.length > 1 && !openPunch && step !== "warning" && (
              <div className="bg-white rounded-2xl p-4">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Role Today</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map(role => (
                    <button key={role} type="button" onClick={() => setSelectedRole(role)}
                      className={`py-3 rounded-xl font-bold text-sm transition-colors ${
                        selectedRole === role ? "bg-[#0D2240] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {ROLE_LABELS[role] ?? role}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 3: PIN pad ── */}
            {selectedName && (step === "pin" || (step === "ready" && false)) && (
              <div className="bg-white rounded-2xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-4">Enter Your PIN</p>

                {/* Dots */}
                <div className="flex justify-center gap-4 mb-5">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-all ${
                      i < pin.length ? "bg-[#0D2240] scale-110" : "bg-gray-200"
                    }`} />
                  ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2">
                  {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
                    <button key={i} type="button"
                      onClick={() => d === "⌫" ? handlePinDelete() : d ? handlePinDigit(d) : undefined}
                      disabled={!d}
                      className={`h-14 rounded-2xl font-bold text-xl transition-all ${
                        !d ? "invisible" :
                        d === "⌫" ? "bg-gray-100 text-gray-400 hover:bg-gray-200 active:scale-95" :
                        "bg-gray-100 text-[#0D2240] hover:bg-gray-200 active:scale-95"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>

                {pinError && <p className="text-red-500 text-xs font-semibold text-center mt-3">{pinError}</p>}
              </div>
            )}

            {/* ── Step 4: Schedule warning (Level 2) ── */}
            {step === "warning" && warning && (
              <div className="bg-white rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">
                    {warning.flag === "unscheduled" ? "📅" :
                     warning.flag === "early" ? "⏰" :
                     warning.flag === "late" ? "⌛" : "⚠️"}
                  </span>
                  <div>
                    <p className="font-bold text-[#0D2240] text-sm">{warning.message}</p>
                    {warning.scheduledTime && (
                      <p className="text-xs text-gray-400 mt-0.5">Scheduled: {warning.scheduledTime}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setStep("select"); setWarning(null); setSelectedName(""); setPin("") }}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="button"
                    onClick={async () => {
                      const fd = new FormData()
                      fd.append("name", selectedName)
                      fd.append("role", selectedRole)
                      fd.append("pin", pin)
                      fd.append("override", "true")
                      setLoading(true)
                      try {
                        const r = openPunch ? await clockOut(fd) : await clockIn(fd)
                        if ("error" in r) { setError(r.error); setStep("pin") }
                        else {
                          if (openPunch) {
                            setDone("Clocked out. See you next time!")
                            setOpenPunch(null); setElapsedMins(0)
                          } else {
                            const clocked = (r as { punch: TimePunch }).punch
                            setOpenPunch(clocked); setElapsedMins(0)
                            setDone("Clocked in!")
                          }
                          setStep("select"); setWarning(null)
                          setSelectedName(""); setPin("")
                        }
                      } catch { setError("Something went wrong."); setStep("pin") }
                      finally { setLoading(false) }
                    }}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#0D2240] text-white hover:bg-[#1a3a5c] transition-colors disabled:opacity-50">
                    {loading ? "…" : "Confirm Anyway"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Done / error banners ── */}
            {done && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-green-700 font-bold text-sm">{done}</p>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-red-600 font-bold text-sm">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
