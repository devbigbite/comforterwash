"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  PitchTemplate, Prospect, ProspectStage,
  SEGMENT_LABELS, STAGE_LABELS, STAGE_COLORS,
  OutreachSegment,
} from "@/app/actions/outreach-types"
import {
  createProspect, updateProspect, deleteProspect,
  createPitchTemplate, deletePitchTemplate, updatePitchTemplate,
} from "@/app/actions/outreach"

// ─── Icons ───────────────────────────────────────────────────────────────────
function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    copy: "⧉", external: "↗", send: "→", edit: "✎", trash: "✕",
    plus: "+", eye: "👁", pipeline: "⬡", deck: "▤", check: "✓",
  }
  return <span>{icons[name] ?? name}</span>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

const STAGE_ORDER: ProspectStage[] = [
  "cold", "contacted", "interested", "proposal_sent", "negotiating", "closed_won", "closed_lost",
]

const SEGMENTS: OutreachSegment[] = [
  "airbnb_property_manager", "hotel_bnb", "corporate_office",
  "government_institutional", "fitness_spa", "other",
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OutreachClient({
  templates: initialTemplates,
  prospects: initialProspects,
}: {
  templates: PitchTemplate[]
  prospects: Prospect[]
}) {
  const [tab, setTab] = useState<"decks" | "pipeline">("decks")
  const [templates, setTemplates] = useState(initialTemplates)
  const [prospects, setProspects] = useState(initialProspects)
  const [, startTransition] = useTransition()

  // New pitch deck form
  const [showNewDeck, setShowNewDeck] = useState(false)
  const [newDeckTitle, setNewDeckTitle] = useState("")
  const [newDeckSegment, setNewDeckSegment] = useState<OutreachSegment>("airbnb_property_manager")
  const [newDeckTagline, setNewDeckTagline] = useState("")
  const [savingDeck, setSavingDeck] = useState(false)

  // New prospect form
  const [showNewProspect, setShowNewProspect] = useState(false)
  const [prospect, setProspect] = useState({
    business_name: "", contact_name: "", phone: "", email: "",
    segment: "airbnb_property_manager" as OutreachSegment,
    stage: "cold" as ProspectStage,
    pitch_template_id: "",
    notes: "", next_follow_up: "", assigned_to: "",
    estimated_lbs_per_week: "", estimated_monthly_value: "",
  })
  const [savingProspect, setSavingProspect] = useState(false)

  // Inline stage edit
  const [editingStage, setEditingStage] = useState<string | null>(null)

  // ── Deck Actions ────────────────────────────────────────────────────────────
  async function handleCreateDeck() {
    if (!newDeckTitle.trim()) return
    setSavingDeck(true)
    const slug = slugify(newDeckTitle)
    const res = await createPitchTemplate({
      title: newDeckTitle.trim(),
      slug,
      segment: newDeckSegment,
      tagline: newDeckTagline.trim() || undefined,
    })
    setSavingDeck(false)
    if (res.error) { alert(res.error); return }
    setShowNewDeck(false)
    setNewDeckTitle(""); setNewDeckTagline("")
    startTransition(async () => {
      const { listPitchTemplates } = await import("@/app/actions/outreach")
      setTemplates(await listPitchTemplates())
    })
  }

  async function handleDeleteDeck(id: string) {
    if (!confirm("Delete this pitch template?")) return
    await deletePitchTemplate(id)
    setTemplates(t => t.filter(x => x.id !== id))
  }

  async function handleToggleDeckStatus(t: PitchTemplate) {
    const next = t.status === "active" ? "draft" : "active"
    await updatePitchTemplate(t.id, { status: next })
    setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, status: next } : x))
  }

  // ── Prospect Actions ────────────────────────────────────────────────────────
  async function handleCreateProspect() {
    if (!prospect.business_name.trim()) return
    setSavingProspect(true)
    const res = await createProspect({
      business_name: prospect.business_name.trim(),
      contact_name: prospect.contact_name || undefined,
      phone: prospect.phone || undefined,
      email: prospect.email || undefined,
      segment: prospect.segment,
      stage: prospect.stage,
      pitch_template_id: prospect.pitch_template_id || undefined,
      notes: prospect.notes || undefined,
      next_follow_up: prospect.next_follow_up || undefined,
      assigned_to: prospect.assigned_to || undefined,
      estimated_lbs_per_week: prospect.estimated_lbs_per_week ? Number(prospect.estimated_lbs_per_week) : undefined,
      estimated_monthly_value: prospect.estimated_monthly_value ? Number(prospect.estimated_monthly_value) : undefined,
    })
    setSavingProspect(false)
    if (res.error) { alert(res.error); return }
    setShowNewProspect(false)
    setProspect({
      business_name: "", contact_name: "", phone: "", email: "",
      segment: "airbnb_property_manager", stage: "cold", pitch_template_id: "",
      notes: "", next_follow_up: "", assigned_to: "",
      estimated_lbs_per_week: "", estimated_monthly_value: "",
    })
    startTransition(async () => {
      const { listProspects } = await import("@/app/actions/outreach")
      setProspects(await listProspects())
    })
  }

  async function handleStageChange(id: string, stage: ProspectStage) {
    setProspects(ps => ps.map(p => p.id === id ? { ...p, stage } : p))
    setEditingStage(null)
    await updateProspect(id, { stage })
  }

  async function handleDeleteProspect(id: string) {
    if (!confirm("Remove this prospect from the pipeline?")) return
    await deleteProspect(id)
    setProspects(ps => ps.filter(p => p.id !== id))
  }

  async function handleMarkProposalSent(id: string, templateId: string) {
    const { markProposalSent } = await import("@/app/actions/outreach")
    await markProposalSent(id)
    setProspects(ps => ps.map(p => p.id === id
      ? { ...p, stage: "proposal_sent", proposal_sent_at: new Date().toISOString() }
      : p
    ))
  }

  // ── Pipeline stats ──────────────────────────────────────────────────────────
  const active = prospects.filter(p => !["closed_won", "closed_lost"].includes(p.stage))
  const won = prospects.filter(p => p.stage === "closed_won")

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/super-admin" className="text-slate-400 hover:text-slate-600 text-sm">← Super Admin</Link>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Commercial Outreach</h2>
          <p className="text-sm text-slate-500 mt-1">Pitch templates & sales pipeline for commercial accounts</p>
        </div>
        <button
          onClick={() => tab === "decks" ? setShowNewDeck(true) : setShowNewProspect(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + {tab === "decks" ? "New Pitch Template" : "Add Prospect"}
        </button>
      </div>

      {/* Pipeline stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Prospects", value: prospects.length, color: "text-slate-700" },
          { label: "Active Pipeline", value: active.length, color: "text-indigo-700" },
          { label: "Proposals Sent", value: prospects.filter(p => p.proposal_sent_at).length, color: "text-purple-700" },
          { label: "Closed Won", value: won.length, color: "text-green-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          {(["decks", "pipeline"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "decks" ? "▤ Pitch Templates" : "⬡ Pipeline"}
            </button>
          ))}
        </div>
      </div>

      {/* ── PITCH TEMPLATES TAB ── */}
      {tab === "decks" && (
        <div className="space-y-4">
          {/* New deck form */}
          {showNewDeck && (
            <div className="bg-white border border-indigo-200 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-800">New Pitch Template</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Template Title *</label>
                  <input
                    value={newDeckTitle}
                    onChange={e => setNewDeckTitle(e.target.value)}
                    placeholder="e.g. Airbnb Property Managers"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Customer Segment</label>
                  <select
                    value={newDeckSegment}
                    onChange={e => setNewDeckSegment(e.target.value as OutreachSegment)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {SEGMENTS.map(s => (
                      <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tagline</label>
                  <input
                    value={newDeckTagline}
                    onChange={e => setNewDeckTagline(e.target.value)}
                    placeholder="One-line pitch..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateDeck}
                  disabled={savingDeck}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {savingDeck ? "Creating…" : "Create Template"}
                </button>
                <button onClick={() => setShowNewDeck(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Templates list */}
          {templates.length === 0 && !showNewDeck ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-400 text-sm">No pitch templates yet.</p>
              <button
                onClick={() => setShowNewDeck(true)}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Create your first template →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4">
                  {/* Segment color dot */}
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-lg flex-shrink-0">
                    {t.segment === "airbnb_property_manager" ? "🏠" :
                     t.segment === "hotel_bnb" ? "🏨" :
                     t.segment === "government_institutional" ? "🏛️" :
                     t.segment === "corporate_office" ? "🏢" :
                     t.segment === "fitness_spa" ? "💆" : "📋"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{t.title}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === "active" ? "bg-green-100 text-green-700" :
                        t.status === "draft" ? "bg-slate-100 text-slate-500" :
                        "bg-red-50 text-red-500"
                      }`}>
                        {t.status === "active" ? "● Active" : t.status === "draft" ? "○ Draft" : "Archived"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 font-mono">/{t.slug}</span>
                      <span className="text-xs text-slate-400">
                        👁 {t.view_count} views · {new Date(t.updated_at).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {SEGMENT_LABELS[t.segment]}
                      </span>
                    </div>
                    {t.tagline && (
                      <p className="text-xs text-slate-500 mt-1 italic">{t.tagline}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pitch/${t.slug}`)}
                      title="Copy link"
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm"
                    >
                      ⧉
                    </button>
                    <Link
                      href={`/pitch/${t.slug}`}
                      target="_blank"
                      title="Preview"
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm"
                    >
                      ↗
                    </Link>
                    <Link
                      href={`/super-admin/outreach/${t.slug}`}
                      title="Edit"
                      className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-sm"
                    >
                      ✎
                    </Link>
                    <button
                      onClick={() => handleToggleDeckStatus(t)}
                      title={t.status === "active" ? "Deactivate" : "Activate"}
                      className={`p-1.5 rounded transition-colors text-sm ${
                        t.status === "active"
                          ? "text-green-600 hover:text-slate-500 hover:bg-slate-100"
                          : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {t.status === "active" ? "✓" : "○"}
                    </button>
                    <button
                      onClick={() => handleDeleteDeck(t.id)}
                      title="Delete"
                      className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PIPELINE TAB ── */}
      {tab === "pipeline" && (
        <div className="space-y-4">
          {/* New prospect form */}
          {showNewProspect && (
            <div className="bg-white border border-indigo-200 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-800">Add Prospect to Pipeline</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Business Name *</label>
                  <input
                    value={prospect.business_name}
                    onChange={e => setProspect(p => ({ ...p, business_name: e.target.value }))}
                    placeholder="Company or property name"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
                  <input
                    value={prospect.contact_name}
                    onChange={e => setProspect(p => ({ ...p, contact_name: e.target.value }))}
                    placeholder="Owner / manager name"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input
                    value={prospect.phone}
                    onChange={e => setProspect(p => ({ ...p, phone: e.target.value }))}
                    placeholder="407-000-0000"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input
                    value={prospect.email}
                    onChange={e => setProspect(p => ({ ...p, email: e.target.value }))}
                    placeholder="contact@company.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Segment</label>
                  <select
                    value={prospect.segment}
                    onChange={e => setProspect(p => ({ ...p, segment: e.target.value as OutreachSegment }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {SEGMENTS.map(s => (
                      <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
                  <select
                    value={prospect.stage}
                    onChange={e => setProspect(p => ({ ...p, stage: e.target.value as ProspectStage }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {STAGE_ORDER.map(s => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Pitch Template</label>
                  <select
                    value={prospect.pitch_template_id}
                    onChange={e => setProspect(p => ({ ...p, pitch_template_id: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">— None —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Est. lbs/week</label>
                  <input
                    type="number"
                    value={prospect.estimated_lbs_per_week}
                    onChange={e => setProspect(p => ({ ...p, estimated_lbs_per_week: e.target.value }))}
                    placeholder="e.g. 120"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Est. monthly value ($)</label>
                  <input
                    type="number"
                    value={prospect.estimated_monthly_value}
                    onChange={e => setProspect(p => ({ ...p, estimated_monthly_value: e.target.value }))}
                    placeholder="e.g. 800"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={prospect.next_follow_up}
                    onChange={e => setProspect(p => ({ ...p, next_follow_up: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea
                    value={prospect.notes}
                    onChange={e => setProspect(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Internal notes about this prospect..."
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateProspect}
                  disabled={savingProspect}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {savingProspect ? "Adding…" : "Add to Pipeline"}
                </button>
                <button onClick={() => setShowNewProspect(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Pipeline list grouped by stage */}
          {prospects.length === 0 && !showNewProspect ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-400 text-sm">Pipeline empty.</p>
              <button
                onClick={() => setShowNewProspect(true)}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Add your first prospect →
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {STAGE_ORDER.filter(stage =>
                prospects.some(p => p.stage === stage)
              ).map(stage => (
                <div key={stage}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STAGE_COLORS[stage]}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {prospects.filter(p => p.stage === stage).length} prospect{prospects.filter(p => p.stage === stage).length !== 1 ? "s" : ""}
                    </span>
                    {stage === "closed_won" && (
                      <span className="text-xs text-green-600 font-medium">
                        · Est. ${prospects.filter(p => p.stage === stage).reduce((sum, p) => sum + (p.estimated_monthly_value ?? 0), 0).toLocaleString()}/mo
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {prospects.filter(p => p.stage === stage).map(p => {
                      const linkedTemplate = templates.find(t => t.id === p.pitch_template_id)
                      const overdueFollowUp = p.next_follow_up && new Date(p.next_follow_up) < new Date()
                      return (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 text-sm">{p.business_name}</span>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {SEGMENT_LABELS[p.segment]}
                                </span>
                                {p.estimated_monthly_value && (
                                  <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                                    ~${p.estimated_monthly_value.toLocaleString()}/mo
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {p.contact_name && <span className="text-xs text-slate-500">{p.contact_name}</span>}
                                {p.phone && <span className="text-xs text-slate-400">{p.phone}</span>}
                                {p.email && <span className="text-xs text-slate-400">{p.email}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {linkedTemplate && (
                                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    📋 {linkedTemplate.title}
                                  </span>
                                )}
                                {p.next_follow_up && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    overdueFollowUp ? "bg-red-50 text-red-600 font-medium" : "bg-yellow-50 text-yellow-700"
                                  }`}>
                                    {overdueFollowUp ? "⚠ " : "📅 "}Follow up: {new Date(p.next_follow_up).toLocaleDateString()}
                                  </span>
                                )}
                                {p.proposal_sent_at && (
                                  <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                    ✓ Proposal sent {new Date(p.proposal_sent_at).toLocaleDateString()}
                                  </span>
                                )}
                                {p.estimated_lbs_per_week && (
                                  <span className="text-xs text-slate-400">{p.estimated_lbs_per_week} lbs/wk est.</span>
                                )}
                              </div>
                              {p.notes && (
                                <p className="text-xs text-slate-500 mt-1.5 italic line-clamp-2">{p.notes}</p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Stage selector */}
                              {editingStage === p.id ? (
                                <select
                                  autoFocus
                                  defaultValue={p.stage}
                                  onChange={e => handleStageChange(p.id, e.target.value as ProspectStage)}
                                  onBlur={() => setEditingStage(null)}
                                  className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                  {STAGE_ORDER.map(s => (
                                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  onClick={() => setEditingStage(p.id)}
                                  className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-2 py-1 rounded transition-colors"
                                  title="Change stage"
                                >
                                  Stage ↕
                                </button>
                              )}

                              {/* Send proposal */}
                              {linkedTemplate && !p.proposal_sent_at && (
                                <Link
                                  href={`/pitch/${linkedTemplate.slug}?prospect=${p.id}`}
                                  target="_blank"
                                  onClick={() => handleMarkProposalSent(p.id, linkedTemplate.id)}
                                  className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 px-2 py-1 rounded transition-colors"
                                  title="Open & mark as sent"
                                >
                                  Send Pitch ↗
                                </Link>
                              )}

                              {/* Download proposal */}
                              {linkedTemplate && (
                                <Link
                                  href={`/pitch/${linkedTemplate.slug}/proposal.pdf?prospect=${p.id}`}
                                  target="_blank"
                                  className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-2 py-1 rounded transition-colors"
                                  title="Download PDF proposal"
                                >
                                  PDF ↓
                                </Link>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteProspect(p.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors text-sm"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
