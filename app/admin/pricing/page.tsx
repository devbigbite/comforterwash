"use client"

import React, { useState, useEffect } from "react"
import { getPricingConfig, setPricingConfig, type PricingConfig } from "@/app/actions/pricing"
import { getAllServiceOptions, upsertServiceOption, deleteServiceOption, toggleServiceOption, setHypoallergenic, type ServiceOption } from "@/app/actions/service-options"
import { isSaleActive } from "@/lib/service-option-utils"
import { getDeliveryFeeSettings, setDeliveryFeeSettings, type DeliveryFeeSettings, getServicesConfig, setServicesConfig, type ServicesConfig, getMonthlyPlanEnabled, setMonthlyPlanEnabled, getTipsEnabled, setTipsEnabled, getFreePickupDeliveryLineEnabled, setFreePickupDeliveryLineEnabled } from "@/app/actions/settings"
import Link from "next/link"

function cents(val: number) { return `$${(val / 100).toFixed(2)}` }
function dollarsToField(val: number) { return (val / 100).toFixed(2) }
function fieldToCents(str: string) { return Math.round(parseFloat(str) * 100) }

const BLANK_OPTION = (type: "detergent" | "extra" | "accessory"): Partial<ServiceOption> => ({
  type, name: "", description: "", price_cents: 0, enabled: true, pricing_unit: "per_order",
})

const UNIT_LABEL: Record<string, string> = {
  per_order: "per order",
  per_pound: "per lb",
  per_item:  "per item",
  per_load:  "per load",
}
const UNIT_OPTIONS: { value: "per_order" | "per_pound" | "per_item" | "per_load"; label: string; hint: string }[] = [
  { value: "per_order", label: "By the order",  hint: "Charged once per order (current default)" },
  { value: "per_pound", label: "By the pound",   hint: "Price × estimated/actual weight" },
  { value: "per_item",  label: "Per item",       hint: "Price × quantity of items (e.g. comforters)" },
  { value: "per_load",  label: "By the load",    hint: "Price × number of bags/loads" },
]

