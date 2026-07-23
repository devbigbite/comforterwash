"use client"

import { useState, useEffect, useRef } from "react"
import {
  getBrandingSettings, setBrandingSettings, uploadBrandLogo, getDispatchSettings, setDispatchSettings,
  getEmailDomainStatus, addEmailDomain, checkEmailDomainVerification, removeEmailDomain, setEmailLocalPart,
  getOperatingMode, setOperatingMode, getHomeDailyCapacity, setHomeDailyCapacity, type OperatingMode,
  getAdminViewMode,
  type BrandingSettings, type DispatchSettings, type EmailDomainStatus,
} from "@/app/actions/branding"
import { getFulfillmentMode, setFulfillmentMode, type FulfillmentMode } from "@/app/actions/walkin"

const FIELD_CLS = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20 bg-white"
const LABEL_CLS = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"

export default function BrandingPage() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isAdvanced, setIsAdvanced] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getBrandingSettings().then(setSettings)
    getAdminViewMode().then(m => setIsAdvanced(m === "advanced"))
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

      <OperatingModeSection />
      <FulfillmentSection />
      {isAdvanced && <EmailDomainSection />}
      <DispatchSection />
    </div>
  )
}

// ── Custom sending domain (Resend) — verify your own domain so emails come
// from your brand instead of the shared clean@washfoldorlando.com address ──
function EmailDomainSection() {
  const [status, setStatus] = useState<EmailDomainStatus | null>(null)
  const [domainInput, setDomainInput] = useState("")
  const [localPart, setLocalPart] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function load() {
    getEmailDomainStatus().then(s => {
      setStatus(s)
      setLocalPart(s.fromEmail?.split("@")[0] ?? "hello")
    })
  }

  useEffect(() => { load() }, [])

  async function handleAddDomain(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await addEmailDomain(domainInput)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setDomainInput("")
    load()
  }

  async function handleCheck() {
    setBusy(true)
    setError(null)
    const result = await checkEmailDomainVerification()
    setBusy(false)
    if (result.error) setError(result.error)
    setStatus(result)
  }

  async function handleRemove() {
    if (!confirm("Remove this domain? Emails will go back to the shared sending address.")) return
    setBusy(true)
    await removeEmailDomain()
    setBusy(false)
    load()
  }

  async function handleSaveLocalPart() {
    setBusy(true)
    setError(null)
    const result = await setEmailLocalPart(localPart)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    load()
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(null), 1500)
  }

  if (!status) return null

  const STATUS_STYLES: Record<string, string> = {
    verified: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    not_started: "bg-gray-50 text-gray-500 border-gray-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    temporary_failure: "bg-red-50 text-red-700 border-red-200",
    not_configured: "bg-gray-50 text-gray-500 border-gray-200",
  }
  const STATUS_LABELS: Record<string, string> = {
    verified: "Verified — sending from your domain",
    pending: "Pending — add the records below",
    not_started: "Not started",
    failed: "Failed",
    temporary_failure: "Temporary failure",
    not_configured: "Not configured",
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">✉️</span>
        <h2 className="font-extrabold text-[#0D2240] text-base">Custom Sending Domain</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Send booking confirmations, reminders, and receipts from your own domain instead of the shared address.
        Requires adding a few DNS records at your domain registrar to prove ownership.
      </p>

      {!status.domain ? (
        <form onSubmit={handleAddDomain} className="space-y-3">
          <div>
            <label className={LABEL_CLS}>Domain</label>
            <input className={FIELD_CLS} placeholder="mail.yourbusiness.com" value={domainInput}
              onChange={e => setDomainInput(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              A subdomain (e.g. <span className="font-mono">mail.yourbusiness.com</span>) is recommended so it doesn&apos;t interfere with your existing website or inbox DNS.
            </p>
          </div>
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium bg-red-50 border border-red-200 text-red-600">{error}</div>
          )}
          <button type="submit" disabled={busy}
            className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-sm disabled:opacity-60">
            {busy ? "Adding…" : "Add Domain"}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-bold text-[#0D2240] text-sm">{status.domain}</p>
              <span className={`inline-block mt-1 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${STATUS_STYLES[status.status]}`}>
                {STATUS_LABELS[status.status] ?? status.status}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleCheck} disabled={busy}
                className="text-xs font-bold text-[#0D2240] border border-gray-200 hover:border-[#0D2240] px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {busy ? "Checking…" : "Check Verification"}
              </button>
              <button type="button" onClick={handleRemove} disabled={busy}
                className="text-xs text-gray-400 hover:text-red-500 underline transition-colors disabled:opacity-40">
                Remove
              </button>
            </div>
          </div>

          {status.status !== "verified" && status.records.length > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#f7f8fb] border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-bold text-gray-400 uppercase tracking-wide">Type</th>
                    <th className="text-left px-3 py-2 font-bold text-gray-400 uppercase tracking-wide">Name</th>
                    <th className="text-left px-3 py-2 font-bold text-gray-400 uppercase tracking-wide">Value</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {status.records.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{r.type}</td>
                      <td className="px-3 py-2 font-mono break-all">{r.name}</td>
                      <td className="px-3 py-2 font-mono break-all text-gray-500">{r.value}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button type="button" onClick={() => copy(r.value)} className="text-[#E8726A] hover:text-[#d45f57] font-bold">
                          {copied === r.value ? "✓" : "Copy"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 px-3 py-2 bg-[#f7f8fb]">
                Add these records at your domain&apos;s DNS provider, then click &quot;Check Verification&quot;. This can take a few minutes to a few hours to propagate.
              </p>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={LABEL_CLS}>Send from</label>
              <div className="flex items-center gap-1.5">
                <input className={FIELD_CLS} value={localPart} onChange={e => setLocalPart(e.target.value)} />
                <span className="text-sm text-gray-400 font-mono">@{status.domain}</span>
              </div>
            </div>
            <button type="button" onClick={handleSaveLocalPart} disabled={busy}
              className="text-xs font-bold text-[#0D2240] border border-gray-200 hover:border-[#0D2240] px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50">
              Save
            </button>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium bg-red-50 border border-red-200 text-red-600">{error}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Delivery dispatch (Shipday) — each tenant brings their own account so
// driver dispatch/tracking is fully isolated, not shared across tenants ──────
function DispatchSection() {
  const [settings, setSettingsState] = useState<DispatchSettings | null>(null)
  const [usesDispatchApp, setUsesDispatchApp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDispatchSettings().then(s => {
      setSettingsState(s)
      setUsesDispatchApp(!!s.shipday_api_key)
    })
  }, [])

  async function handleSubmit() {
    if (!settings) return
    setSaving(true)
    setError(null)
    // If they've said "no", drop any previously-saved key rather than requiring
    // them to clear the field themselves — the toggle is the source of truth.
    const toSave = usesDispatchApp ? settings : { ...settings, shipday_api_key: "" }
    const result = await setDispatchSettings(toSave)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSettingsState(toSave)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!settings) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🚚</span>
        <h2 className="font-extrabold text-[#0D2240] text-base">Delivery Tracking &amp; Dispatch</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Do you use Shipday for delivery tracking and customer notifications? This isn't only for businesses with hired
        drivers — plenty of solo/home-based operators use it too, just for the live tracking link and status texts it
        sends customers, even while driving the orders themselves.
      </p>

      <div className="flex gap-2 mb-5">
        <button type="button" onClick={() => setUsesDispatchApp(false)}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold border transition-colors ${
            !usesDispatchApp ? "border-[#0D2240] bg-[#0D2240]/5 text-[#0D2240]" : "border-gray-100 text-gray-400 hover:border-gray-200"
          }`}>
          No, skip this
        </button>
        <button type="button" onClick={() => setUsesDispatchApp(true)}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold border transition-colors ${
            usesDispatchApp ? "border-[#0D2240] bg-[#0D2240]/5 text-[#0D2240]" : "border-gray-100 text-gray-400 hover:border-gray-200"
          }`}>
          Yes, connect Shipday
        </button>
      </div>

      {!usesDispatchApp ? (
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 mb-1">
          That's the default — new orders won't be sent to Shipday for tracking or driver routing. You can turn this on any time, whether or not you use your own drivers.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Connect your own{" "}
            <a href="https://www.shipday.com" target="_blank" rel="noopener noreferrer" className="underline text-[#E8726A]">
              Shipday
            </a>{" "}
            account so your drivers, routes, and live tracking are completely separate from any other business on this platform.
            Find your API key under Shipday → Settings → API Keys.
          </p>
          <div>
            <label className={LABEL_CLS}>Shipday API key</label>
            <input type="password" className={FIELD_CLS} value={settings.shipday_api_key}
              onChange={e => setSettingsState(s => s && { ...s, shipday_api_key: e.target.value })}
              placeholder="Paste your Shipday API key" autoComplete="off" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Facility phone</label>
              <input className={FIELD_CLS} value={settings.business_phone}
                onChange={e => setSettingsState(s => s && { ...s, business_phone: e.target.value })} />
            </div>
            <div>
              <label className={LABEL_CLS}>Facility address</label>
              <input className={FIELD_CLS} value={settings.business_address}
                onChange={e => setSettingsState(s => s && { ...s, business_address: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            This is where drivers pick up processed orders from — it can differ from the public business address above.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium bg-red-50 border border-red-200 text-red-600 mt-4">{error}</div>
      )}
      <div className="flex items-center gap-4 mt-5">
        <button type="button" disabled={saving} onClick={handleSubmit}
          className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-sm disabled:opacity-60">
          {saving ? "Saving…" : "Save Dispatch Settings"}
        </button>
        {saved && <span className="text-green-600 text-sm font-semibold">✓ Saved</span>}
      </div>
    </div>
  )
}

// ── Fulfillment mode — pickup/delivery vs. walk-in drop-off ───────────────────
// ── Operating mode (Facility / Home) — how do you actually do the work? ──────
// Distinct from Fulfillment above (which is about how orders get to/from the
// customer) — this is about whether there's a facility/staff behind the
// scenes or just one person and one washer/dryer. Drives which nav sections
// show and whether a daily load cap applies to the booking calendar.
function OperatingModeSection() {
  const [mode, setMode] = useState<OperatingMode | null>(null)
  const [capacity, setCapacity] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([getOperatingMode(), getHomeDailyCapacity()]).then(([m, cap]) => {
      setMode(m)
      setCapacity(cap ? String(cap) : "")
    })
  }, [])

  async function saveMode(next: OperatingMode) {
    setSaving(true)
    setMode(next)
    await setOperatingMode(next)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveCapacity() {
    setSaving(true)
    await setHomeDailyCapacity(capacity.trim() ? parseInt(capacity, 10) : null)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!mode) return null

  const OPTIONS: { value: OperatingMode; label: string; desc: string }[] = [
    { value: "facility", label: "I run a facility", desc: "Staff, a physical facility/rack system, and/or multiple drivers." },
    { value: "home", label: "I work from home", desc: "Just me, my own washer & dryer — no facility, no staff to coordinate." },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🏠</span>
        <h2 className="font-extrabold text-[#0D2240] text-base">How You Work</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">This changes what shows up in your admin menu — nothing about pricing or bookings changes.</p>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            disabled={saving}
            onClick={() => saveMode(opt.value)}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${
              mode === opt.value ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 hover:border-gray-200"
            }`}
          >
            <p className="font-bold text-[#0D2240] text-sm">{opt.label}</p>
            <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
          </button>
        ))}
      </div>

      {mode === "home" && (
        <div className="border-t border-gray-100 pt-4">
          <label className={LABEL_CLS}>Loads you can realistically do per day</label>
          <div className="flex items-center gap-3">
            <input
              type="number" min="1" value={capacity}
              onChange={e => setCapacity(e.target.value)}
              placeholder="Unlimited"
              className={`${FIELD_CLS} max-w-[140px]`}
            />
            <button
              type="button" disabled={saving} onClick={saveCapacity}
              className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 uppercase tracking-wide"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Once a day hits this many loads, customers won't be able to book that day at all — leave blank for no limit.
          </p>
        </div>
      )}

      {saved && <p className="text-green-600 text-sm font-semibold mt-3">✓ Saved</p>}
    </div>
  )
}

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
