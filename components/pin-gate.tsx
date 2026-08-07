"use client"

import { useState, useEffect, useRef, createContext, useContext } from "react"
import { useSearchParams } from "next/navigation"
import {
  verifyWorkerPinForRole, getOpenPunch, clockIn, clockOut,
  type TimePunch, type ScheduleWarning,
} from "@/app/actions/staff"
import { minutesBetween, formatDuration } from "@/lib/staff-utils"
import { checkIsAdmin } from "@/app/admin/login/actions"
import { getTranslations } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n"

// ── Worker session context — so child pages can read who is logged in ─────────
interface WorkerSession {
  workerId: string
  workerName: string
  lang: Locale
  roles?: string[]
}

const WorkerCtx = createContext<WorkerSession | null>(null)

/** Returns the currently logged-in worker for this station session, or null. */
export function useWorkerSession(): WorkerSession | null {
  return useContext(WorkerCtx)
}

/**
 * Returns a translation function for a given namespace, using the logged-in
 * worker's language preference. Falls back to English if no session is active.
 *
 * @example
 *   const t = useWorkerT("driver")
 *   t("title")  // → "Driver Station" or "Estación del Conductor"
 */
export function useWorkerT(ns: string) {
  const session = useContext(WorkerCtx)
  const lang: Locale = session?.lang ?? "en"
  const dict = getTranslations(lang)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const section = (dict as any)[ns] as Record<string, string> | undefined
  return (key: string): string => section?.[key] ?? key
}

// ── Storage helpers ───────────────────────────────────────────────────────────
const SESSION_KEY = (role: string) => `washfold_${role}_worker`

function loadSession(role: string): WorkerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY(role))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(role: string, session: WorkerSession) {
  localStorage.setItem(SESSION_KEY(role), JSON.stringify(session))
}

function clearSession(role: string) {
  localStorage.removeItem(SESSION_KEY(role))
}

