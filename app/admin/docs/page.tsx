"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { getFaqItems, upsertFaqItems, type FaqItem, type FaqCategory } from "@/app/actions/faq"
import { getLegalPage, saveLegalPage, type LegalSection } from "@/app/actions/legal"

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type TopTab = "faq" | "terms" | "privacy"

const FAQ_CATEGORIES: { key: FaqCategory; label: string; color: string }[] = [
  { key: "general",        label: "General",        color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "comforter_wash", label: "Comforter Wash",  color: "bg-coral-50 text-[#E8726A] border-[#E8726A]/30" },
  { key: "wash_fold",      label: "Wash & Fold",     color: "bg-navy-50 text-[#0D2240] border-[#0D2240]/20" },
]

// ─────────────────────────────────────────────────────────────────────────────
// Legal preview builder
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
}
function linkify(s: string) {
  return esc(s).replace(/hello@comforterwash\.com/g,
    '<a href="mailto:hello@comforterwash.com" style="color:#E8726A;">hello@comforterwash.com</a>')
}
function renderLegalBlocks(content: string, isWarning: boolean): string {
  const c = isWarning ? "#b45309" : "#6b7280"
  return content.split("\n\n").map(block => {
    const lines = block.split("\n").filter(l => l.trim())
    if (lines.length > 0 && lines.every(l => l.startsWith("- "))) {
      return `<ul style="font-size:13px;color:${c};line-height:1.6;padding-left:20px;margin-bottom:10px;">` +
        lines.map(l => `<li style="margin-bottom:4px;">${linkify(l.slice(2))}</li>`).join("") + `</ul>`
    }
    return `<p style="font-size:13px;color:${c};line-height:1.6;margin-bottom:10px;">${linkify(block)}</p>`
  }).join("")
}
function buildLegalPreview(sections: LegalSection[], tab: "terms" | "privacy"): string {
  const title = tab === "terms" ? "Terms of Service" : "Privacy Policy"
  const other = tab === "terms"
    ? '<a href="/privacy" style="color:#9ca3af;text-decoration:none;">Privacy Policy</a>'
    : '<a href="/terms" style="color:#9ca3af;text-decoration:none;">Terms of Service</a>'
  const sectionsHtml = sections.map(s => {
    const warn = s.style === "warning"
    return `<div style="${warn ? "background:#fffbeb;border:1px solid #fef3c7;border-radius:12px;padding:16px;" : ""}margin-bottom:24px;">
      <h2 style="font-size:15px;font-weight:800;color:${warn ? "#92400e" : "#0D2240"};margin-bottom:8px;">${esc(s.title)}</h2>
      ${renderLegalBlocks(s.content, warn)}
    </div>`
  }).join("")
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:-apple-system,sans-serif;background:#fff;}</style>
  </head><body>
  <div style="background:#0D2240;padding:24px;text-align:center;">
    <h1 style="font-size:20px;font-weight:800;color:#fff;">${esc(title)}</h1>
    <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:6px;">Last updated: May 2026</p>
  </div>
  <div style="max-width:600px;margin:0 auto;padding:28px 20px;">
    ${sectionsHtml}
    <div style="border-top:1px solid #e5e7eb;padding-top:16px;display:flex;gap:16px;font-size:12px;color:#9ca3af;">
      <a href="/" style="color:#9ca3af;text-decoration:none;">← Back to Home</a>
      ${other}
    </div>
  </div></body></html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ View
// ─────────────────────────────────────────────────────────────────────────────

function FaqView({ allItems, onChange }: {
  allItems: FaqItem[]
  onChange: (items: FaqItem[]) => void
}) {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("general")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedCat, setSavedCat] = useState<FaqCategory | null>(null)

  const items = allItems.filter(i => i.category === activeCategory)
  const selected = items.find(i => i.id === selectedId) ?? null

  function updateItem(id: string, patch: Partial<FaqItem>) {
    onChange(allItems.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function addItem() {
    const newId = `new-${Date.now()}`
    const newItem: FaqItem = {
      id: newId,
      category: activeCategory,
      question: "New question",
      answer: "",
      sort_order: items.length,
      active: true,
    }
    onChange([...allItems, newItem])
    setSelectedId(newId)
  }

  function deleteItem(id: string) {
    onChange(allItems.filter(i => i.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function moveItem(id: string, dir: "up" | "down") {
    const catItems = [...items]
    const idx = catItems.findIndex(i => i.id === id)
    if (dir === "up" && idx === 0) return
    if (dir === "down" && idx === catItems.length - 1) return
    const swap = dir === "up" ? idx - 1 : idx + 1
    ;[catItems[idx], catItems[swap]] = [catItems[swap], catItems[idx]]
    const reindexed = catItems.map((item, i) => ({ ...item, sort_order: i }))
    onChange([...allItems.filter(i => i.category !== activeCategory), ...reindexed])
  }

  async function handleSave() {
    setSaving(true)
    await upsertFaqItems(activeCategory, items)
    setSaving(false)
    setSavedCat(activeCategory)
    setTimeout(() => setSavedCat(null), 2500)
  }

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-2 mb-5">
        {FAQ_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setSelectedId(null) }}
            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              activeCategory === cat.key
                ? "bg-[#0D2240] text-white border-[#0D2240]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {cat.label}
            <span className="ml-2 text-xs opacity-60">
              ({allItems.filter(i => i.category === cat.key).length})
            </span>
          </button>
        ))}
        <a
          href="/faq"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 bg-white text-[#0D2240] hover:border-[#0D2240] transition-colors"
        >
          View FAQ ↗
        </a>
      </div>

      <div className="flex gap-5">
        {/* Left — question list */}
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`group relative transition-colors ${idx > 0 ? "border-t border-gray-100" : ""} ${
                  selectedId === item.id ? "bg-[#0D2240]/5 border-l-4 border-l-[#E8726A]" : "hover:bg-gray-50"
                }`}
              >
                <button
                  onClick={() => setSelectedId(item.id)}
                  className="w-full text-left px-4 py-3 pr-16"
                >
                  <p className={`text-xs font-semibold leading-snug ${item.active ? "text-[#0D2240]" : "text-gray-400 line-through"}`}>
                    {item.question}
                  </p>
                </button>
                {/* Reorder arrows */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveItem(item.id, "up")} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 text-xs">▲</button>
                  <button onClick={() => moveItem(item.id, "down")} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 text-xs">▼</button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">No questions yet.</p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={addItem}
              className="flex-1 py-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#E8726A] hover:text-[#E8726A] transition-colors font-medium"
            >
              + Add Question
            </button>
          </div>
        </div>

        {/* Right — editor */}
        {selected ? (
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Toolbar */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.active}
                      onChange={e => updateItem(selected.id, { active: e.target.checked })}
                      className="w-4 h-4 accent-[#E8726A]"
                    />
                    <span className="text-sm text-gray-600 font-medium">Visible on FAQ page</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (confirm("Delete this question?")) deleteItem(selected.id)
                    }}
                    className="px-4 py-2 rounded-full text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-colors disabled:opacity-60 ${
                      savedCat === activeCategory
                        ? "bg-green-500 text-white"
                        : "bg-[#E8726A] hover:bg-[#d45f57] text-white"
                    }`}
                  >
                    {saving ? "Saving…" : savedCat === activeCategory ? "✓ Saved" : "Save Category"}
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Question
                  </label>
                  <input
                    value={selected.question}
                    onChange={e => updateItem(selected.id, { question: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"
                    placeholder="What is your question?"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Answer
                  </label>
                  <textarea
                    value={selected.answer}
                    onChange={e => updateItem(selected.id, { answer: e.target.value })}
                    rows={10}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y leading-relaxed"
                    placeholder="Write the answer here…"
                  />
                </div>
              </div>

              <div className="px-6 pb-5">
                <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
                  <p className="font-bold text-gray-600 uppercase tracking-wide text-[10px] mb-1.5">Tips</p>
                  <p>Use plain text. The answer will be shown in an accordion on the FAQ page.</p>
                  <p>Start lines with <code className="bg-white border border-gray-200 px-1 rounded font-mono">- </code> to create bullet points.</p>
                  <p>Use the ▲▼ arrows in the list to reorder questions.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm h-64 bg-white rounded-xl border border-gray-200 border-dashed">
            <p className="font-medium">Select a question to edit</p>
            <p className="text-xs mt-1 text-gray-300">or click "+ Add Question" to create one</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Legal View (Terms or Privacy)
// ─────────────────────────────────────────────────────────────────────────────

function LegalView({ tab, sections, onChange }: {
  tab: "terms" | "privacy"
  sections: LegalSection[]
  onChange: (sections: LegalSection[]) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const selected = sections.find(s => s.id === selectedId) ?? null

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = buildLegalPreview(sections, tab)
    }
  }, [sections, tab])

  useEffect(() => {
    setSelectedId(sections[0]?.id ?? null)
  }, [tab, sections])

  function updateSection(id: string, patch: Partial<LegalSection>) {
    onChange(sections.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function handleSave() {
    setSaving(true)
    await saveLegalPage(tab, sections)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex gap-5">
      {/* Left — section list */}
      <div className="w-52 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-4 py-3 transition-colors ${i > 0 ? "border-t border-gray-100" : ""} ${
                selectedId === s.id ? "bg-[#0D2240]/5 border-l-4 border-l-[#E8726A]" : "hover:bg-gray-50"
              }`}
            >
              <p className="text-xs font-bold text-[#0D2240] leading-snug">{s.title}</p>
              {s.style === "warning" && (
                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  callout
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Center — editor */}
      {selected && (
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-base font-bold text-[#0D2240]">{selected.title}</p>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-colors disabled:opacity-60 ${
                  saved ? "bg-green-500 text-white" : "bg-[#E8726A] hover:bg-[#d45f57] text-white"
                }`}
              >
                {saving ? "Saving…" : saved ? "✓ Saved" : "Save Page"}
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Section Title</label>
                <input
                  value={selected.title}
                  onChange={e => updateSection(selected.id, { title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Content</label>
                <textarea
                  value={selected.content}
                  onChange={e => updateSection(selected.id, { content: e.target.value })}
                  rows={12}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y font-mono leading-relaxed"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.style === "warning"}
                  onChange={e => updateSection(selected.id, { style: e.target.checked ? "warning" : "default" })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm text-gray-600 font-medium">Show as amber callout box</span>
              </label>
            </div>

            <div className="px-6 pb-6">
              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
                <p className="font-bold text-gray-600 uppercase tracking-wide text-[10px] mb-1.5">Formatting</p>
                <p>Blank line between paragraphs. Lines starting with <code className="bg-white border border-gray-200 px-1 rounded font-mono">- </code> become bullet points.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right — preview */}
      <div className="w-[340px] shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E8726A]" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Live Preview</p>
            <a
              href={`/${tab === "terms" ? "terms" : "privacy"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-[#E8726A] hover:underline"
            >
              View live ↗
            </a>
          </div>
          <iframe
            ref={iframeRef}
            className="w-full border-0"
            style={{ height: "660px" }}
            title="Legal page preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [topTab, setTopTab] = useState<TopTab>("faq")
  const [faqItems, setFaqItems] = useState<FaqItem[]>([])
  const [legalData, setLegalData] = useState<Record<"terms" | "privacy", LegalSection[]>>({
    terms: [], privacy: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getFaqItems(),
      getLegalPage("terms"),
      getLegalPage("privacy"),
    ]).then(([faq, terms, privacy]) => {
      setFaqItems(faq)
      setLegalData({ terms, privacy })
      setLoading(false)
    })
  }, [])

  const TOP_TABS: { key: TopTab; label: string }[] = [
    { key: "faq",     label: "FAQ" },
    { key: "terms",   label: "Terms of Service" },
    { key: "privacy", label: "Privacy Policy" },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Docs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your FAQ, Terms of Service, and Privacy Policy. Changes go live immediately after saving.
          </p>
        </div>

        {/* Top tab switcher */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
          {TOP_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTopTab(t.key)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                topTab === t.key
                  ? "bg-[#0D2240] text-white"
                  : "text-gray-500 hover:text-[#0D2240] hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {topTab === "faq" && (
          <FaqView allItems={faqItems} onChange={setFaqItems} />
        )}
        {topTab === "terms" && (
          <LegalView
            tab="terms"
            sections={legalData.terms}
            onChange={sections => setLegalData(prev => ({ ...prev, terms: sections }))}
          />
        )}
        {topTab === "privacy" && (
          <LegalView
            tab="privacy"
            sections={legalData.privacy}
            onChange={sections => setLegalData(prev => ({ ...prev, privacy: sections }))}
          />
        )}
      </div>
    </div>
  )
}
