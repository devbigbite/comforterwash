"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import {
  getActiveWorkers,
  getOpenPunch,
  getCurrentPunches,
  clockIn,
  clockOut,
  verifyWorkerPin,
  updatePunch,
  createPunch,
  getTimeSheet,
} from "@/app/actions/staff"
import { minutesBetween, formatDuration } from "@/lib/staff-utils"
import { getTranslations } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n"
import type { ActiveWorker, TimePunch, ScheduleWarning } from "@/app/actions/staff"

type Step = "select" | "pin" | "warning" | "ready"

function fmtLocal(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}
function todayStr() {
  return new Date().toLocaleDateString("en-CA")
}
function isoToLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Punch Edit Modal ──────────────────────────────────────────────────────────
function PunchEditModal({ punch, workers, onClose, onSaved }: {
  punch: TimePunch | "new"
  workers: ActiveWorker[]
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = punch === "new"
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState("")
  const [workerName, setWorkerName] = useState(isNew ? "" : (punch as TimePunch).worker_name)
  const [role, setRole]             = useState(isNew ? "" : (punch as TimePunch).role)
  const [cin, setCin]               = useState(isNew ? `${todayStr()}T09:00` : isoToLocal((punch as TimePunch).clocked_in_at))
  const [cout, setCout]             = useState(isNew ? "" : ((punch as TimePunch).clocked_out_at ? isoToLocal((punch as TimePunch).clocked_out_at!) : ""))
  const [brk, setBrk]               = useState(isNew ? "0" : String((punch as TimePunch).break_minutes ?? 0))
  const workerRoles = workers.find(w => w.name === workerName)?.roles ?? []

  async function handleSave() {
    setErr("")
    if (!workerName || !role || !cin) { setErr("Fill in all required fields"); return }
    setSaving(true)
    const fd = new FormData()
    if (isNew) {
      const [date, time] = cin.split("T")
      fd.append("workerName", workerName); fd.append("role", role)
      fd.append("date", date); fd.append("startTime", time)
      if (cout) fd.append("endTime", cout.split("T")[1])
      fd.append("breakMinutes", brk)
      const r = await createPunch(fd)
      if ("error" in r && r.error) { setErr(r.error); setSaving(false); return }
    } else {
      fd.append("punchId", (punch as TimePunch).id)
      fd.append("clockedInAt", new Date(cin).toISOString())
      fd.append("clockedOutAt", cout ? new Date(cout).toISOString() : "")
      fd.append("breakMinutes", brk)
      const r = await updatePunch(fd)
      if ("error" in r && r.error) { setErr(r.error); setSaving(false); return }
    }
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-extrabold text-[#0D2240] text-base">{isNew ? "Add Punch" : "Edit Punch"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {isNew && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Worker</label>
                <select value={workerName} onChange={e => { setWorkerName(e.target.value); setRole("") }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none">
                  <option value="">— Select —</option>
                  {workers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none">
                  <option value="">— Select —</option>
                  {(workerName ? workerRoles : ["driver","operator","admin"]).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {!isNew && (
            <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm font-semibold text-[#0D2240]">
              {(punch as TimePunch).worker_name} — {(punch as TimePunch).role}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Clock In *</label>
            <input type="datetime-local" value={cin} onChange={e => setCin(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Clock Out <span className="text-gray-300 font-normal normal-case">(leave blank if still in)</span>
            </label>
            <input type="datetime-local" value={cout} onChange={e => setCout(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Break (minutes)</label>
            <input type="number" min="0" value={brk} onChange={e => setBrk(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          </div>
          {err && <p className="text-red-500 text-xs font-semibold">{err}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#0D2240] text-white hover:bg-[#1a3a5c] transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
const ADMIN_FLAG_LABELS: Record<string, { label: string; color: string }> = {
  unscheduled: { label: "Not scheduled today", color: "text-red-300" },
  early_in:    { label: "Clocking in early",   color: "text-amber-300" },
  late_in:     { label: "Clocking in late",     color: "text-amber-300" },
  early_out:   { label: "Clocking out early",   color: "text-amber-300" },
  late_out:    { label: "Clocking out late",    color: "text-amber-300" },
}

function AdminPanel({ workers }: { workers: ActiveWorker[] }) {
  const [open, setOpen]                 = useState(false)
  const [punches, setPunches]           = useState<TimePunch[]>([])
  const [todayPunches, setTodayPunches] = useState<TimePunch[]>([])
  const [loading, setLoading]           = useState(false)
  const [busy, setBusy]                 = useState<string | null>(null)
  const [editPunch, setEditPunch]       = useState<TimePunch | "new" | null>(null)
  const [tab, setTab]                   = useState<"live" | "punches">("live")

  async function load() {
    setLoading(true)
    const [cur, today] = await Promise.all([
      getCurrentPunches(),
      getTimeSheet(todayStr(), todayStr()),
    ])
    setPunches(cur); setTodayPunches(today); setLoading(false)
  }

  useEffect(() => { if (open) load() }, [open])

  async function adminClockIn(worker: ActiveWorker) {
    const role = worker.roles[0]
    if (!role) return
    setBusy(worker.name)
    const fd = new FormData()
    fd.append("workerName", worker.name); fd.append("role", role); fd.append("confirmed", "true")
    await clockIn(fd)
    setBusy(null); load()
  }

  async function adminClockOut(punch: TimePunch) {
    setBusy(punch.worker_name)
    const fd = new FormData()
    fd.append("punchId", punch.id); fd.append("breakMinutes", "0"); fd.append("confirmed", "true")
    await clockOut(fd)
    setBusy(null); load()
  }

  const clockedInNames = new Set(punches.map(p => p.worker_name))

  return (
    <>
      {editPunch !== null && (
        <PunchEditModal punch={editPunch} workers={workers} onClose={() => setEditPunch(null)} onSaved={() => { setEditPunch(null); load() }} />
      )}
      <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <span className="text-white font-bold text-sm">Admin Controls</span>
          </div>
          <span className="text-white/40 text-xs">{open ? "▲ hide" : "▼ show"}</span>
        </button>

        {open && (
          <div className="border-t border-white/10 px-5 pb-5">
            <div className="flex gap-1 mt-4 mb-4 bg-white/10 rounded-xl p-1">
              {(["live", "punches"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${tab === t ? "bg-white text-[#0D2240]" : "text-white/60 hover:text-white"}`}>
                  {t === "live" ? "🟢 Live Status" : "📋 Today's Punches"}
                </button>
              ))}
            </div>

            {loading && <p className="text-white/30 text-xs text-center py-4">Loading…</p>}

            {!loading && tab === "live" && (
              <div className="space-y-2">
                {workers.map(w => {
                  const punch = punches.find(p => p.worker_name === w.name) ?? null
                  const inNow = clockedInNames.has(w.name)
                  return (
                    <div key={w.id} className="bg-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{w.name}</p>
                        {inNow && punch ? (
                          <p className="text-green-300 text-xs">In since {fmtLocal(punch.clocked_in_at)} · {formatDuration(minutesBetween(punch.clocked_in_at, null))}</p>
                        ) : (
                          <p className="text-white/30 text-xs">Not clocked in</p>
                        )}
                      </div>
                      {inNow && punch ? (
                        <button onClick={() => adminClockOut(punch)} disabled={busy === w.name}
                          className="shrink-0 bg-red-500/20 text-red-300 border border-red-400/30 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-40">
                          {busy === w.name ? "…" : "Clock Out"}
                        </button>
                      ) : (
                        <button onClick={() => adminClockIn(w)} disabled={busy === w.name}
                          className="shrink-0 bg-green-500/20 text-green-300 border border-green-400/30 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-green-500/30 transition-colors disabled:opacity-40">
                          {busy === w.name ? "…" : "Clock In"}
                        </button>
                      )}
                    </div>
                  )
                })}
                <button onClick={() => setEditPunch("new")}
                  className="w-full mt-1 py-2.5 rounded-xl border border-white/20 text-white/60 text-xs font-bold hover:text-white hover:border-white/40 transition-colors">
                  + Add Manual Punch
                </button>
              </div>
            )}

            {!loading && tab === "punches" && (
              <div className="space-y-2">
                {todayPunches.length === 0 && <p className="text-white/30 text-xs text-center py-4">No punches recorded today</p>}
                {todayPunches.map(p => (
                  <div key={p.id} className="bg-white/10 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm">
                          {p.worker_name}<span className="ml-2 text-white/40 font-normal text-xs">{p.role}</span>
                        </p>
                        <p className="text-white/60 text-xs mt-0.5">
                          In: {fmtLocal(p.clocked_in_at)}{p.clocked_out_at ? ` → Out: ${fmtLocal(p.clocked_out_at)}` : " → still in"}
                          {p.break_minutes ? ` (${p.break_minutes}m break)` : ""}
                        </p>
                        {p.clocked_out_at && (
                          <p className="text-white/40 text-xs">
                            Net: {formatDuration(minutesBetween(p.clocked_in_at, p.clocked_out_at) - (p.break_minutes ?? 0))}
                          </p>
                        )}
                        {p.schedule_flag && (
                          <p className={`text-xs mt-0.5 ${ADMIN_FLAG_LABELS[p.schedule_flag]?.color ?? "text-amber-300"}`}>
                            ⚠ {ADMIN_FLAG_LABELS[p.schedule_flag]?.label ?? p.schedule_flag}
                            {p.flag_minutes ? ` (${p.flag_minutes}m)` : ""}
                          </p>
                        )}
                      </div>
                      <button onClick={() => setEditPunch(p)}
                        className="shrink-0 text-white/40 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setEditPunch("new")}
                  className="w-full mt-1 py-2.5 rounded-xl border border-white/20 text-white/60 text-xs font-bold hover:text-white hover:border-white/40 transition-colors">
                  + Add Manual Punch
                </button>
                <button onClick={load} className="w-full py-2 text-white/30 text-xs hover:text-white/60 transition-colors">↻ Refresh</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffClockPage() {
  const [workers, setWorkers]           = useState<ActiveWorker[]>([])
  const router = useRouter()
  const [selectedName, setSelectedName] = useState("")
  const [selectedRole, setSelectedRole] = useState("")
  const [openPunch, setOpenPunch]       = useState<TimePunch | null>(null)
  const [loading, setLoading]           = useState(true)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [done, setDone]                 = useState<"in" | "out" | null>(null)
  const [breakMinutes, setBreakMinutes] = useState("0")
  const [elapsedMins, setElapsedMins]   = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [step, setStep]         = useState<Step>("select")
  const [pin, setPin]           = useState("")
  const [pinError, setPinError] = useState("")
  const [warning, setWarning]   = useState<ScheduleWarning | null>(null)
  const [lang, setLang]         = useState<Locale>("en")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (getTranslations(lang) as any).staff_clock as Record<string, string>
  const t = (key: string) => sc?.[key] ?? key

  const ROLE_LABELS: Record<string, string> = {
    driver:   t("role_driver"),
    operator: t("role_operator"),
    admin:    t("role_admin"),
  }

  useEffect(() => {
    getActiveWorkers().then(list => { setWorkers(list); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!selectedName) { setOpenPunch(null); setStep("select"); return }
    getOpenPunch(selectedName).then(punch => {
      setOpenPunch(punch)
      if (punch) { setElapsedMins(minutesBetween(punch.clocked_in_at, null)); setStep("pin") }
    })
  }, [selectedName])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (openPunch) {
      timerRef.current = setInterval(() => setElapsedMins(minutesBetween(openPunch.clocked_in_at, null)), 60000)
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

  function handlePinDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d; setPin(next); setPinError("")
    if (next.length === 4) handlePinSubmit(next)
  }
  function handlePinDelete() { setPin(p => p.slice(0, -1)); setPinError("") }
  async function handlePinSubmit(p: string) {
    const result = await verifyWorkerPin(selectedName, p)
    if (result.noPinSet) { setStep("ready"); return }
    if (!result.valid) { setPin(""); setPinError(t("pin_wrong")); return }
    setLang((result.lang ?? "en") as Locale)
    setStep("ready")
  }

  async function handleClockIn(confirmed = false) {
    if (!selectedName || !selectedRole) { setError("Select your name and role"); return }
    setSubmitting(true); setError(null)
    const fd = new FormData()
    fd.append("workerName", selectedName); fd.append("role", selectedRole)
    if (confirmed) fd.append("confirmed", "true")
    const result = await clockIn(fd)
    setSubmitting(false)
    if (!result) return
    if ("error" in result && result.error) { setError(result.error); return }
    if ("scheduleWarning" in result && result.scheduleWarning) { setWarning(result.scheduleWarning); setStep("warning"); return }
    if ("punch" in result) {
      setOpenPunch(result.punch ?? null); setElapsedMins(0); setWarning(null); setDone("in")
      setTimeout(() => {
        if (selectedRole === "operator") router.push("/operator")
        else if (selectedRole === "driver") router.push("/driver")
        else setDone(null)
      }, 1500)
    }
  }

  async function handleClockOut(confirmed = false) {
    if (!openPunch) return
    setSubmitting(true); setError(null)
    const fd = new FormData()
    fd.append("punchId", openPunch.id); fd.append("breakMinutes", breakMinutes)
    if (confirmed) fd.append("confirmed", "true")
    const result = await clockOut(fd)
    setSubmitting(false)
    if (!result) return
    if ("error" in result && result.error) { setError(result.error); return }
    if ("scheduleWarning" in result && result.scheduleWarning) { setWarning(result.scheduleWarning); setStep("warning"); return }
    setOpenPunch(null); setElapsedMins(0); setWarning(null)
    setPin(""); setStep("select"); setSelectedName(""); setSelectedRole("")
    setDone("out"); setTimeout(() => setDone(null), 3500)
  }

  const netMinutes = elapsedMins - (parseInt(breakMinutes || "0", 10) || 0)

  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col">
      <div className="px-4 pt-10 pb-6 text-center relative">
        {/* EN/ES toggle — top-right, visible before PIN (lang unknown) */}
        <button
          onClick={() => setLang(l => l === "en" ? "es" : "en")}
          className="absolute top-3 right-3 text-white/40 hover:text-white/70 text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 hover:border-white/40 transition-colors"
        >
          {t("language_toggle")}
        </button>
        <div className="w-16 h-16 rounded-3xl bg-[#E8726A] flex items-center justify-center text-3xl mx-auto mb-4">🕐</div>
        <h1 className="text-3xl font-extrabold text-white mb-1">{t("title")}</h1>
        <p className="text-white/50 text-sm">{t("subtitle")}</p>
      </div>

      <div className="px-4 space-y-4 pb-16 max-w-sm mx-auto w-full">
        {loading && <div className="text-center py-8"><p className="text-white/30 text-sm">{t("checking")}</p></div>}

        {!loading && (
          <>
            <div className="bg-white rounded-2xl p-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t("select_worker")}</label>
              <select value={selectedName}
                onChange={e => {
                  setSelectedName(e.target.value); setPin(""); setPinError("")
                  setStep(e.target.value ? "pin" : "select"); setError(null); setDone(null); setWarning(null)
                }}
                className="w-full border-2 border-gray-200 focus:border-[#0D2240] rounded-xl px-3 py-2.5 text-[#0D2240] font-semibold text-sm outline-none transition-colors bg-white appearance-none cursor-pointer">
                <option value="">— {t("select_worker")} —</option>
                {workers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
              </select>
            </div>

            {selectedName && availableRoles.length > 1 && !openPunch && step !== "warning" && (
              <div className="bg-white rounded-2xl p-4">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{lang === "es" ? "Rol de Hoy" : "Role Today"}</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map(role => (
                    <button key={role} type="button" onClick={() => setSelectedRole(role)}
                      className={`py-3 rounded-xl font-bold text-sm transition-colors ${selectedRole === role ? "bg-[#0D2240] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {ROLE_LABELS[role] ?? role}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedName && step === "pin" && (
              <div className="bg-white rounded-2xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-4">{t("enter_pin")}</p>
                <div className="flex justify-center gap-4 mb-5">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? "bg-[#0D2240] scale-110" : "bg-gray-200"}`} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
                    <button key={i} type="button"
                      onClick={() => d === "⌫" ? handlePinDelete() : d ? handlePinDigit(d) : undefined}
                      disabled={!d}
                      className={`h-14 rounded-2xl font-bold text-xl transition-all ${!d ? "invisible" : d === "⌫" ? "bg-gray-100 text-gray-400 hover:bg-gray-200 active:scale-95" : "bg-gray-100 text-[#0D2240] hover:bg-gray-200 active:scale-95"}`}>
                      {d}
                    </button>
                  ))}
                </div>
                {pinError && <p className="text-red-500 text-xs font-semibold text-center mt-3">{pinError}</p>}
              </div>
            )}

            {selectedName && step === "ready" && (
              <div className="bg-white rounded-2xl p-5 space-y-4">
                {openPunch ? (
                  <>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t("already_in")}</p>
                      <p className="text-[#0D2240] font-extrabold text-2xl">{formatDuration(netMinutes)}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{t("clocked_in_at")} {fmtLocal(openPunch.clocked_in_at)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t("break_minutes")}</label>
                      <input type="number" min="0" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-semibold outline-none" />
                    </div>
                    <button onClick={() => handleClockOut()} disabled={submitting}
                      className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-extrabold py-4 rounded-2xl transition-colors">
                      {submitting ? "…" : t("clock_out")}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">{t("not_in")} — {ROLE_LABELS[selectedRole] ?? selectedRole}</p>
                    <button onClick={() => handleClockIn()} disabled={submitting}
                      className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white font-extrabold py-4 rounded-2xl transition-colors">
                      {submitting ? "…" : t("clock_in")}
                    </button>
                  </>
                )}
              </div>
            )}

            {step === "warning" && warning && (
              <div className="bg-white rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">⚠️</span>
                  <div>
                    <p className="font-bold text-[#0D2240] text-sm">{warning.message}</p>
                    {warning.scheduledTime && <p className="text-xs text-gray-400 mt-0.5">Scheduled: {warning.scheduledTime}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setStep("select"); setWarning(null); setSelectedName(""); setPin("") }}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">{t("warning_cancel")}</button>
                  <button type="button" onClick={() => openPunch ? handleClockOut(true) : handleClockIn(true)} disabled={submitting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#0D2240] text-white hover:bg-[#1a3a5c] transition-colors disabled:opacity-50">
                    {submitting ? "…" : t("warning_proceed")}
                  </button>
                </div>
              </div>
            )}

            {done && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-green-700 font-bold text-sm">
                  {done === "in" ? `✅ ${t("success_in")}` : `👋 ${t("success_out")}`}
                </p>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-red-600 font-bold text-sm">{error}</p>
              </div>
            )}

            <AdminPanel workers={workers} />
          </>
        )}
      </div>
    </div>
  )
}