// ── Clock in/out widget — lets a worker clock in/out right on their station ───
// page (driver/operator) instead of needing a separate trip to /staff first.
// Reuses the exact same server actions and translation strings as /staff.
// Renders inline (no fixed positioning) so the consuming page can place it
// wherever it fits in its own header row, next to that page's other buttons —
// it previously self-positioned as a fixed overlay, which drifted out of sync
// with each station page's real header and covered other header buttons.
export function ClockWidget({ session, role }: { session: WorkerSession; role: "driver" | "operator" }) {
  const [openPunch, setOpenPunch] = useState<TimePunch | null | undefined>(undefined)
  const [elapsedMins, setElapsedMins] = useState(0)
  const [breakMinutes, setBreakMinutes] = useState("0")
  const [showBreak, setShowBreak] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [warning, setWarning] = useState<ScheduleWarning | null>(null)
  const [done, setDone] = useState<"in" | "out" | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (getTranslations(session.lang ?? "en") as any).staff_clock as Record<string, string>
  const t = (key: string) => sc?.[key] ?? key

  useEffect(() => {
    if (session.workerId === "owner") return
    getOpenPunch(session.workerName).then(punch => {
      setOpenPunch(punch)
      if (punch) setElapsedMins(minutesBetween(punch.clocked_in_at, null))
    })
  }, [session.workerName, session.workerId])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (openPunch) {
      timerRef.current = setInterval(() => setElapsedMins(minutesBetween(openPunch.clocked_in_at, null)), 60000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [openPunch])

  async function handleClockIn(confirmed = false) {
    setSubmitting(true)
    const fd = new FormData()
    fd.append("workerName", session.workerName)
    fd.append("role", role)
    if (confirmed) fd.append("confirmed", "true")
    const result = await clockIn(fd)
    setSubmitting(false)
    if (!result) return
    if ("scheduleWarning" in result && result.scheduleWarning) { setWarning(result.scheduleWarning); return }
    if ("punch" in result) {
      setOpenPunch(result.punch ?? null); setElapsedMins(0); setWarning(null); setDone("in")
      setTimeout(() => setDone(null), 2500)
    }
  }

  async function handleClockOut(confirmed = false) {
    if (!openPunch) return
    setSubmitting(true)
    const fd = new FormData()
    fd.append("punchId", openPunch.id)
    fd.append("breakMinutes", breakMinutes)
    if (confirmed) fd.append("confirmed", "true")
    const result = await clockOut(fd)
    setSubmitting(false)
    if (!result) return
    if ("scheduleWarning" in result && result.scheduleWarning) { setWarning(result.scheduleWarning); return }
    setOpenPunch(null); setElapsedMins(0); setWarning(null); setShowBreak(false); setBreakMinutes("0")
    setDone("out"); setTimeout(() => setDone(null), 2500)
  }

  if (session.workerId === "owner" || openPunch === undefined) return null

  // Schedule-warning confirm step — same copy as /staff. Dropdown-anchored
  // below the pill (relative wrapper) instead of a page-fixed overlay, so it
  // stays attached to wherever the pill is placed inline in the header.
  if (warning) {
    return (
      <div className="relative inline-block">
        <div className="absolute right-0 top-full mt-2 max-w-[280px] w-64 bg-white rounded-2xl shadow-2xl px-4 py-3 z-50">
          <p className="text-[#0D2240] font-bold text-xs mb-2">⚠️ {warning.message}</p>
          <div className="flex gap-1.5">
            <button onClick={() => setWarning(null)}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
              {t("back_btn")}
            </button>
            <button onClick={() => openPunch ? handleClockOut(true) : handleClockIn(true)} disabled={submitting}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#0D2240] text-white hover:bg-[#1a3a5c] transition-colors disabled:opacity-50">
              {t("warning_proceed")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Renders inline — a solid dark pill so it stays legible on either a light
  // header (operator) or a dark header (driver). The consuming page places
  // this alongside its own header buttons (e.g. left of "Print Station").
  return (
    <div className="inline-flex items-center gap-2">
      {done ? (
        <div className="bg-white rounded-full px-4 py-1.5 text-xs font-bold text-green-600 shadow-sm">
          {done === "in" ? `✅ ${t("success_in")}` : `👋 ${t("success_out")}`}
        </div>
      ) : openPunch ? (
        showBreak ? (
          <div className="relative inline-block">
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2 z-50">
              <input type="number" min="0" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)}
                placeholder={t("break_minutes")}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#0D2240] outline-none" />
              <button onClick={() => handleClockOut()} disabled={submitting}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors">
                {submitting ? "…" : t("clock_out")}
              </button>
              <button onClick={() => setShowBreak(false)} className="text-gray-300 hover:text-gray-500 text-xs px-1">✕</button>
            </div>
            <button onClick={() => setShowBreak(false)}
              className="flex items-center gap-2 bg-[#0D2240] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-green-400/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {formatDuration(elapsedMins)}
            </button>
          </div>
        ) : (
          <button onClick={() => setShowBreak(true)}
            className="flex items-center gap-2 bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors border border-green-400/30">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {formatDuration(elapsedMins)}
            <span className="text-white/40 font-normal">· {t("clock_out")}</span>
          </button>
        )
      ) : (
        <button onClick={() => handleClockIn()} disabled={submitting}
          className="flex items-center gap-2 bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors disabled:opacity-50">
          <span>🕐</span> {submitting ? "…" : t("clock_in")}
        </button>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
interface PinGateProps {
  role: "driver" | "operator"
  children: React.ReactNode
}

const LOCK_ICON  = { driver: "🚐", operator: "🏭" }
const ROLE_LABEL = { driver: "Driver Station", operator: "Operator Station" }

export function PinGate({ role, children }: PinGateProps) {
  const [session, setSession] = useState<WorkerSession | null>(null)
  const [checked, setChecked]   = useState(false)
  const [pin, setPin]           = useState(["", "", "", ""])
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [shake, setShake]       = useState(false)
  const [welcome, setWelcome]   = useState(false)
  const [isAdmin, setIsAdmin]   = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const searchParams = useSearchParams()

  function enterAsOwner() {
    const s: WorkerSession = { workerId: "owner", workerName: "Owner" }
    saveSession(role, s)
    setSession(s)
  }

  // Restore session from localStorage on mount; also check if viewer is admin.
  // If the admin arrived via the "Act As" dropdown in /admin (?as=owner), skip
  // the PIN screen entirely and drop them straight into the station — that
  // dropdown exists specifically so admins can jump in and perform driver/
  // operator duties (enter weight, mark delivered, etc.) with zero friction,
  // not just as a fallback if they happen to know the bypass exists.
  //
  // ?as=owner must win even if a worker PIN session (e.g. a real driver's or
  // operator's) is still sitting in this browser's localStorage from a
  // previous shift — otherwise an admin clicking "Act As → Driver/Operator"
  // silently lands inside whichever worker last logged in on that device
  // instead of their own owner view. So the admin check runs first; only if
  // it doesn't apply do we fall back to restoring a stored worker session.
  useEffect(() => {
    checkIsAdmin().then(admin => {
      setIsAdmin(admin)
      if (admin && searchParams.get("as") === "owner") {
        enterAsOwner()
        setChecked(true)
        return
      }
      const stored = loadSession(role)
      if (stored) {
        setSession(stored)
      }
      setChecked(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  async function handleSubmit() {
    const entered = pin.join("")
    if (entered.length < 4) return
    setLoading(true)
    setError("")
    const worker = await verifyWorkerPinForRole(role, entered)
    setLoading(false)
    if (worker) {
      const lang = (worker.lang ?? "en") as Locale
      const s: WorkerSession = { workerId: worker.id, workerName: worker.name, lang, roles: worker.roles }
      saveSession(role, s)
      setWelcome(true)
      setTimeout(() => {
        setSession(s)
        setWelcome(false)
      }, 1200)
    } else {
      // Show error in both languages since we don't know who this is yet
      setError("PIN not recognised — PIN incorrecto")
      setShake(true)
      setTimeout(() => setShake(false), 600)
      setPin(["", "", "", ""])
      inputs.current[0]?.focus()
    }
  }

  function handleDigit(i: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1)
    const next = [...pin]
    next[i] = digit
    setPin(next)
    setError("")
    if (digit && i < 3) inputs.current[i + 1]?.focus()
    if (digit && i === 3) {
      const full = next.join("")
      if (full.length === 4) {
        setTimeout(() => document.getElementById("pin-submit")?.click(), 80)
      }
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !pin[i] && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === "Enter") handleSubmit()
  }

  function switchWorker() {
    clearSession(role)
    setSession(null)
    setPin(["", "", "", ""])
    setError("")
    setTimeout(() => inputs.current[0]?.focus(), 100)
  }

  if (!checked) return null

  // ── Unlocked: render children with session context + switch button ────────
  if (session) {
    const pillT = getTranslations(session.lang)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinT = (pillT as any).pin as Record<string, string>
    return (
      <WorkerCtx.Provider value={session}>
        <div className="relative">
          {/* Session pill — top-right. Clock in/out now renders inline inside
              each station page's own header (see app/operator/page.tsx and
              app/driver/page.tsx) instead of as a fixed overlay here, so it
              can't drift out of place or cover that page's real buttons. */}
          <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
            {session.workerId === "owner" ? (
              <a
                href="/admin"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur transition-colors"
              >
                <span>👑</span>
                {pinT?.owner_view ?? "Owner view"}
                <span className="text-white/40 font-normal">· {pinT?.back_admin ?? "← admin"}</span>
              </a>
            ) : (
              <button
                onClick={switchWorker}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-[#E8726A] flex items-center justify-center text-[10px] font-extrabold shrink-0">
                  {session.workerName.charAt(0).toUpperCase()}
                </span>
                {session.workerName}
                <span className="text-white/40 font-normal">· {pinT?.switch ?? "switch"}</span>
              </button>
            )}
          </div>
          {children}
        </div>
      </WorkerCtx.Provider>
    )
  }

  // ── Welcome flash ─────────────────────────────────────────────────────────
  if (welcome) {
    return (
      <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
        <div className="w-24 h-24 rounded-3xl bg-[#E8726A] flex items-center justify-center text-5xl mx-auto mb-6 animate-bounce">
          👋
        </div>
        <h1 className="text-white font-extrabold text-3xl text-center">
          Welcome! / ¡Bienvenido!
        </h1>
        <p className="text-white/60 text-lg text-center mt-2">Loading station… / Cargando…</p>
      </div>
    )
  }

  // ── PIN entry screen — bilingual (we don't know the worker's lang yet) ────
  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="w-20 h-20 rounded-3xl bg-[#E8726A] flex items-center justify-center text-4xl mx-auto mb-6">
          {LOCK_ICON[role]}
        </div>

        <h1 className="text-white font-extrabold text-2xl text-center mb-1">
          {role === "driver" ? "Driver Station / Estación del Conductor" : "Operator Station / Estación del Operador"}
        </h1>
        <p className="text-white/40 text-sm text-center mb-10">
          Enter your 4-digit PIN · Ingresa tu PIN de 4 dígitos
        </p>

        <div className={`flex justify-center gap-4 mb-6 transition-all ${shake ? "animate-shake" : ""}`}>
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              className={`w-14 h-14 rounded-2xl text-center text-2xl font-extrabold border-2 bg-white/10 text-white outline-none transition-all
                ${digit ? "border-[#E8726A] bg-[#E8726A]/20" : "border-white/20"}
                focus:border-[#E8726A]`}
            />
          ))}
        </div>

        {error && (
          <p className="text-[#E8726A] text-sm text-center font-semibold mb-4">{error}</p>
        )}

        <button
          id="pin-submit"
          onClick={handleSubmit}
          disabled={loading || pin.join("").length < 4}
          className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors"
        >
          {loading ? "Checking… / Verificando…" : "Enter Station · Entrar"}
        </button>

        <p className="text-white/20 text-xs text-center mt-6">
          PIN not working? / ¿PIN no funciona? — Ask your manager · Consulta con tu supervisor
        </p>

        {isAdmin && (
          <div className="mt-8 border-t border-white/10 pt-6">
            <button
              onClick={enterAsOwner}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white font-bold text-sm py-3 rounded-2xl transition-colors"
            >
              <span>👑</span> Enter as Owner
            </button>
            <p className="text-white/20 text-[10px] text-center mt-2">Admin bypass — only visible to you</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  )
}
