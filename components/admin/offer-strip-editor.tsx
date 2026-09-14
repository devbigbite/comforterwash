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
  initialEnabled,
  promoCodes,
}: {
  initialText: string
  initialTextEs: string
  initialCode: string
  initialEnabled: string
  promoCodes: PromoCodeOption[]
}) {
  const [text, setText] = useState(initialText)
  const [textEs, setTextEs] = useState(initialTextEs)
  const [code, setCode] = useState(initialCode)
  // Explicit on/off, independent of the text fields -- previously "blank
  // text" was the only way to turn this off, and a bug meant an
  // intentionally-cleared blank silently fell back to the default promo
  // text anyway. A real toggle removes any ambiguity.
  const [enabled, setEnabled] = useState(initialEnabled !== "false")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await Promise.all([
      setSiteTextValue("offer_strip_enabled", enabled ? "true" : "false"),
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-extrabold text-[#0D2240] text-sm">Homepage Offer Strip</p>
            <p className="text-xs text-gray-400 mt-0.5">The thin promo bar shown right below the homepage hero.</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(v => !v)}
            className={`shrink-0 flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${enabled ? "bg-green-500" : "bg-gray-400"}`} />
            {enabled ? "ON" : "OFF"}
          </button>
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
