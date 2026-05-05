"use client"

import { useState, useEffect } from "react"
import { getPricingConfig, setPricingConfig, type PricingConfig } from "@/app/actions/pricing"
import { getAllServiceOptions, upsertServiceOption, deleteServiceOption, toggleServiceOption, type ServiceOption } from "@/app/actions/service-options"
import Link from "next/link"

function cents(val: number) { return `$${(val / 100).toFixed(2)}` }
function dollarsToField(val: number) { return (val / 100).toFixed(2) }
function fieldToCents(str: string) { return Math.round(parseFloat(str) * 100) }

const BLANK_OPTION = (type: "detergent" | "extra"): Partial<ServiceOption> => ({
  type, name: "", description: "", price_cents: 0, enabled: true,
})

function OptionsSection({
  title, icon, type, options, onRefresh,
}: {
  title: string; icon: string; type: "detergent" | "extra"
  options: ServiceOption[]; onRefresh: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<ServiceOption>>(BLANK_OPTION(type))
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!draft.name?.trim()) return
    setBusy(true)
    await upsertServiceOption({ ...draft, type } as ServiceOption & { type: "detergent" | "extra"; name: string })
    setBusy(false)
    setAdding(false)
    setEditingId(null)
    setDraft(BLANK_OPTION(type))
    onRefresh()
  }

  async function remove(id: string) {
    if (!confirm("Delete this option?")) return
    await deleteServiceOption(id)
    onRefresh()
  }

  async function toggle(id: string, enabled: boolean) {
    await toggleServiceOption(id, enabled)
    onRefresh()
  }

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20 bg-white w-full"

  function DraftForm() {
    return (
      <div className="mt-3 p-4 bg-[#f8faff] rounded-xl border border-[#0D2240]/10 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <input className={inputCls} placeholder="e.g. Tide" value={draft.name ?? ""} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price (leave 0 = free)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
              <input type="number" step="0.01" min="0" className={inputCls + " pl-6"}
                value={dollarsToField(draft.price_cents ?? 0)}
                onChange={e => setDraft(d => ({ ...d, price_cents: fieldToCents(e.target.value) }))} />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
          <input className={inputCls} placeholder="Short description shown to customers" value={draft.description ?? ""} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={busy || !draft.name?.trim()} className="bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors">
            {busy ? "Saving…" : "Save"}
          </button>
          <button onClick={() => { setAdding(false); setEditingId(null); setDraft(BLANK_OPTION(type)) }} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h2 className="font-extrabold text-[#0D2240] text-base">{title}</h2>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditingId(null); setDraft(BLANK_OPTION(type)) }}
            className="text-xs font-bold text-[#E8726A] hover:text-[#d45f57] border border-[#E8726A]/30 hover:border-[#E8726A] px-3 py-1.5 rounded-lg transition-colors">
            + Add Option
          </button>
        )}
      </div>

      {options.length === 0 && !adding && (
        <p className="text-sm text-gray-400 text-center py-4">No options yet. Add one above.</p>
      )}

      <div className="divide-y divide-gray-50">
        {options.map(opt => (
          <div key={opt.id} className={`py-3 ${!opt.enabled ? "opacity-50" : ""}`}>
            {editingId === opt.id ? (
              <DraftForm />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#0D2240]">{opt.name}</span>
                    {opt.price_cents > 0
                      ? <span className="text-xs bg-[#0D2240] text-white font-bold px-2 py-0.5 rounded-full">{cents(opt.price_cents)}</span>
                      : <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Free</span>
                    }
                    {!opt.enabled && <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">Hidden</span>}
                  </div>
                  {opt.description && <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditingId(opt.id); setDraft({ ...opt }); setAdding(false) }}
                    className="text-xs text-gray-400 hover:text-[#0D2240] font-semibold transition-colors">Edit</button>
                  <button onClick={() => toggle(opt.id, !opt.enabled)}
                    className="text-xs text-gray-400 hover:text-[#0D2240] font-semibold transition-colors">
                    {opt.enabled ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => remove(opt.id)}
                    className="text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && <DraftForm />}
    </div>
  )
}

export default function PricingPage() {
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [detergents, setDetergents] = useState<ServiceOption[]>([])
  const [extras, setExtras] = useState<ServiceOption[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function loadAll() {
    const [cfg, dets, exts] = await Promise.all([
      getPricingConfig(),
      getAllServiceOptions("detergent"),
      getAllServiceOptions("extra"),
    ])
    setConfig(cfg)
    setDetergents(dets)
    setExtras(exts)
  }

  useEffect(() => { loadAll() }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!config) return
    setSaving(true)
    await setPricingConfig(config)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function setField(key: keyof PricingConfig, dollars: string) {
    if (!config) return
    setConfig({ ...config, [key]: fieldToCents(dollars) })
  }

  function setInt(key: keyof PricingConfig, val: string) {
    if (!config) return
    setConfig({ ...config, [key]: parseInt(val, 10) || 0 })
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#f8faff] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading pricing…</div>
      </div>
    )
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20 bg-white"
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <header className="bg-[#0D2240] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="24" fill="#0D2240" />
            <circle cx="24" cy="24" r="22" fill="#142d52" />
            <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
              stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
          <span className="text-white font-extrabold text-lg tracking-tight">
            Wash<span className="text-[#E8726A]">Fold</span>
            <span className="ml-1.5 text-white/40 text-xs font-semibold uppercase tracking-widest">Admin</span>
          </span>
        </div>
        <Link href="/admin" className="text-white/60 hover:text-white text-sm transition-colors">← Dashboard</Link>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Pricing</h1>
          <p className="text-sm text-gray-400 mt-1">Changes take effect immediately for all new bookings.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Wash & Fold ─────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">👕</span>
              <h2 className="font-extrabold text-[#0D2240] text-base">Wash &amp; Fold</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>One-time rate ($/lb)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                  <input type="number" step="0.01" min="0" className={inputCls + " pl-7"}
                    value={dollarsToField(config.washFoldOneTimeCents)}
                    onChange={e => setField("washFoldOneTimeCents", e.target.value)} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Currently {cents(config.washFoldOneTimeCents)}/lb</p>
              </div>
              <div>
                <label className={labelCls}>Subscription rate ($/lb)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                  <input type="number" step="0.01" min="0" className={inputCls + " pl-7"}
                    value={dollarsToField(config.washFoldSubCents)}
                    onChange={e => setField("washFoldSubCents", e.target.value)} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Weekly &amp; biweekly · currently {cents(config.washFoldSubCents)}/lb</p>
              </div>
              <div>
                <label className={labelCls}>Minimum (lbs)</label>
                <input type="number" min="1" className={inputCls}
                  value={config.washFoldMinLbs}
                  onChange={e => setInt("washFoldMinLbs", e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Wash Only ───────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🧺</span>
              <h2 className="font-extrabold text-[#0D2240] text-base">Wash Only</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Rate ($/lb)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                  <input type="number" step="0.01" min="0" className={inputCls + " pl-7"}
                    value={dollarsToField(config.washOnlyCents)}
                    onChange={e => setField("washOnlyCents", e.target.value)} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Currently {cents(config.washOnlyCents)}/lb</p>
              </div>
              <div>
                <label className={labelCls}>Minimum (lbs)</label>
                <input type="number" min="1" className={inputCls}
                  value={config.washOnlyMinLbs}
                  onChange={e => setInt("washOnlyMinLbs", e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Comforter ───────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🛏️</span>
              <h2 className="font-extrabold text-[#0D2240] text-base">Comforter Wash</h2>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Regular Prices (per size)</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {(["Twin", "Full", "Queen", "King"] as const).map(size => {
                const key = `comforter${size}Cents` as keyof PricingConfig
                return (
                  <div key={size}>
                    <label className={labelCls}>{size}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                      <input type="number" step="0.01" min="0" className={inputCls + " pl-7"}
                        value={dollarsToField(config[key] as number)}
                        onChange={e => setField(key, e.target.value)} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Currently {cents(config[key] as number)}</p>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Flat-Rate Promotion Price</p>
              <div className="max-w-[200px]">
                <label className={labelCls}>Promo flat rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                  <input type="number" step="0.01" min="0" className={inputCls + " pl-7"}
                    value={dollarsToField(config.comforterPromoCents)}
                    onChange={e => setField("comforterPromoCents", e.target.value)} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Shown when promo active · currently {cents(config.comforterPromoCents)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Toggle on/off from{" "}
                <Link href="/admin/settings" className="text-[#E8726A] hover:underline font-semibold">Promotions</Link>.
              </p>
            </div>
          </div>

          {/* ── Save pricing ────────────────────────────── */}
          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving}
              className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-sm disabled:opacity-60">
              {saving ? "Saving…" : "Save Pricing"}
            </button>
            {saved && <span className="text-green-600 text-sm font-semibold">✓ Saved — live immediately</span>}
          </div>
        </form>

        {/* ── Detergent Options ───────────────────────── */}
        <OptionsSection
          title="Detergent Options"
          icon="🧴"
          type="detergent"
          options={detergents}
          onRefresh={loadAll}
        />

        {/* ── Treatment Extras ────────────────────────── */}
        <OptionsSection
          title="Treatment Extras"
          icon="✨"
          type="extra"
          options={extras}
          onRefresh={loadAll}
        />
      </div>
    </div>
  )
}
