"use client"

import { useState, useEffect, useRef } from "react"
import { getBrandingSettings, setBrandingSettings, uploadBrandLogo, type BrandingSettings } from "@/app/actions/branding"
import { getFulfillmentMode, setFulfillmentMode, type FulfillmentMode } from "@/app/actions/walkin"

const FIELD_CLS = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20 bg-white"
const LABEL_CLS = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"

export default function BrandingPage() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getBrandingSettings().then(setSettings)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setError(null)
    const result = await setBrandingSettings(settings)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !settings) return
    setUploading(true)
    const fd = new FormData()
    fd.set("file", file)
    const result = await uploadBrandLogo(fd)
    setUploading(false)
    if (result.url) {
      setSettings({ ...settings, logo_url: result.url })
    } else if (result.error) {
      setError(result.error)
    }
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading branding…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Branding</h1>
        <p className="text-sm text-gray-400 mt-1">
          Business name, logo, colors, and contact info shown to customers across the site, receipts, and notifications.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Identity ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🏷️</span>
            <h2 className="font-extrabold text-[#0D2240] text-base">Identity</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLS}>Business name</label>
              <input className={FIELD_CLS} value={settings.business_name}
                onChange={e => setSettings(s => s && { ...s, business_name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Shown on the site, emails, SMS, and receipts.</p>
            </div>
            <div>
              <label className={LABEL_CLS}>Tagline (optional)</label>
              <input className={FIELD_CLS} placeholder="e.g. Pickup & Delivery Laundry Service" value={settings.tagline ?? ""}
                onChange={e => setSettings(s => s && { ...s, tagline: e.target.value })} />
            </div>
            <div>
              <label className={LABEL_CLS}>Logo</label>
              <div className="flex items-center gap-4">
                {settings.logo_url && (
                  <img src={settings.logo_url} alt="Logo preview" className="h-14 w-14 object-contain rounded-lg border border-gray-100 bg-white" />
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="text-xs font-bold text-[#E8726A] hover:text-[#d45f57] border border-[#E8726A]/30 hover:border-[#E8726A] px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                  {uploading ? "Uploading…" : settings.logo_url ? "Replace Logo" : "Upload Logo"}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Colors ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🎨</span>
            <h2 className="font-extrabold text-[#0D2240] text-base">Colors</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Primary color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.primary_color} className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer"
                  onChange={e => setSettings(s => s && { ...s, primary_color: e.target.value })} />
                <input className={FIELD_CLS} value={settings.primary_color}
                  onChange={e => setSettings(s => s && { ...s, primary_color: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Accent color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.accent_color} className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer"
                  onChange={e => setSettings(s => s && { ...s, accent_color: e.target.value })} />
                <input className={FIELD_CLS} value={settings.accent_color}
                  onChange={e => setSettings(s => s && { ...s, accent_color: e.target.value })} />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Used for buttons, links, and highlights in customer emails and receipts. Site-wide color theming across every page is a larger follow-up — this currently covers new emails/SMS.
          </p>
        </div>

        {/* ── Contact ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">📞</span>
            <h2 className="font-extrabold text-[#0D2240] text-base">Contact Info</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Support phone</label>
                <input className={FIELD_CLS} value={settings.support_phone}
                  onChange={e => setSettings(s => s && { ...s, support_phone: e.target.value })} />
              </div>
              <div>
                <label className={LABEL_CLS}>Support email</label>
                <input className={FIELD_CLS} value={settings.support_email}
                  onChange={e => setSettings(s => s && { ...s, support_email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Business address</label>
              <input className={FIELD_CLS} value={settings.address}
                onChange={e => setSettings(s => s && { ...s, address: e.target.value })} />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium bg-red-50 border border-red-200 text-red-600">{error}</div>
        )}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving}
            className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : "Save Branding"}
          </button>
          {saved && <span className="text-green-600 text-sm font-semibold">✓ Saved — live immediately</span>}
        </div>
      </form>

      <FulfillmentSection />
    </div>
  )
}

// ── Fulfillment mode — pickup/delivery vs. walk-in drop-off ───────────────────
function FulfillmentSection() {
  const [mode, setMode] = useState<FulfillmentMode | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getFulfillmentMode().then(setMode)
  }, [])

  async function save(next: FulfillmentMode) {
    setSaving(true)
    setMode(next)
    await setFulfillmentMode(next)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!mode) return null

  const OPTIONS: { value: FulfillmentMode; label: string; desc: string }[] = [
    { value: "delivery", label: "Pickup & Delivery", desc: "Driver picks up and delivers every order (default)." },
    { value: "walkin", label: "Walk-In Only", desc: "Customers drop bags off in person and pick them up — no driver dispatch." },
    { value: "both", label: "Both", desc: "Offer pickup/delivery and take walk-in drop-offs." },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🚪</span>
        <h2 className="font-extrabold text-[#0D2240] text-base">Fulfillment</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">How customers get their laundry to and from you.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            disabled={saving}
            onClick={() => save(opt.value)}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${
              mode === opt.value ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 hover:border-gray-200"
            }`}
          >
            <p className="font-bold text-[#0D2240] text-sm">{opt.label}</p>
            <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
          </button>
        ))}
      </div>
      {saved && <p className="text-green-600 text-sm font-semibold mt-3">✓ Saved</p>}
    </div>
  )
}
