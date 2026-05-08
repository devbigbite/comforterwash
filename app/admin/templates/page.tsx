"use client"

import { useEffect, useState } from "react"
import { getEmailTemplates, upsertEmailTemplate, type EmailTemplate } from "@/app/actions/email-templates"

const AUDIENCE_LABELS: Record<string, string> = {
  customer: "Customers",
  admin: "Admin",
  staff: "Staff",
  facility: "Facilities",
}

const AUDIENCE_ORDER = ["customer", "admin", "staff", "facility"]

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState({ subject: "", headline: "", body: "", cta_text: "" })
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [activeAudience, setActiveAudience] = useState("customer")

  useEffect(() => {
    getEmailTemplates().then((data) => {
      setTemplates(data)
      setLoading(false)
      if (data.length > 0) selectTemplate(data[0])
    })
  }, [])

  function selectTemplate(t: EmailTemplate) {
    setSelected(t)
    setForm({
      subject: t.subject,
      headline: t.headline,
      body: t.body,
      cta_text: t.cta_text ?? "",
    })
    setSavedKey(null)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const res = await upsertEmailTemplate(selected.key, {
      subject: form.subject,
      headline: form.headline,
      body: form.body,
      cta_text: form.cta_text || null,
    })
    setSaving(false)
    if (res.success) {
      setSavedKey(selected.key)
      setTemplates((prev) =>
        prev.map((t) =>
          t.key === selected.key
            ? { ...t, subject: form.subject, headline: form.headline, body: form.body, cta_text: form.cta_text || null }
            : t
        )
      )
      setTimeout(() => setSavedKey(null), 2500)
    }
  }

  const grouped = AUDIENCE_ORDER.reduce<Record<string, EmailTemplate[]>>((acc, aud) => {
    acc[aud] = templates.filter((t) => t.audience === aud)
    return acc
  }, {})

  const visibleAudiences = AUDIENCE_ORDER.filter((a) => grouped[a].length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Communication Templates</h1>
          <p className="text-gray-500 text-sm mt-1">Edit the subject, headline, and body of each automated email.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Left panel — template list */}
            <div className="w-72 shrink-0">
              {/* Audience tabs */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {visibleAudiences.map((aud) => (
                  <button
                    key={aud}
                    onClick={() => {
                      setActiveAudience(aud)
                      if (grouped[aud].length > 0) selectTemplate(grouped[aud][0])
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors ${
                      activeAudience === aud
                        ? "bg-[#0D2240] text-white"
                        : "bg-white text-[#0D2240] border border-gray-200 hover:border-[#0D2240]"
                    }`}
                  >
                    {AUDIENCE_LABELS[aud]}
                  </button>
                ))}
              </div>

              {/* Template list */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {(grouped[activeAudience] ?? []).map((t, i) => (
                  <button
                    key={t.key}
                    onClick={() => selectTemplate(t)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      i > 0 ? "border-t border-gray-100" : ""
                    } ${
                      selected?.key === t.key
                        ? "bg-[#0D2240]/5 border-l-4 border-l-[#E8726A]"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#0D2240]">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{t.subject}</p>
                  </button>
                ))}
                {(grouped[activeAudience] ?? []).length === 0 && (
                  <p className="text-sm text-gray-400 px-4 py-6 text-center">No templates for this audience yet.</p>
                )}
              </div>
            </div>

            {/* Right panel — editor */}
            {selected ? (
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Editor header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#0D2240]">{selected.name}</h2>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full uppercase tracking-wide">
                        {AUDIENCE_LABELS[selected.audience]}
                      </span>
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                        savedKey === selected.key
                          ? "bg-green-500 text-white"
                          : "bg-[#E8726A] hover:bg-[#d45f57] text-white"
                      } disabled:opacity-60`}
                    >
                      {saving ? "Saving…" : savedKey === selected.key ? "✓ Saved" : "Save Changes"}
                    </button>
                  </div>

                  {/* Fields */}
                  <div className="px-6 py-5 space-y-5">
                    {/* Subject */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        Subject Line
                      </label>
                      <input
                        value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"
                        placeholder="Email subject…"
                      />
                    </div>

                    {/* Headline */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        Email Headline
                      </label>
                      <input
                        value={form.headline}
                        onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"
                        placeholder="Main heading shown in the email…"
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        Body Text
                      </label>
                      <textarea
                        value={form.body}
                        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                        rows={5}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y"
                        placeholder="Main body paragraph…"
                      />
                    </div>

                    {/* CTA (optional) */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        CTA Button Text <span className="font-normal normal-case text-gray-400">(optional)</span>
                      </label>
                      <input
                        value={form.cta_text}
                        onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"
                        placeholder="e.g. Book Your Next Pickup"
                      />
                    </div>
                  </div>

                  {/* Variables reference */}
                  {selected.variables.length > 0 && (
                    <div className="px-6 pb-6">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                        Available Variables
                      </p>
                      <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-2">
                        {selected.variables.map((v) => (
                          <div key={v.key} className="flex items-start gap-2">
                            <code
                              className="text-xs bg-[#0D2240]/10 text-[#0D2240] px-1.5 py-0.5 rounded font-mono cursor-pointer select-all shrink-0"
                              title="Click to copy"
                              onClick={() => navigator.clipboard.writeText(`{{${v.key}}}`)}
                            >
                              {`{{${v.key}}}`}
                            </code>
                            <span className="text-xs text-gray-500">{v.label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Click a variable to copy it. Paste it anywhere in the fields above.</p>
                    </div>
                  )}
                </div>

                {/* Preview box */}
                <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Preview</p>
                  <div className="bg-[#f7f8fb] rounded-lg p-4 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Subject</p>
                    <p className="text-sm font-semibold text-[#0D2240] mb-4">{form.subject || "—"}</p>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="bg-[#0D2240] rounded-t-lg py-3 text-center -mx-4 -mt-4 mb-4">
                        <span className="text-white font-extrabold text-sm">Wash<span className="text-[#E8726A]">Fold</span> Orlando</span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#0D2240] mb-2">{form.headline || "—"}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{form.body || "—"}</p>
                      {form.cta_text && (
                        <div className="mt-4">
                          <span className="inline-block bg-[#E8726A] text-white text-xs font-bold px-4 py-2 rounded-lg">
                            {form.cta_text}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Select a template to edit
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
