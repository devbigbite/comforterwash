"use client"

import { useState } from "react"
import { validateGiftCard } from "@/app/actions/gift-cards"
import { useLang } from "@/components/lang-provider"

interface GiftCardResult {
  discountCents: number
  remainingBalanceCents: number
}

interface Props {
  subtotalCents: number
  onApply: (code: string, discountCents: number) => void
  onRemove: () => void
}

const STRINGS = {
  en: {
    placeholder: "Gift card code",
    apply: "Apply",
    remove: "Remove",
    invalid: "Invalid gift card code.",
    applied: "Gift card applied",
    remaining: "remaining after this order",
  },
  es: {
    placeholder: "Código de tarjeta de regalo",
    apply: "Aplicar",
    remove: "Quitar",
    invalid: "Código de tarjeta de regalo inválido.",
    applied: "Tarjeta de regalo aplicada",
    remaining: "restante después de este pedido",
  },
}

export function GiftCardField({ subtotalCents, onApply, onRemove }: Props) {
  const [code, setCode] = useState("")
  const [applied, setApplied] = useState<GiftCardResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { locale } = useLang()
  const t = STRINGS[locale] ?? STRINGS.en

  async function handleApply() {
    if (!code.trim()) return
    setLoading(true)
    setError("")
    const result = await validateGiftCard(code.trim(), subtotalCents)
    setLoading(false)
    if (result.valid) {
      setApplied({
        discountCents: result.discountCents!,
        remainingBalanceCents: result.remainingBalanceCents!,
      })
      onApply(result.code!.toUpperCase(), result.discountCents!)
    } else {
      setError(result.error ?? t.invalid)
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
      <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-purple-700 font-bold text-sm">🎁 {code.toUpperCase()}</span>
            <span className="text-purple-600 text-xs font-semibold">-${(applied.discountCents / 100).toFixed(2)}</span>
          </div>
          <p className="text-xs text-purple-600/70 mt-0.5">
            {t.applied}{applied.remainingBalanceCents > 0 ? ` — $${(applied.remainingBalanceCents / 100).toFixed(2)} ${t.remaining}` : ""}
          </p>
        </div>
        <button type="button" onClick={handleRemove}
          className="text-xs text-purple-600 hover:text-red-500 font-bold uppercase tracking-wide transition-colors">
          {t.remove}
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
          placeholder={t.placeholder}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-purple-400"
        />
        <button type="button" onClick={handleApply} disabled={loading || !code.trim()}
          className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-sm px-5 rounded-xl transition-colors disabled:opacity-40 uppercase tracking-wide">
          {loading ? "…" : t.apply}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5 ml-1">{error}</p>}
    </div>
  )
}
