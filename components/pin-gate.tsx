"use client"

import { useState, useEffect, useRef } from "react"
import { verifyStaffPin } from "@/app/actions/settings"

interface PinGateProps {
  role: "driver" | "operator"
  children: React.ReactNode
}

const STORAGE_KEY = (role: string) => `washfold_${role}_unlocked`
const LOCK_ICON = { driver: "🚐", operator: "🏭" }
const ROLE_LABEL = { driver: "Driver Station", operator: "Operator Station" }

export function PinGate({ role, children }: PinGateProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [checked, setChecked] = useState(false)
  const [pin, setPin] = useState(["", "", "", ""])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(role))
    if (stored === "true") {
      setUnlocked(true)
    }
    setChecked(true)
  }, [role])

  async function handleSubmit() {
    const entered = pin.join("")
    if (entered.length < 4) return
    setLoading(true)
    setError("")
    const ok = await verifyStaffPin(role, entered)
    setLoading(false)
    if (ok) {
      localStorage.setItem(STORAGE_KEY(role), "true")
      setUnlocked(true)
    } else {
      setError("Incorrect PIN")
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
    if (digit && i < 3) {
      inputs.current[i + 1]?.focus()
    }
    if (digit && i === 3) {
      // Auto-submit when last digit entered
      const full = [...next].join("")
      if (full.length === 4) {
        setTimeout(() => {
          const el = document.getElementById("pin-submit")
          el?.click()
        }, 80)
      }
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !pin[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
    if (e.key === "Enter") handleSubmit()
  }

  if (!checked) return null
  if (unlocked) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#0D2240] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-[#E8726A] flex items-center justify-center text-4xl mx-auto mb-6">
          {LOCK_ICON[role]}
        </div>

        {/* Title */}
        <h1 className="text-white font-extrabold text-2xl text-center mb-1">{ROLE_LABEL[role]}</h1>
        <p className="text-white/40 text-sm text-center mb-10">Enter your 4-digit PIN to continue</p>

        {/* PIN boxes */}
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

        {/* Error */}
        {error && (
          <p className="text-[#E8726A] text-sm text-center font-semibold mb-4">{error}</p>
        )}

        {/* Submit button (hidden, triggered programmatically on last digit) */}
        <button
          id="pin-submit"
          onClick={handleSubmit}
          disabled={loading || pin.join("").length < 4}
          className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold text-base py-4 rounded-2xl transition-colors"
        >
          {loading ? "Checking…" : "Unlock"}
        </button>
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
