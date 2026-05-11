"use client"

import { useEffect, useState, useRef } from "react"
import { getEmailTemplates, upsertEmailTemplate, type EmailTemplate } from "@/app/actions/email-templates"

const AUDIENCE_LABELS: Record<string, string> = {
  customer: "Customers",
  admin: "Admin",
  staff: "Staff",
  facility: "Facilities",
}

const AUDIENCE_ORDER = ["customer", "admin", "staff", "facility"]

const BASE_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f7f8fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 24px 12px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(13,34,64,.08); }
    .header { background: #0D2240; padding: 24px 32px; text-align: center; }
    .logo-text { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .logo-coral { color: #E8726A; }
    .body { padding: 28px 32px; }
    .hero-badge { display: inline-block; background: #f7f8fb; border-radius: 999px; padding: 5px 14px; font-size: 12px; font-weight: 600; color: #0D2240; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 800; color: #0D2240; margin-bottom: 8px; line-height: 1.2; }
    .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 24px; line-height: 1.5; }
    .cta-button { display: block; background: #E8726A; color: #ffffff !important; text-decoration: none; text-align: center; padding: 13px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; margin: 20px 0; }
    .footer { padding: 18px 32px; text-align: center; background: #f7f8fb; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
    .footer a { color: #E8726A; text-decoration: none; }
  </style>
`

function buildPreviewHtml(
  form: { subject: string; headline: string; body: string; cta_text: string; footer_note: string },
  audience: string
): string {
  const footerBrand =
    audience === "customer"
      ? `<p>WashFold Orlando &middot; Pickup &amp; Delivery Laundry Service<br/><a href="https://washfoldorlando.com">washfoldorlando.com</a></p>`
      : `<p>This is an internal communication for WashFold Orlando staff.</p>`

  const footerNote = form.footer_note
    ? `<p style="margin-top:10px;font-size:11px;color:#b0b8c4;">${form.footer_note}</p>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${BASE_STYLES}
</head>
<body>
  <div class="wrapper">
    <div style="text-align:center;margin-bottom:10px;">
      <p style="font-size:11px;color:#6b7280;"><strong>Subject:</strong> ${form.subject || "<em>—</em>"}</p>
    </div>
    <div class="card">
      <div class="header">
        <div class="logo-text">Wash<span class="logo-coral">Fold</span> Orlando</div>
      </div>
      <div class="body">
        <div class="hero-badge">&#128247; Preview</div>
        <h1>${form.headline || "<em style='color:#ccc;font-weight:400;font-size:16px;'>No headline yet…</em>"}</h1>
        <p class="subtitle">${form.body || "<em style='color:#ccc;'>No body text yet…</em>"}</p>
        ${form.cta_text ? `<a href="#" class="cta-button">${form.cta_text}</a>` : ""}
      </div>
      <div class="footer">
        ${footerBrand}
        ${footerNote}
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;">
      <p style="font-size:11px;color:#9ca3af;">&copy; 2025 WashFold Orlando &middot; <a href="https://washfoldorlando.com" style="color:#E8726A;">washfoldorlando.com</a></p>
    </div>
  </div>
</body>
</html>`
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState({ subject: "", headline: "", body: "", cta_text: "", footer_note: "", alert_box: "", contact_note: "" })
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [activeAudience, setActiveAudience] = useState("customer")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    getEmailTemplates().then((data) => {
      setTemplates(data)
      setLoading(false)
      if (data.length > 0) selectTemplate(data[0])
    })
  }, [])

  // Update iframe whenever form or selected template changes
  useEffect(() => {
    if (!iframeRef.current || !selected) return
    iframeRef.current.srcdoc = buildPreviewHtml(form, selected.audience)
  }, [form, selected])

  function selectTemplate(t: EmailTemplate) {
    setSelected(t)
    setForm({
      subject: t.subject,
      headline: t.headline,
      body: t.body,
      cta_text: t.cta_text ?? "",
      footer_note: t.footer_note ?? "",
      alert_box: t.alert_box ?? "",
      contact_note: t.contact_note ?? "",
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
      footer_note: form.footer_note || null,
      alert_box: form.alert_box || null,
      contact_note: form.contact_note || null,
    })
    setSaving(false)
    if (res.success) {
      setSavedKey(selected.key)
      setTemplates((prev) =>
        prev.map((t) =>
          t.key === selected.key
            ? {
                ...t,
                subject: form.subject,
                headline: form.headline,
                body: form.body,
                cta_text: form.cta_text || null,
                footer_note: form.footer_note || null,
                alert_box: form.alert_box || null,
                contact_note: form.contact_note || null,
              }
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
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Communication Templates</h1>
          <p className="text-gray-500 text-sm mt-1">
            Edit every word of each automated email — subject, headline, body, CTA, and footer note.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-5">
            {/* Left panel — template list */}
            <div className="w-60 shrink-0">
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

            {/* Center — editor */}
            {selected ? (
              <>
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

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                          Body Text
                        </label>
                        <textarea
                          value={form.body}
                          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                          rows={4}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y"
                          placeholder="Main body paragraph…"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                          CTA Button Text{" "}
                          <span className="font-normal normal-case text-gray-400">(optional)</span>
                        </label>
                        <input
                          value={form.cta_text}
                          onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"
                          placeholder="e.g. Book Your Next Pickup"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                          Footer Note{" "}
                          <span className="font-normal normal-case text-gray-400">(optional — small text at the bottom of the email)</span>
                        </label>
                        <textarea
                          value={form.footer_note}
                          onChange={(e) => setForm((f) => ({ ...f, footer_note: e.target.value }))}
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y"
                          placeholder="e.g. ¿Deseas recibir estas comunicaciones en español?…"
                        />
                      </div>

                      {selected.key === "pickup_reminder" && (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                              Alert Box{" "}
                              <span className="font-normal normal-case text-gray-400">(amber callout — supports HTML)</span>
                            </label>
                            <textarea
                              value={form.alert_box}
                              onChange={(e) => setForm((f) => ({ ...f, alert_box: e.target.value }))}
                              rows={2}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y"
                              placeholder="e.g. 📦 <strong>Getting ready?</strong> Please have your laundry in bags near the front door."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                              Contact / Reschedule Note{" "}
                              <span className="font-normal normal-case text-gray-400">(text below the alert box — supports HTML)</span>
                            </label>
                            <textarea
                              value={form.contact_note}
                              onChange={(e) => setForm((f) => ({ ...f, contact_note: e.target.value }))}
                              rows={2}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y"
                              placeholder="e.g. Need to reschedule? Text or call us ASAP. 📞 (407) 555-0100"
                            />
                          </div>
                        </>
                      )}
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
                        <p className="text-xs text-gray-400 mt-2">
                          Click a variable to copy it. Paste it anywhere in the fields above.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right — live preview iframe */}
                <div className="w-[360px] shrink-0">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#E8726A]" />
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Live Preview</p>
                      <span className="ml-auto text-xs text-gray-400">Updates as you type</span>
                    </div>
                    <iframe
                      ref={iframeRef}
                      className="w-full border-0"
                      style={{ height: "660px" }}
                      title="Email preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              </>
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
