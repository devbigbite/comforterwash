"use client"

import { useState, useEffect, useRef, createContext, useContext } from "react"
import { verifyWorkerPinForRole } from "@/app/actions/staff"
import { checkIsAdmin } from "@/app/admin/login/actions"

// ── Worker session context — so child pages can read who is logged in ─────────
interface WorkerSession {
  workerId: string
  workerName: string
}

const WorkerCtx = createContext<WorkerSession | null>(null)

/** Returns the currently logged-in worker for this station session, or null. */
export function useWorkerSession(): WorkerSession | null {
  return useContext(WorkerCtx)
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

  // Restore session from localStorage on mount; also check if viewer is admin
  useEffect(() => {
    const stored = loadSession(role)
    if (stored) setSession(stored)
    setChecked(true)
    checkIsAdmin().then(setIsAdmin)
  }, [role])

  function enterAsOwner() {
    const s: WorkerSession = { workerId: "owner", workerName: "Owner" }
    setSession(s)
  }

  async function handleSubmit() {
    const entered = pin.join("")
    if (entered.length < 4) return
    setLoading(true)
    setError("")
    const worker = await verifyWorkerPinForRole(role, entered)
    setLoading(false)
    if (worker) {
      const s = { workerId: worker.id, workerName: worker.name }
      saveSession(role, s)
      setWelcome(true)
      setTimeout(() => {
        setSession(s)
        setWelcome(false)
      }, 1200)
    } else {
      setError("PIN not recognised — check with your manager")
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
    return (
      <WorkerCtx.Provider value={session}>
        <div className="relative">
          {/* Session pill — top-right */}
          <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
            {session.workerId === "owner" ? (
              <a
                href="/admin"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur transition-colors"
              >
                <span>👑</span>
                Owner view
                <span className="text-white/40 font-normal">· ← admin</span>
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
                <span className="text-white/40 font-normal">· switch</span>
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
        <h1 className="text-white font-extrabold text-3xl text-center">Welcome!</h1>
        <p className="text-white/60 text-lg text-center mt-2">Loading station…</p>
      </div>
    )
  }

  // ── PIN entry screen ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="w-20 h-20 rounded-3xl bg-[#E8726A] flex items-center justify-center text-4xl mx-auto mb-6">
          {LOCK_ICON[role]}
        </div>

        <h1 className="text-white font-extrabold text-2xl text-center mb-1">{ROLE_LABEL[role]}</h1>
        <p className="text-white/40 text-sm text-center mb-10">Enter your personal 4-digit PIN</p>

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
          className="w-full b