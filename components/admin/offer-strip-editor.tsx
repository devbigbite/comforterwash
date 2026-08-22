"use client"

import { useState } from "react"
import { setSiteTextValue } from "@/app/actions/settings"

type PromoCodeOption = {
  code: string
  description?: string | null
  discount_type: string
  discount_value: number
}

export function OfferStripEditor({
  initialText,
  initialTextEs,
  initialCode,
  promoCodes,
}: {
  initialText: string
  initialTextEs: string
  initialCode: string
  promoCodes: PromoCodeOption[]
}) {
  const [text, setText] = useState(initialText)
  const [textEs, setTextEs] = useState(initialTextEs)
  const [code, setCode] = useState(initialCode)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await Promise.all([
      setSiteTextValue("offer_strip_text", text),
      setSiteTextValue("offer_strip_text_es", textEs),
      setSiteTextValue("offer_strip_code", code),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const linkedPromo = promoCodes.find(p => p.code === code)

  return (
    <div className="rounded-2xl border-2 border-[#0D2240]/10 bg-white shadow-sm overflow-hidden">
      <div className="p-5 space-y-4">
        <div>
          <p className="font-extrabold text-[#0D2240] text-sm">Homepage Offer Strip</p>
          <p className="text-xs text-gray-400 mt-0.5">The thin promo bar shown right below the homepage hero. Leave the text blank to hide it entirely.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Offer text (EN)</label>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="$20 OFF Your First Order"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-[#E8726A]"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Offer text (ES) — optional</label>
            <input
              value={textEs}
              onChange={e => setTextEs(e.target.value)}
              placeholder="$20 DE DESCUENTO en tu primera orden"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Promo code to display &amp; apply</label>
          <select
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#E8726A]"
          >
            <option value="">No code (text only)</option>
            {promoCodes.map(p => (
              <option key={p.code} value={p.code}>
                {p.code} — {p.discount_type === "percent" ? `${p.discount_value}% off` : `$${p.discount_value.toFixed(2)} off`}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">
            {code
              ? linkedPromo
                ? "This code is active and will actually apply the discount at checkout."
                : "This code isn't in your active Promo Codes list below — create it there so it works at checkout."
              : "Create an active promo code below, then pick it here so the offer strip actually works at checkout, not just as a headline."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && <span className="text-xs text-green-600 font-semibold">✓ Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-wide"
          >
            {saving ? "Saving…" : "Save Offer Strip"}
          </button>
        </div>
      </div>
    </div>
  )
}
