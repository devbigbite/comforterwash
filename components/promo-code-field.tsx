"use client"

import { useState } from "react"
import { validatePromoCode } from "@/app/actions/promos"

interface PromoResult {
  discountCents: number
  discountLabel: string
  description: string
}

interface Props {
  serviceType: string
  subtotalCents: number
  onApply: (code: string, discountCents: number) => void
  onRemove: () => void
}

export function PromoCodeField({ serviceType, subtotalCents, onApply, onRemove }: Props) {
  const [code, setCode] = useState("")
  const [applied, setApplied] = useState<PromoResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    if (!code.trim()) return
    setLoading(true)
    setError("")
    const result = await validatePromoCode(code.trim(), serviceType, subtotalCents)
    setLoading(false)
    if (result.valid) {
      setApplied({
        discountCents: result.discountCents!,
        discountLabel: result.discountLabel!,
        description: result.description ?? "",
      })
      onApply(code.trim().toUpperCase(), result.discountCents!)
    } else {
      setError(result.error ?? "Invalid code")
    }
  }

  function handleRemove() {
    setApplied(null)
    setCode("")
    setError("")
    onRemove()
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-green-700 font-bold text-sm">✓ {code.toUpperCase()}</span>
            <span className="text-green-600 text-xs font-semibold">{applied.discountLabel}</span>
          </div>
          {applied.description && <p className="text-xs text-green-600/70 mt-0.5">{applied.description}</p>}
        </div>
        <button type="button" onClick={handleRemove}
          className="text-xs text-green-600 hover:text-red-500 font-bold uppercase tracking-wide transition-colors">
          Remove
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError("") }}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          placeholder="Promo code"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#E8726A]"
        />
        <button type="button" onClick={handleApply} disabled={loading || !code.trim()}
          className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-sm px-5 rounded-xl transition-colors disabled:opacity-40 uppercase tracking-wide">
          {loading ? "…" : "Apply"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5 ml-1">{error}</p>}
    </div>
  )
}
