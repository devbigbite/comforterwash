"use client"

import { useState, useEffect, useCallback } from "react"
import { getFaqItems, upsertFaqItems, type FaqItem, type FaqCategory } from "@/app/actions/faq"

const CATEGORIES: { key: FaqCategory; label: string; icon: string }[] = [
  { key: "general", label: "General", icon: "💬" },
  { key: "comforter_wash", label: "Comforter Washing", icon: "🛏️" },
  { key: "wash_fold", label: "Wash & Fold", icon: "👕" },
]

type Lang = "en" | "es"

function ItemRow({
  item,
  lang,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  item: FaqItem
  lang: Lang
  onChange: (updated: FaqItem) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const qKey = lang === "es" ? "question_es" : "question"
  const aKey = lang === "es" ? "answer_es" : "answer"

  return (
    <div className={`border rounded-xl mb-2 transition-all ${item.active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
      <div className="flex items-center gap-2 px-4 py-3">
        {/* reorder arrows */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
          >▲</button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
          >▼</button>
        </div>

        {/* active toggle */}
        <button
          onClick={() => onChange({ ...item, active: !item.active })}
          className={`shrink-0 w-4 h-4 rounded border-2 transition-colors ${item.active ? "bg-[#E8726A] border-[#E8726A]" : "border-gray-300"}`}
          title={item.active ? "Active — click to hide" : "Hidden — click to show"}
        >
          {item.active && <span className="block text-white text-[10px] leading-none text-center">✓</span>}
        </button>

        {/* question preview / edit trigger */}
        <button
          className="flex-1 text-left text-sm font-medium text-[#0D2240] truncate hover:text-[#E8726A] transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          {(lang === "es" ? item.question_es : item.question) || <span className="text-gray-400 italic">No translation yet</span>}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            {expanded ? "Close" : "Edit"}
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Question {lang === "es" ? "(Spanish)" : "(English)"}
            </label>
            <input
              type="text"
              value={(lang === "es" ? item.question_es : item.question) ?? ""}
              onChange={e => onChange({ ...item, [qKey]: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]"
              placeholder={lang === "es" ? "Pregunta en español..." : "Question in English..."}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Answer {lang === "es" ? "(Spanish)" : "(English)"}
            </label>
            <textarea
              value={(lang === "es" ? item.answer_es : item.answer) ?? ""}
              onChange={e => onChange({ ...item, [aKey]: e.target.value })}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] resize-y"
              placeholder={lang === "es" ? "Respuesta en español..." : "Answer in English..."}
            />
          </div>
          {lang === "es" && (
            <div className="text-xs text-gray-400 border-t pt-2">
              <span className="font-semibold">English fallback:</span> {item.question}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminFaqPage() {
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<FaqCategory | null>(null)
  const [saved, setSaved] = useState<FaqCategory | null>(null)
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("general")
  const [lang, setLang] = useState<Lang>("en")

  const load = useCallback(async () => {
    setLoading(true)
    // Load raw items (no lang transform) by calling without lang
    const data = await getFaqItems()
    setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const catItems = items.filter(i => i.category === activeCategory)

  function updateItem(id: string, updated: FaqItem) {
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function moveItem(id: string, dir: -1 | 1) {
    setItems(prev => {
      const catIdx = prev.filter(i => i.category === activeCategory).map(i => i.id)
      const pos = catIdx.indexOf(id)
      const newPos = pos + dir
      if (newPos < 0 || newPos >= catIdx.indexOf.length + catIdx.length) return prev
      const swapId = catIdx[newPos]
      return prev.map(i => {
        if (i.id === id) return { ...i, sort_order: newPos }
        if (i.id === swapId) return { ...i, sort_order: pos }
        return i
      }).sort((a, b) => {
        if (a.category !== b.category) return 0
        return a.sort_order - b.sort_order
      })
    })
  }

  function addItem() {
    const catCount = items.filter(i => i.category === activeCategory).length
    const newItem: FaqItem = {
      id: `new-${Date.now()}`,
      category: activeCategory,
      question: "",
      answer: "",
      question_es: "",
      answer_es: "",
      sort_order: catCount,
      active: true,
    }
    setItems(prev => [...prev, newItem])
  }

  async function saveCategory(cat: FaqCategory) {
    setSaving(cat)
    const catItems = items.filter(i => i.category === cat)
    try {
      await upsertFaqItems(cat, catItems)
      setSaved(cat)
      setTimeout(() => setSaved(null), 2000)
    } catch (e) {
      alert("Save failed: " + (e as Error).message)
    } finally {
      setSaving(null)
    }
  }

  const activeCatLabel = CATEGORIES.find(c => c.key === activeCategory)?.label ?? ""

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">FAQ Editor</h1>
          <p className="text-sm text-gray-400 mt-0.5">Edit questions and answers in English and Spanish</p>
        </div>
        {/* Language toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${lang === "en" ? "bg-white shadow text-[#0D2240]" : "text-gray-400 hover:text-gray-600"}`}
          >
            🇺🇸 EN
          </button>
          <button
            onClick={() => setLang("es")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${lang === "es" ? "bg-white shadow text-[#0D2240]" : "text-gray-400 hover:text-gray-600"}`}
          >
            🇪🇸 ES
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeCategory === cat.key
                ? "bg-[#0D2240] text-white shadow"
                : "bg-white border border-gray-200 text-gray-500 hover:border-[#E8726A] hover:text-[#E8726A]"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
            <span className={`text-xs rounded-full px-1.5 ${activeCategory === cat.key ? "bg-white/20" : "bg-gray-100"}`}>
              {items.filter(i => i.category === cat.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <>
          {lang === "es" && (
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              Editing <strong>Spanish</strong> translations. If a translation is blank, the English text will be shown as fallback.
            </div>
          )}

          <div className="mb-4">
            {catItems.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                lang={lang}
                onChange={updated => updateItem(item.id, updated)}
                onDelete={() => deleteItem(item.id)}
                onMoveUp={() => moveItem(item.id, -1)}
                onMoveDown={() => moveItem(item.id, 1)}
                isFirst={idx === 0}
                isLast={idx === catItems.length - 1}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#E8726A] hover:text-[#E8726A] transition-colors"
            >
              + Add question
            </button>
            <button
              onClick={() => saveCategory(activeCategory)}
              disabled={saving !== null}
              className="ml-auto px-6 py-2 bg-[#E8726A] text-white font-bold text-sm rounded-xl hover:bg-[#d45f57] disabled:opacity-50 transition-colors"
            >
              {saving === activeCategory
                ? "Saving…"
                : saved === activeCategory
                ? "✓ Saved"
                : `Save ${activeCatLabel}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
