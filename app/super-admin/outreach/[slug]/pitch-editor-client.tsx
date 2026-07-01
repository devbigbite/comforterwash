"use client"

import { useState } from "react"
import Link from "next/link"
import {
  PitchTemplate, ServiceItem, ValueProp, PricingRow,
  SEGMENT_LABELS,
} from "@/app/actions/outreach-types"
import { updatePitchTemplate } from "@/app/actions/outreach"

export default function PitchEditorClient({ template: initial }: { template: PitchTemplate }) {
  const [t, setT] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function updateField<K extends keyof PitchTemplate>(key: K, value: PitchTemplate[K]) {
    setT(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await updatePitchTemplate(t.id, {
      title: t.title,
      tagline: t.tagline,
      status: t.status,
      cover_headline: t.cover_headline,
      intro_paragraph: t.intro_paragraph,
      services_offered: t.services_offered,
      value_props: t.value_props,
      pricing_table: t.pricing_table,
      closing_statement: t.closing_statement,
    })
    setSaving(false)
    setSaved(true)
  }

  // ── Service Items ──
  function updateService(i: number, field: keyof ServiceItem, value: string) {
    const next = [...t.services_offered]
    next[i] = { ...next[i], [field]: value }
    updateField("services_offered", next)
  }
  function addService() {
    updateField("services_offered", [...t.services_offered, { name: "", description: "", price_note: "" }])
  }
  function removeService(i: number) {
    updateField("services_offered", t.services_offered.filter((_, idx) => idx !== i))
  }

  // ── Value Props ──
  function updateProp(i: number, field: keyof ValueProp, value: string) {
    const next = [...t.value_props]
    next[i] = { ...next[i], [field]: value }
    updateField("value_props", next)
  }
  function addProp() {
    updateField("value_props", [...t.value_props, { icon: "✓", title: "", body: "" }])
  }
  function removeProp(i: number) {
    updateField("value_props", t.value_props.filter((_, idx) => idx !== i))
  }

  // ── Pricing ──
  function updatePrice(i: number, field: keyof PricingRow, value: string) {
    const next = [...t.pricing_table]
    next[i] = { ...next[i], [field]: value }
    updateField("pricing_table", next)
  }
  function addPrice() {
    updateField("pricing_table", [...t.pricing_table, { item: "", unit: "", price: "", notes: "" }])
  }
  function removePrice(i: number) {
    updateField("pricing_table", t.pricing_table.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/super-admin/outreach" className="text-slate-400 hover:text-slate-600 text-sm">
              ← Outreach
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{t.title}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-400 font-mono">/pitch/{t.slug}</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {SEGMENT_LABELS[t.segment]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              t.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}>
              {t.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/pitch/${t.slug}`}
            target="_blank"
            className="text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Preview ↗
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Status & Meta */}
      <Section title="Settings">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title">
            <input value={t.title ?? ""} onChange={e => updateField("title", e.target.value)}
              className={input} />
          </Field>
          <Field label="Status">
            <select value={t.status} onChange={e => updateField("status", e.target.value as PitchTemplate["status"])}
              className={input}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Tagline" className="col-span-2">
            <input value={t.tagline ?? ""} onChange={e => updateField("tagline", e.target.value)}
              placeholder="One-line pitch for this segment…"
              className={input} />
          </Field>
        </div>
      </Section>

      {/* Cover */}
      <Section title="Cover / Headline">
        <div className="space-y-3">
          <Field label="Cover Headline">
            <input value={t.cover_headline ?? ""} onChange={e => updateField("cover_headline", e.target.value)}
              placeholder="e.g. Professional Linen Service for Short-Term Rental Managers"
              className={input} />
          </Field>
          <Field label="Intro Paragraph">
            <textarea
              value={t.intro_paragraph ?? ""}
              onChange={e => updateField("intro_paragraph", e.target.value)}
              rows={4}
              placeholder="Opening paragraph shown at the top of the pitch deck…"
              className={`${input} resize-y`}
            />
          </Field>
        </div>
      </Section>

      {/* Services */}
      <Section title="Services Offered">
        <div className="space-y-3">
          {t.services_offered.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-3 items-start bg-slate-50 rounded-lg p-3">
              <Field label="Service Name">
                <input value={s.name} onChange={e => updateService(i, "name", e.target.value)}
                  placeholder="Wash & Fold" className={input} />
              </Field>
              <Field label="Description">
                <input value={s.description} onChange={e => updateService(i, "description", e.target.value)}
                  placeholder="What's included…" className={input} />
              </Field>
              <Field label="Price Note">
                <input value={s.price_note} onChange={e => updateService(i, "price_note", e.target.value)}
                  placeholder="Per lb / Included" className={input} />
              </Field>
              <button onClick={() => removeService(i)}
                className="mt-5 p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors">✕</button>
            </div>
          ))}
          <button onClick={addService}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            + Add Service
          </button>
        </div>
      </Section>

      {/* Value Props */}
      <Section title="Why Choose Us (Value Props)">
        <div className="space-y-3">
          {t.value_props.map((v, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_2fr_auto] gap-3 items-start bg-slate-50 rounded-lg p-3">
              <Field label="Icon">
                <input value={v.icon} onChange={e => updateProp(i, "icon", e.target.value)}
                  placeholder="🕐" className={`${input} w-16`} />
              </Field>
              <Field label="Title">
                <input value={v.title} onChange={e => updateProp(i, "title", e.target.value)}
                  placeholder="Fast Turnaround" className={input} />
              </Field>
              <Field label="Body">
                <input value={v.body} onChange={e => updateProp(i, "body", e.target.value)}
                  placeholder="24-48 hour cycle…" className={input} />
              </Field>
              <button onClick={() => removeProp(i)}
                className="mt-5 p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors">✕</button>
            </div>
          ))}
          <button onClick={addProp}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            + Add Value Prop
          </button>
        </div>
      </Section>

      {/* Pricing */}
      <Section title="Pricing Table">
        <div className="space-y-3">
          {t.pricing_table.map((r, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-3 items-start bg-slate-50 rounded-lg p-3">
              <Field label="Item">
                <input value={r.item} onChange={e => updatePrice(i, "item", e.target.value)}
                  placeholder="Wash & Fold" className={input} />
              </Field>
              <Field label="Unit">
                <input value={r.unit} onChange={e => updatePrice(i, "unit", e.target.value)}
                  placeholder="per lb" className={input} />
              </Field>
              <Field label="Price">
                <input value={r.price} onChange={e => updatePrice(i, "price", e.target.value)}
                  placeholder="$0.85" className={input} />
              </Field>
              <Field label="Notes">
                <input value={r.notes} onChange={e => updatePrice(i, "notes", e.target.value)}
                  placeholder="Volume discount available" className={input} />
              </Field>
              <button onClick={() => removePrice(i)}
                className="mt-5 p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors">✕</button>
            </div>
          ))}
          <button onClick={addPrice}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            + Add Line Item
          </button>
        </div>
      </Section>

      {/* Closing */}
      <Section title="Closing Statement">
        <Field label="Closing / Call to Action">
          <textarea
            value={t.closing_statement ?? ""}
            onChange={e => updateField("closing_statement", e.target.value)}
            rows={3}
            placeholder="Let's schedule a no-obligation walkthrough…"
            className={`${input} resize-y`}
          />
        </Field>
      </Section>

      {/* Floating save */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save All Changes"}
        </button>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
const input = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-500 mb-1">{lab