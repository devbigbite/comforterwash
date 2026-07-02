"use client"

import { useState, useRef, useEffect } from "react"
import { setWorkerPin, clearWorkerPin } from "@/app/actions/staff"

interface Props {
  workerName: string
  hasPin: boolean
}

export function WorkerPinManager({ workerName, hasPin }: Props) {
  const [open, setOpen]       = useState(false)
  const [pin, setPin]         = useState("")
  const [saving, setSaving]   = useState(false)
  const [clearing, setClearing] = useState(false)
  const [result, setResult]   = useState<"saved" | "cleared" | "error" | null>(null)
  const [currentHasPin, setCurrentHasPin] = useState(hasPin)
  const [pos, setPos]         = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleOpen() {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: r.left })
    }
    setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      const panel = document.getElementById("pin-panel-" + workerName.replace(/\s/g, "_"))
      if (panel && !panel.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false)
        setPin("")
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open, workerName])

  async function handleSet() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return
    setSaving(true)
    const res = await setWorkerPin(workerName, pin)
    setSaving(false)
    if (res.error) {
      setResult("error")
    } else {
      setResult("saved")
      setCurrentHasPin(true)
      setPin("")
      setOpen(false)
    }
    setTimeout(() => setResult(null), 3000)
  }

  async function handleClear() {
    if (!confirm(`Clear PIN for ${workerName}? They won't be able to access stations until a new PIN is set.`)) return
    setClearing(true)
    await clearWorkerPin(workerName)
    setClearing(false)
    setResult("cleared")
    setCurrentHasPin(false)
    setOpen(false)
    setTimeout(() => setResult(null), 3000)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="text-xs font-bold px-4 py-2 rounded-lg border border-gray-200 text-[#0D2240] hover:border-[#0D2240] transition-colors uppercase tracking-wide"
      >
        🔑 {currentHasPin ? "Change PIN" : "Set PIN"}
      </button>

      {result === "saved"   && <span className="ml-2 text-green-600 text-xs font-semibold">✓ PIN saved</span>}
      {result === "cleared" && <span className="ml-2 text-amber-600 text-xs font-semibold">PIN cleared</span>}
      {result === "error"   && <span className="ml-2 text-red-500 text-xs font-semibold">Error — try again</span>}

      {open && pos && (
        <div
          id={"pin-panel-" + workerName.replace(/\s/g, "_")}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-[240px]"
        >
          <p className="text-xs font-bold text-[#0D2240] mb-2 uppercase tracking-wide">
            {currentHasPin ? "Change PIN for " : "Set PIN for "}{workerName}
          </p>
          <p className="text-[10px] text-gray-400 mb-3">
            {currentHasPin
              ? "Current status: ●●●● (set). Enter a new 4-digit PIN to replace it."
              : "No PIN set — worker can't access stations yet."}
          </p>
          <div className="flex gap-2 items-center mb-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-center text-lg font-bold tracking-widest focus:outline-none focus:border-[#E8726A]"
            />
            <button
              onClick={handleSet}
              disabled={saving || pin.length !== 4}
              className="bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentHasPin && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
              >
                {clearing ? "Clearing…" : "Clear PIN"}
              </button>
            )}
            <button
              onClick={() => { setOpen(false); setPin("") }}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
