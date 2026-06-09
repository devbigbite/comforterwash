"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  getLegalPage,
  saveLegalPage,
  type LegalSection,
} from "@/app/actions/legal"

type Tab = "terms" | "privacy"

const TAB_LABELS: Record<Tab, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
}

// ── Live preview HTML builder ─────────────────────────────────────────────────

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function linkify(s: string) {
  return esc(s).replace(
    /hello@comforterwash\.com/g,
    '<a href="mailto:clean@washfoldorlando.com" style="color:#E8726A;">clean@washfoldorlando.com</a>'
  )
}

function renderBlocks(content: string, isWarning: boolean): string {
  const textColor = isWarning ? "#b45309" : "#6b7280"
  const blocks = content.split("\n\n")
  return blocks
    .map((block) => {
      const lines = block.split("\n").filter((l) => l.trim())
      if (lines.length > 0 && lines.every((l) => l.startsWith("- "))) {
        const items = lines
          .map((l) => `<li style="margin-bottom:4px;">${linkify(l.slice(2))}</li>`)
          .join("")
        return `<ul style="font-size:13px;color:${textColor};line-height:1.6;padding-left:20px;margin-bottom:10px;">${items}</ul>`
      }
      return `<p style="font-size:13px;color:${textColor};line-height:1.6;margin-bottom:10px;">${linkify(block)}</p>`
    })
    .join("")
}

function buildPreviewHtml(sections: LegalSection[], tab: Tab): string {
  const title = TAB_LABELS[tab]
  const sectionHtml = sections
    .map((s) => {
      const isWarning = s.style === "warning"
      const wrapStyle = isWarning
        ? "background:#fffbeb;border:1px solid #fef3c7;border-radius:12px;padding:16px;margin-bottom:24px;"
        : "margin-bottom:24px;"
      const titleColor = isWarning ? "#92400e" : "#0D2240"
      return `
        <div style="${wrapStyle}">
          <h2 style="font-size:15px;font-weight:800;color:${titleColor};margin-bottom:8px;">${esc(s.title)}</h2>
          ${renderBlocks(s.content, isWarning)}
        </div>`
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:-apple-system,sans-serif;background:#fff;}</style>
</head>
<body>
<div style="background:#0D2240;padding:24px;text-align:center;margin-bottom:0;">
  <h1 style="font-size:20px;font-weight:800;color:#fff;">${esc(title)}</h1>
  <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:6px;">Last updated: May 2026</p>
</div>
<div style="max-width:600px;margin:0 auto;padding:28px 20px;">
  ${sectionHtml}
  <div style="border-top:1px solid #e5e7eb;padding-top:16px;display:flex;gap:16px;font-size:12px;color:#9ca3af;">
    <a href="/" style="color:#9ca3af;text-decoration:none;">← Back to Home</a>
    ${tab === "terms"
      ? '<a href="/privacy" style="color:#9ca3af;text-decoration:none;">Privacy Policy</a>'
      : '<a href="/terms" style="color:#9ca3af;text-decoration:none;">Terms of Service</a>'}
  </div>
</div>
</body>
</html>`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LegalPagesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("terms")
  const [data, setData] = useState<Record<Tab, LegalSection[]>>({ terms: [], privacy: [] })
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedTab, setSavedTab] = useState<Tab | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Load both pages on mount
  useEffect(() => {
    Promise.all([getLegalPage("terms"), getLegalPage("privacy")]).then(
      ([terms, privacy]) => {
        setData({ terms, privacy })
        setSelectedId(terms[0]?.id ?? null)
        setLoading(false)
      }
    )
  }, [])

  // Update iframe whenever sections or tab changes
  const sections = data[activeTab]
  const updatePreview = useCallback(() => {
    if (!iframeRef.current) return
    iframeRef.current.srcdoc = buildPreviewHtml(data[activeTab], activeTab)
  }, [data, activeTab])

  useEffect(() => {
    updatePreview()
  }, [updatePreview])

  const selectedSection = sections.find((s) => s.id === selectedId) ?? null

  function updateSection(id: string, patch: Partial<LegalSection>) {
    setData((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab].map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }

  async function handleSave() {
    setSaving(true)
    await saveLegalPage(activeTab, data[activeTab])
    setSaving(false)
    setSavedTab(activeTab)
    setTimeout(() => setSavedTab(null), 2500)
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    setSelectedId(data[tab][0]?.id ?? null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-[#E8726A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Legal Pages</h1>
            <p className="text-gray-500 text-sm mt-1">
              Edit Terms of Service and Privacy Policy. Changes go live instantly after saving.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 bg-white text-[#0D2240] hover:border-[#0D2240] transition-colors"
            >
              View Terms ↗
            </a>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 bg-white text-[#0D2240] hover:border-[#0D2240] transition-colors"
            >
              View Privacy ↗
            </a>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-5">
          {(["terms", "privacy"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                activeTab === tab
                  ? "bg-[#0D2240] text-white"
                  : "bg-white text-[#0D2240] border border-gray-200 hover:border-[#0D2240]"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="flex gap-5">
          {/* Left — section list */}
          <div className="w-52 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    i > 0 ? "border-t border-gray-100" : ""
                  } ${
                    selectedId === s.id
                      ? "bg-[#0D2240]/5 border-l-4 border-l-[#E8726A]"
                      : "hover:bg-gray-50"
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
          <div className="flex-1 min-w-0">
            {selectedSection ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Editor toolbar */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-[#0D2240]">{selectedSection.title}</p>
                    {selectedSection.style === "warning" && (
                      <span className="inline-block mt-1 text-xs font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        amber callout box
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-colors disabled:opacity-60 ${
                      savedTab === activeTab
                        ? "bg-green-500 text-white"
                        : "bg-[#E8726A] hover:bg-[#d45f57] text-white"
                    }`}
                  >
                    {saving
                      ? "Saving…"
                      : savedTab === activeTab
                      ? "✓ Saved"
                      : "Save Page"}
                  </button>
                </div>

                {/* Fields */}
                <div className="px-6 py-5 space-y-5">
                  {/* Section title */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                      Section Title
                    </label>
                    <input
                      value={selectedSection.title}
                      onChange={(e) =>
                        updateSection(selectedSection.id, { title: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A]"
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                      Content
                    </label>
                    <textarea
                      value={selectedSection.content}
                      onChange={(e) =>
                        updateSection(selectedSection.id, { content: e.target.value })
                      }
                      rows={12}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 focus:border-[#E8726A] resize-y font-mono leading-relaxed"
                    />
                  </div>

                  {/* Style toggle */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSection.style === "warning"}
                        onChange={(e) =>
                          updateSection(selectedSection.id, {
                            style: e.target.checked ? "warning" : "default",
                          })
                        }
                        className="w-4 h-4 accent-amber-500"
                      />
                      <span className="text-sm text-gray-600 font-medium">
                        Show as amber callout box
                      </span>
                    </label>
                  </div>
                </div>

                {/* Formatting hint */}
                <div className="px-6 pb-6">
                  <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
                    <p className="font-bold text-gray-600 uppercase tracking-wide text-[10px] mb-2">Formatting guide</p>
                    <p>Separate paragraphs with a blank line.</p>
                    <p>Start lines with <code className="bg-white border border-gray-200 px-1 rounded font-mono">- </code> to create a bullet list (each item on its own line).</p>
                    <p>The preview on the right updates as you type.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm h-64">
                Select a section to edit
              </div>
            )}
          </div>

          {/* Right — live preview */}
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
                style={{ height: "680px" }}
                title="Legal page preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