function OptionsSection({
  title, icon, type, options, onRefresh,
}: {
  title: string; icon: string; type: "detergent" | "extra" | "accessory"
  options: ServiceOption[]; onRefresh: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<ServiceOption>>(BLANK_OPTION(type))
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragId = React.useRef<string | null>(null)

  async function handleDrop(targetId: string) {
    const fromId = dragId.current
    if (!fromId || fromId === targetId) { setDragOver(null); return }
    const from = options.findIndex(o => o.id === fromId)
    const to   = options.findIndex(o => o.id === targetId)
    if (from === -1 || to === -1) { setDragOver(null); return }
    const reordered = [...options]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setDragOver(null)
    dragId.current = null
    // Persist new sort_order values
    await Promise.all(
      reordered.map((opt, i) => upsertServiceOption({ ...opt, sort_order: i }))
    )
    onRefresh()
  }

  async function save() {
    if (!draft.name?.trim()) return
    setBusy(true)
    await upsertServiceOption({ ...draft, type } as ServiceOption & { type: "detergent" | "extra" | "accessory"; name: string })
    setBusy(false)
    setAdding(false)
    setEditingId(null)
    setDraft(BLANK_OPTION(type))
    onRefresh()
  }

  function cancelDraft() {
    setAdding(false)
    setEditingId(null)
    setDraft(BLANK_OPTION(type))
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

  async function toggleHypo(id: string, current: boolean) {
    await setHypoallergenic(id, !current)
    onRefresh()
  }

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20 bg-white w-full"

  // Inline draft form — NOT a nested component (avoids remount-on-rerender focus loss)
  const draftForm = (
    <div className="mt-3 p-4 bg-[#f8faff] rounded-xl border border-[#0D2240]/10 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Name</label>
          <input className={inputCls} placeholder="e.g. Tide" value={draft.name ?? ""}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Regular price (0 = free)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
            <input type="number" step="0.01" min="0" className={inputCls + " pl-6"}
              value={dollarsToField(draft.price_cents ?? 0)}
              onChange={e => setDraft(d => ({ ...d, price_cents: fieldToCents(e.target.value) }))} />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Charge</label>
        <select className={inputCls}
          value={draft.pricing_unit ?? "per_order"}
          onChange={e => setDraft(d => ({ ...d, pricing_unit: e.target.value as ServiceOption["pricing_unit"] }))}>
          {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
        <p className="text-[10px] text-gray-400 mt-1">
          {UNIT_OPTIONS.find(u => u.value === (draft.pricing_unit ?? "per_order"))?.hint}
        </p>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description (English)</label>
        <input className={inputCls} placeholder="Short description shown to customers" value={draft.description ?? ""}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
      </div>

      {/* Spanish translations */}
      <div className="border-t border-[#0D2240]/10 pt-3">
        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">🇪🇸 Spanish Translation (optional)</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Name (Spanish)</label>
            <input className={inputCls} placeholder="e.g. Detergente Estándar" value={draft.name_es ?? ""}
              onChange={e => setDraft(d => ({ ...d, name_es: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description (Spanish)</label>
            <input className={inputCls} placeholder="Descripción corta en español" value={draft.description_es ?? ""}
              onChange={e => setDraft(d => ({ ...d, description_es: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Requires comforter — only relevant for accessories */}
      {type === "accessory" && (
        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-[#0D2240]"
              checked={!!draft.requires_comforter}
              onChange={e => setDraft(d => ({ ...d, requires_comforter: e.target.checked }))} />
            <span className="text-xs font-bold text-gray-600">Only show when customer adds comforters</span>
          </label>
        </div>
      )}

      {/* Sale price */}
      <div className="border-t border-[#0D2240]/10 pt-3">
        <p className="text-[10px] font-bold text-[#E8726A] uppercase tracking-wider mb-2">🏷️ Limited-Time Sale (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sale price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
              <input type="number" step="0.01" min="0" className={inputCls + " pl-6"}
                placeholder="Leave blank to remove"
                value={draft.sale_price_cents != null ? dollarsToField(draft.sale_price_cents) : ""}
                onChange={e => setDraft(d => ({
                  ...d,
                  sale_price_cents: e.target.value === "" ? null : fieldToCents(e.target.value),
                }))} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sale ends (optional)</label>
            <input type="datetime-local" className={inputCls}
              value={draft.sale_ends_at ? draft.sale_ends_at.slice(0, 16) : ""}
              onChange={e => setDraft(d => ({
                ...d,
                sale_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null,
              }))} />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">Customers see the sale price with the regular price crossed out. Leave end date blank for no expiry.</p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={busy || !draft.name?.trim()}
          className="bg-[#0D2240] hover:bg-[#142d52] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors">
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={cancelDraft} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    </div>
  )

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
        {options.map(opt => {
          const saleOn = isSaleActive(opt)
          return (
            <div key={opt.id}
              draggable={editingId !== opt.id}
              onDragStart={() => { dragId.current = opt.id }}
              onDragOver={e => { e.preventDefault(); setDragOver(opt.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(opt.id)}
              onDragEnd={() => { dragId.current = null; setDragOver(null) }}
              className={`py-3 transition-colors ${!opt.enabled ? "opacity-50" : ""} ${dragOver === opt.id ? "bg-blue-50 rounded-xl" : ""}`}>
              {editingId === opt.id ? draftForm : (
                <div className="flex items-center gap-3">
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 select-none" title="Drag to reorder">
                    <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
                      <circle cx="4" cy="4" r="1.5"/><circle cx="10" cy="4" r="1.5"/>
                      <circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/>
                      <circle cx="4" cy="16" r="1.5"/><circle cx="10" cy="16" r="1.5"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#0D2240]">{opt.name}</span>
                      {saleOn ? (
                        <>
                          <span className="text-xs bg-[#E8726A] text-white font-bold px-2 py-0.5 rounded-full">
                            {cents(opt.sale_price_cents!)} SALE
                          </span>
                          <span className="text-xs text-gray-400 line-through">{cents(opt.price_cents)}</span>
                        </>
                      ) : opt.price_cents > 0 ? (
                        <span className="text-xs bg-[#0D2240] text-white font-bold px-2 py-0.5 rounded-full">{cents(opt.price_cents)}</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Free</span>
                      )}
                      {opt.price_cents > 0 && (opt.pricing_unit ?? "per_order") !== "per_order" && (
                        <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                          {UNIT_LABEL[opt.pricing_unit ?? "per_order"]}
                        </span>
                      )}
                      {opt.requires_comforter && <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">🛏️ Comforter only</span>}
                      {opt.is_hypoallergenic && <span className="text-xs bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded-full">🌿 Hypo-Safe</span>}
                      {!opt.enabled && <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">Hidden</span>}
                    </div>
                    {opt.description && <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>}
                    {saleOn && opt.sale_ends_at && (
                      <p className="text-[10px] text-[#E8726A] mt-0.5">
                        Sale ends {new Date(opt.sale_ends_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setEditingId(opt.id); setDraft({ ...opt }); setAdding(false) }}
                      className="text-xs text-gray-400 hover:text-[#0D2240] font-semibold transition-colors">Edit</button>
                    <button onClick={() => toggle(opt.id, !opt.enabled)}
                      className="text-xs text-gray-400 hover:text-[#0D2240] font-semibold transition-colors">
                      {opt.enabled ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => toggleHypo(opt.id, opt.is_hypoallergenic)}
                      className={`text-xs font-semibold transition-colors ${opt.is_hypoallergenic ? "text-teal-600 hover:text-gray-400" : "text-gray-400 hover:text-teal-600"}`}
                      title={opt.is_hypoallergenic ? "Mark as NOT hypo-safe" : "Mark as hypo-safe"}>
                      🌿
                    </button>
                    <button onClick={() => remove(opt.id)}
                      className="text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors">Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {adding && draftForm}
    </div>
  )
}

export default function PricingPage() {
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [detergents, setDetergents] = useState<ServiceOption[]>([])
  const [extras, setExtras] = useState<ServiceOption[]>([])
  const [accessories, setAccessories] = useState<ServiceOption[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeeSettings>({ comforterCents: 0, washFoldCents: 0, washOnlyCents: 0 })
  const [savingFee, setSavingFee] = useState(false)
  const [savedFee, setSavedFee] = useState(false)
  const [svcs, setSvcs] = useState<ServicesConfig>({ comforter_wash: true, wash_fold: true, wash_only: true })
  const [savingSvcs, setSavingSvcs] = useState(false)
  const [savedSvcs, setSavedSvcs] = useState(false)
  const [monthlyPlanEnabled, setMonthlyPlanEnabledState] = useState(true)
  const [tipsEnabled, setTipsEnabledState] = useState(true)
  const [savingTipsToggle, setSavingTipsToggle] = useState(false)
  const [savingPlanToggle, setSavingPlanToggle] = useState(false)
  const [freePickupDeliveryLineEnabled, setFreePickupDeliveryLineEnabledState] = useState(true)
  const [savingFreeLineToggle, setSavingFreeLineToggle] = useState(false)

  async function loadAll() {
    const [cfg, dets, exts, accs, fee, svcsCfg, planEnabled] = await Promise.all([
      getPricingConfig(),
      getAllServiceOptions("detergent"),
      getAllServiceOptions("extra"),
      getAllServiceOptions("accessory"),
      getDeliveryFeeSettings(),
      getServicesConfig(),
      getMonthlyPlanEnabled(),
    ])
    setConfig(cfg)
    setDetergents(dets)
    setExtras(exts)
    setAccessories(accs)
    setDeliveryFee(fee)
    setSvcs(svcsCfg)
    setMonthlyPlanEnabledState(planEnabled)
    getTipsEnabled().then(setTipsEnabledState)
    getFreePickupDeliveryLineEnabled().then(setFreePickupDeliveryLineEnabledState)
  }

  async function handleSaveSvcs() {
    setSavingSvcs(true)
    await setServicesConfig(svcs)
    setSavingSvcs(false)
    setSavedSvcs(true)
    setTimeout(() => setSavedSvcs(false), 3000)
  }

  async function handleSaveFee() {
    setSavingFee(true)
    await setDeliveryFeeSettings(deliveryFee)
    setSavingFee(false)
    setSavedFee(true)
    setTimeout(() => setSavedFee(false), 3000)
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading pricing…</div>
      </div>
    )
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20 bg-white"
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"

  return (
    <>
      <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Pricing</h1>
          <p className="text-sm text-gray-400 mt-1">Changes take effect immediately for all new bookings.</p>
        </div>

        {/* ── Active Services ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#0D2240] uppercase tracking-wide">Active Services</h2>
              <p className="text-xs text-gray-400 mt-0.5">Toggle which services appear on the homepage and accept bookings.</p>
            </div>
            <button
              onClick={handleSaveSvcs}
              disabled={savingSvcs}
              className="shrink-0 bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
            >
              {savingSvcs ? "Saving…" : savedSvcs ? "Saved ✓" : "Save"}
            </button>
          </div>
          <div className="space-y-3">
            {([
              { key: "comforter_wash" as keyof ServicesConfig, icon: "🛏️", label: "Comforter Wash", desc: "Per-piece comforter cleaning" },
              { key: "wash_fold"      as keyof ServicesConfig, icon: "👕", label: "Wash & Fold",    desc: "Priced by weight ($/lb)" },
              { key: "wash_only"      as keyof ServicesConfig, icon: "🧺", label: "Wash Only",      desc: "Wash without folding" },
            ] as const).map(({ key, icon, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-[#f7f8fb] border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="font-bold text-sm text-[#0D2240]">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSvcs(s => ({ ...s, [key]: !s[key] }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${svcs[key] ? "bg-[#0D2240]" : "bg-gray-200"}`}
                  role="switch"
                  aria-checked={svcs[key]}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${svcs[key] ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}

            {/* Monthly Plan toggle — separate save, instant feedback */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#f0f4f9] border border-blue-100">
              <div className="flex items-center gap-3">
                <span className="text-xl">📋</span>
                <div>
                  <p className="font-bold text-sm text-[#0D2240]">Monthly Plans</p>
                  <p className="text-xs text-gray-400">Allow customers to subscribe to a fixed monthly plan</p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingPlanToggle}
                onClick={async () => {
                  setSavingPlanToggle(true)
                  const next = !monthlyPlanEnabled
                  setMonthlyPlanEnabledState(next)
                  await setMonthlyPlanEnabled(next)
                  setSavingPlanToggle(false)
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${monthlyPlanEnabled ? "bg-[#0D2240]" : "bg-gray-200"}`}
                role="switch"
                aria-checked={monthlyPlanEnabled}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${monthlyPlanEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Tips toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#f0f4f9] border border-blue-100">
              <div className="flex items-center gap-3">
                <span className="text-xl">💰</span>
                <div>
                  <p className="font-bold text-sm text-[#0D2240]">Tips</p>
                  <p className="text-xs text-gray-400">Show tip selector to customers during checkout</p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingTipsToggle}
                onClick={async () => {
                  setSavingTipsToggle(true)
                  const next = !tipsEnabled
                  setTipsEnabledState(next)
                  await setTipsEnabled(next)
                  setSavingTipsToggle(false)
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${tipsEnabled ? "bg-[#0D2240]" : "bg-gray-200"}`}
                role="switch"
                aria-checked={tipsEnabled}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${tipsEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Free Pickup & Delivery line toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#f0f4f9] border border-blue-100">
              <div className="flex items-center gap-3">
                <span className="text-xl">🚚</span>
                <div>
                  <p className="font-bold text-sm text-[#0D2240]">"Free Pick-Up & Delivery Included" Line</p>
                  <p className="text-xs text-gray-400">Show this line on the booking estimate. Turn off if you charge for pickup/delivery.</p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingFreeLineToggle}
                onClick={async () => {
                  setSavingFreeLineToggle(true)
                  const next = !freePickupDeliveryLineEnabled
                  setFreePickupDeliveryLineEnabledState(next)
                  await setFreePickupDeliveryLineEnabled(next)
                  setSavingFreeLineToggle(false)
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${freePickupDeliveryLineEnabled ? "bg-[#0D2240]" : "bg-gray-200"}`}
                role="switch"
                aria-checked={freePickupDeliveryLineEnabled}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${freePickupDeliveryLineEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>
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

        {/* ── Delivery Fee (per service) ───────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🚗</span>
            <h2 className="font-extrabold text-[#0D2240] text-base">Delivery Fee</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Set a flat delivery fee per service type. Set to <strong>$0.00</strong> to charge no fee for that service.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {([
              { label: "Comforter Wash",  key: "comforterCents" as const, icon: "🛏️" },
              { label: "Wash & Fold",     key: "washFoldCents"  as const, icon: "👕" },
              { label: "Wash Only",       key: "washOnlyCents"  as const, icon: "🫧" },
            ] as const).map(({ label, key, icon }) => (
              <div key={key} className="border border-gray-100 rounded-xl p-4 bg-[#f7f8fb]">
                <p className="text-xs font-bold text-[#0D2240] mb-2">{icon} {label}</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                  <input
                    type="number" step="0.01" min="0"
                    className={inputCls + " pl-7"}
                    value={dollarsToField(deliveryFee[key])}
                    onChange={e => setDeliveryFee(f => ({ ...f, [key]: fieldToCents(e.target.value) }))}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {deliveryFee[key] > 0 ? `$${dollarsToField(deliveryFee[key])} added at checkout` : "No delivery fee"}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveFee}
              disabled={savingFee}
              className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-60"
            >
              {savingFee ? "Saving…" : "Save Delivery Fees"}
            </button>
            {savedFee && <span className="text-green-600 text-sm font-semibold">✓ Saved — live immediately</span>}
          </div>
        </div>

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

        {/* ── Accessory Add-Ons ───────────────────────── */}
        <OptionsSection
          title="Accessory Add-Ons"
          icon="🛍️"
          type="accessory"
          options={accessories}
          onRefresh={loadAll}
        />
      </div>
    </>
  )
}
