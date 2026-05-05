"use client"

import { useState } from "react"
import { setLandingOffer, type LandingOffer } from "@/app/actions/settings"

const OVERLAYS = [
  "bg-[#0D2240]/60",
  "bg-[#E8726A]/50",
  "bg-[#1a3a5c]/60",
]

export function LandingOffersEditor({ initialOffers }: { initialOffers: LandingOffer[] }) {
  const [offers, setOffers] = useState<LandingOffer[]>(initialOffers)
  const [saving, setSaving] = useState<number | null>(null)
  const [saved, setSaved] = useState<number | null>(null)

  async function handleSave(i: number) {
    setSaving(i)
    await setLandingOffer(i, offers[i])
    setSaving(null)
    setSaved(i)
    setTimeout(() => setSaved(null), 2000)
  }

  function update(i: number, field: keyof LandingOffer, value: string | boolean) {
    setOffers(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: value } : o))
  }

  return (
    <div className="space-y-4">
      {offers.map((offer, i) => (
        <div key={i} className={`rounded-2xl border-2 shadow-sm p-5 transition-all ${offer.enabled ? "border-[#0D2240]/20 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Preview badge */}
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-extrabold text-xs text-center leading-tight ${OVERLAYS[i].replace("/60", "").replace("/50", "")} bg-[#0D2240]`}>
                {offer.badge}
              </div>
              <div>
                <p className="font-extrabold text-[#0D2240] text-sm">Offer {i + 1}</p>
                <p className="text-xs text-gray-400">{offer.enabled ? "Visible on site" : "Hidden from site"}</p>
              </div>
            </div>
            {/* Toggle */}
            <button
              onClick={() => { update(i, "enabled", !offer.enabled) }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${offer.enabled ? "bg-[#E8726A]" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${offer.enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Badge Text</label>
              <input
                value={offer.badge}
                onChange={e => update(i, "badge", e.target.value)}
                placeholder="15% OFF"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#E8726A]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Title</label>
              <input
                value={offer.title}
                onChange={e => update(i, "title", e.target.value)}
                placeholder="Offer title"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Description</label>
            <textarea
              value={offer.desc}
              onChange={e => update(i, "desc", e.target.value)}
              rows={2}
              placeholder="Offer description shown on the homepage"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#E8726A]"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            {saved === i && (
              <span className="text-xs text-green-600 font-semibold">✓ Saved</span>
            )}
            <button
              onClick={() => handleSave(i)}
              disabled={saving === i}
              className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-wide"
            >
              {saving === i ? "Saving…" : "Save Offer"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
