"use client"

import { useState } from "react"
import { setReceiptText } from "@/app/actions/settings"
import { DEFAULT_RECEIPT_TEXT, type ReceiptText } from "@/lib/receipt-text-config"

const FIELDS: { key: keyof ReceiptText; label: string; hint?: string }[] = [
  { key: "welcomeTag",  label: "1st order — tag",  hint: "Short all-caps line, e.g. \"WELCOME GIFT INSIDE\"" },
  { key: "welcomeText", label: "1st order — message", hint: "The thank-you line underneath the tag" },
  { key: "returningTag",  label: "2nd order — tag" },
  { key: "returningText", label: "2nd order — message" },
  { key: "loyalTag",  label: "3rd+ order — tag" },
  { key: "loyalText", label: "3rd+ order — message" },
  { key: "deliveryAddressLabel", label: "Delivery address section header" },
  { key: "colorKeyLabel", label: "Color key sticker label" },
  { key: "storageLabel", label: "\"Going to storage\" notice" },
  { key: "washPrefsLabel", label: "Wash preferences section header" },
  { key: "dueDateLabel", label: "Due-date line (under the date)" },
  { key: "footerNote", label: "Footer instruction line" },
]

export function ReceiptTextForm({ initial }: { initial: ReceiptText }) {
  const [form, setForm] = useState<ReceiptText>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set(key: keyof ReceiptText, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await setReceiptText(form)
    setSaving(false)
    setSaved(true)
  }

  function resetField(key: keyof ReceiptText) {
    set(key, DEFAULT_RECEIPT_TEXT[key])
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</label>
              {form[key] !== DEFAULT_RECEIPT_TEXT[key] && (
                <button
                  type="button"
                  onClick={() => resetField(key)}
                  className="text-[11px] text-gray-300 hover:text-gray-500"
                >Reset to default</button>
              )}
            </div>
            {hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
            <input
              type="text"
              value={form[key]}
              onChange={e => set(key, e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] font-medium outline-none focus:border-[#0D2240] transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-green-600 text-sm font-semibold">Saved</span>}
      </div>
    </form>
  )
}
