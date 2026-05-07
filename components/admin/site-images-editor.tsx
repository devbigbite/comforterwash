"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { uploadSiteImage, resetSiteImage, setSiteTextValue } from "@/app/actions/settings"
import { SITE_IMAGE_SLOTS, DEFAULT_IMAGES, type SiteImages } from "@/lib/site-images-config"
import { DEFAULT_TEXT, type SiteText } from "@/lib/site-text-config"

// ── Slide 2 steps preview (mirrors hero-carousel layout) ────────────────────

function StepsPreview({ src, text }: { src: string; text: SiteText }) {
  const panels = [
    { step: "1", label: text.slide_2_p1_label, desc: text.slide_2_p1_desc, accent: "#a78bfa" },
    { step: "2", label: text.slide_2_p2_label, desc: text.slide_2_p2_desc, accent: "#38bdf8" },
    { step: "3", label: text.slide_2_p3_label, desc: text.slide_2_p3_desc, accent: "#38bdf8" },
  ]
  const isExternal = src.startsWith("http")
  return (
    <div className="relative w-full h-48 bg-gray-900 overflow-hidden rounded-t-2xl">
      <Image src={src} alt="Slide 2 preview" fill className="object-cover object-center" unoptimized={isExternal} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/75" />
      <div className="absolute inset-0 grid grid-cols-3">
        {panels.map((p, i) => (
          <div key={i} className="relative flex flex-col justify-end p-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-extrabold border shrink-0"
                style={{ borderColor: p.accent, color: p.accent }}
              >
                {p.step}
              </span>
              <span className="text-white font-extrabold text-[9px] uppercase tracking-wide drop-shadow leading-tight">{p.label}</span>
            </div>
            <p className="text-white/75 text-[8px] leading-tight ml-7 line-clamp-2">{p.desc}</p>
            {i < 2 && (
              <div
                className="absolute top-0 right-0 bottom-0 w-px opacity-40"
                style={{ background: `linear-gradient(to bottom, transparent, ${p.accent}, transparent)` }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Full slide preview ────────────────────────────────────────────────────────

function FullSlidePreview({ src, overlay, headline, subline, cta }: {
  src: string; overlay: string; headline: string; subline: string; cta: string
}) {
  const isExternal = src.startsWith("http")
  return (
    <div className="relative w-full h-48 bg-gray-900 overflow-hidden rounded-t-2xl">
      <Image src={src} alt="Slide preview" fill className="object-cover object-center" unoptimized={isExternal} />
      <div className={`absolute inset-0 bg-gradient-to-r ${overlay} flex items-end p-4`}>
        <div>
          <p className="text-white font-extrabold text-sm leading-tight drop-shadow line-clamp-1">{headline}</p>
          <p className="text-white/70 text-[10px] mt-0.5 line-clamp-1">{subline}</p>
          <span className="inline-block mt-1.5 bg-[#E8726A] text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">{cta}</span>
        </div>
      </div>
    </div>
  )
}

// ── Plain image preview ───────────────────────────────────────────────────────

function PlainPreview({ src, label, custom }: { src: string; label: string; custom: boolean }) {
  const isExternal = src.startsWith("http")
  return (
    <div className="relative w-full h-48 bg-gray-100 overflow-hidden rounded-t-2xl">
      <Image src={src} alt={label} fill className="object-cover" unoptimized={isExternal} />
      <span className={`absolute top-3 left-3 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${custom ? "bg-[#E8726A]" : "bg-black/40"}`}>
        {custom ? "Custom" : "Placeholder"}
      </span>
    </div>
  )
}

// ── Text field row ────────────────────────────────────────────────────────────

function TextField({
  label, value, defaultValue, placeholder, onSave, multiline,
}: {
  label: string; value: string; defaultValue: string; placeholder?: string
  onSave: (v: string) => Promise<void>; multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    setSaving(true)
    await onSave(defaultValue)
    setDraft(defaultValue)
    setSaving(false)
    setEditing(false)
  }

  const isChanged = value !== defaultValue

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px] text-green-600 font-semibold">✓ Saved</span>}
          {isChanged && !editing && (
            <button onClick={handleReset} disabled={saving} className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">Reset</button>
          )}
          {!editing ? (
            <button onClick={() => { setDraft(value); setEditing(true) }}
              className="text-[10px] font-semibold text-[#0D2240] hover:text-[#E8726A] transition-colors">
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(false)} disabled={saving}
                className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="text-[10px] font-bold text-white bg-[#0D2240] hover:bg-[#1a3a5c] px-2 py-0.5 rounded-md transition-colors disabled:opacity-50">
                {saving ? "…" : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {editing ? (
        multiline ? (
          <textarea rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder}
            className="w-full border border-[#E8726A] rounded-lg px-3 py-1.5 text-sm focus:outline-none resize-none" />
        ) : (
          <input type="text" value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder}
            className="w-full border border-[#E8726A] rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
        )
      ) : (
        <p className={`text-sm px-1 ${isChanged ? "text-[#0D2240] font-medium" : "text-gray-400 italic"}`}>
          {value || <span className="text-gray-300">(empty)</span>}
        </p>
      )}
    </div>
  )
}

// ── Lang tab toggle ───────────────────────────────────────────────────────────

function LangTabs({ value, onChange }: { value: "en" | "es"; onChange: (v: "en" | "es") => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange("en")}
        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${value === "en" ? "bg-[#0D2240] text-white" : "text-gray-400 hover:text-[#0D2240]"}`}
      >EN</button>
      <button
        onClick={() => onChange("es")}
        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${value === "es" ? "bg-[#E8726A] text-white" : "text-gray-400 hover:text-[#E8726A]"}`}
      >ES</button>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function SiteImagesEditor({
  initialImages,
  initialText,
}: {
  initialImages: SiteImages
  initialText: SiteText
}) {
  const [images, setImages] = useState<SiteImages>(initialImages)
  const [text, setText] = useState<SiteText>(initialText)
  const [uploading, setUploading] = useState<string | null>(null)
  const [imgSaved, setImgSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [langTab, setLangTab] = useState<"en" | "es">("en")
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleUpload(key: string, file: File) {
    setUploading(key)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const url = await uploadSiteImage(key, formData)
      setImages(prev => ({ ...prev, [key]: url }))
      setImgSaved(key)
      setTimeout(() => setImgSaved(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(null)
    }
  }

  async function handleReset(key: string) {
    setUploading(key)
    setError(null)
    try {
      await resetSiteImage(key)
      setImages(prev => ({ ...prev, [key]: DEFAULT_IMAGES[key as keyof SiteImages] }))
      setImgSaved(key)
      setTimeout(() => setImgSaved(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setUploading(null)
    }
  }

  const saveText = useCallback(async (key: keyof SiteText, value: string) => {
    await setSiteTextValue(key, value)
    setText(prev => ({ ...prev, [key]: value }))
  }, [])

  const isCustomImg = (key: string) =>
    images[key as keyof SiteImages] !== DEFAULT_IMAGES[key as keyof SiteImages]

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {SITE_IMAGE_SLOTS.map(slot => {
        const src = images[slot.key as keyof SiteImages]
        const busy = uploading === slot.key
        const done = imgSaved === slot.key
        const custom = isCustomImg(slot.key)

        return (
          <div key={slot.key} className="rounded-2xl border-2 border-[#0D2240]/10 bg-white shadow-sm overflow-hidden">

            {/* Preview — special for each slot type */}
            {slot.key === "slide_1" && (
              <FullSlidePreview
                src={src}
                overlay="from-[#0D2240]/80 via-[#0D2240]/50 to-transparent"
                headline={text.slide_1_headline}
                subline={text.slide_1_subline}
                cta={text.slide_1_cta}
              />
            )}
            {slot.key === "slide_2" && <StepsPreview src={src} text={text} />}
            {slot.key === "slide_3" && (
              <FullSlidePreview
                src={src}
                overlay="from-[#E8726A]/70 via-[#0D2240]/60 to-[#0D2240]/80"
                headline={text.slide_3_headline}
                subline={text.slide_3_subline}
                cta={text.slide_3_cta}
              />
            )}
            {!["slide_1", "slide_2", "slide_3"].includes(slot.key) && (
              <PlainPreview src={src} label={slot.label} custom={custom} />
            )}

            {/* Controls */}
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-extrabold text-[#0D2240] text-sm">{slot.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{slot.description}</p>
                </div>
                {done && <span className="text-xs text-green-600 font-semibold mt-0.5">✓ Saved</span>}
              </div>

              <p className="text-[10px] text-gray-300 font-mono truncate">
                {custom ? src.split("?")[0].split("/").pop() : slot.fallback}
              </p>

              {/* Image upload / reset */}
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  ref={el => { fileRefs.current[slot.key] = el }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(slot.key, file)
                    e.target.value = ""
                  }}
                />
                <button
                  onClick={() => fileRefs.current[slot.key]?.click()}
                  disabled={busy}
                  className="flex-1 bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-wide"
                >
                  {busy ? "Uploading…" : "Upload New Image"}
                </button>
                {custom && (
                  <button onClick={() => handleReset(slot.key)} disabled={busy}
                    className="text-xs text-gray-400 hover:text-red-500 font-semibold px-3 py-2.5 rounded-xl border border-gray-200 hover:border-red-300 transition-colors disabled:opacity-50">
                    Reset
                  </button>
                )}
              </div>

              {/* ── Text editing for banner slides ── */}
              {slot.key === "slide_1" && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#0D2240] uppercase tracking-wide">Slide Text</p>
                    <LangTabs value={langTab} onChange={setLangTab} />
                  </div>
                  {langTab === "en" ? (
                    <>
                      <TextField label="Headline" value={text.slide_1_headline} defaultValue={DEFAULT_TEXT.slide_1_headline} placeholder="Laundry Service That Feels Like Family" onSave={v => saveText("slide_1_headline", v)} />
                      <TextField label="Subline" value={text.slide_1_subline} defaultValue={DEFAULT_TEXT.slide_1_subline} placeholder="Free pickup & delivery · Orlando FL" onSave={v => saveText("slide_1_subline", v)} multiline />
                      <TextField label="Button text" value={text.slide_1_cta} defaultValue={DEFAULT_TEXT.slide_1_cta} placeholder="Schedule a Pickup" onSave={v => saveText("slide_1_cta", v)} />
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-gray-400 italic">Leave blank to use Spanish translation automatically.</p>
                      <TextField label="Titular (ES)" value={text.slide_1_headline_es} defaultValue="" placeholder="Servicio de lavandería que se siente como familia" onSave={v => saveText("slide_1_headline_es", v)} />
                      <TextField label="Subtítulo (ES)" value={text.slide_1_subline_es} defaultValue="" placeholder="Recogida y entrega gratis · Orlando FL" onSave={v => saveText("slide_1_subline_es", v)} multiline />
                      <TextField label="Botón (ES)" value={text.slide_1_cta_es} defaultValue="" placeholder="Programar Recogido" onSave={v => saveText("slide_1_cta_es", v)} />
                    </>
                  )}
                </div>
              )}

              {slot.key === "slide_2" && (
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#0D2240] uppercase tracking-wide">Step Panel Text</p>
                    <LangTabs value={langTab} onChange={setLangTab} />
                  </div>
                  {langTab === "en" ? (
                    <>
                      {[
                        { n: 1, label: text.slide_2_p1_label, desc: text.slide_2_p1_desc, labelKey: "slide_2_p1_label" as const, descKey: "slide_2_p1_desc" as const },
                        { n: 2, label: text.slide_2_p2_label, desc: text.slide_2_p2_desc, labelKey: "slide_2_p2_label" as const, descKey: "slide_2_p2_desc" as const },
                        { n: 3, label: text.slide_2_p3_label, desc: text.slide_2_p3_desc, labelKey: "slide_2_p3_label" as const, descKey: "slide_2_p3_desc" as const },
                      ].map(p => (
                        <div key={p.n} className="rounded-xl bg-gray-50 p-3 space-y-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Step {p.n}</p>
                          <TextField label="Label" value={p.label} defaultValue={DEFAULT_TEXT[p.labelKey]} placeholder="ORDER" onSave={v => saveText(p.labelKey, v)} />
                          <TextField label="Description" value={p.desc} defaultValue={DEFAULT_TEXT[p.descKey]} placeholder="Short description…" onSave={v => saveText(p.descKey, v)} />
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-gray-400 italic">Leave blank to use Spanish translation automatically.</p>
                      {[
                        { n: 1, label: text.slide_2_p1_label_es, desc: text.slide_2_p1_desc_es, labelKey: "slide_2_p1_label_es" as const, descKey: "slide_2_p1_desc_es" as const },
                        { n: 2, label: text.slide_2_p2_label_es, desc: text.slide_2_p2_desc_es, labelKey: "slide_2_p2_label_es" as const, descKey: "slide_2_p2_desc_es" as const },
                        { n: 3, label: text.slide_2_p3_label_es, desc: text.slide_2_p3_desc_es, labelKey: "slide_2_p3_label_es" as const, descKey: "slide_2_p3_desc_es" as const },
                      ].map(p => (
                        <div key={p.n} className="rounded-xl bg-gray-50 p-3 space-y-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Paso {p.n} (ES)</p>
                          <TextField label="Etiqueta (ES)" value={p.label} defaultValue="" placeholder="ORDENAR" onSave={v => saveText(p.labelKey, v)} />
                          <TextField label="Descripción (ES)" value={p.desc} defaultValue="" placeholder="Descripción corta…" onSave={v => saveText(p.descKey, v)} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {slot.key === "slide_3" && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#0D2240] uppercase tracking-wide">Slide Text</p>
                    <LangTabs value={langTab} onChange={setLangTab} />
                  </div>
                  {langTab === "en" ? (
                    <>
                      <TextField label="Headline" value={text.slide_3_headline} defaultValue={DEFAULT_TEXT.slide_3_headline} placeholder="We Come to You. You Enjoy Life." onSave={v => saveText("slide_3_headline", v)} />
                      <TextField label="Subline" value={text.slide_3_subline} defaultValue={DEFAULT_TEXT.slide_3_subline} placeholder="Starting at $2.50/lb · Comforters from $33" onSave={v => saveText("slide_3_subline", v)} multiline />
                      <TextField label="Button text" value={text.slide_3_cta} defaultValue={DEFAULT_TEXT.slide_3_cta} placeholder="See Pricing" onSave={v => saveText("slide_3_cta", v)} />
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-gray-400 italic">Leave blank to use Spanish translation automatically.</p>
                      <TextField label="Titular (ES)" value={text.slide_3_headline_es} defaultValue="" placeholder="Llegamos a ti. Tú disfrutas la vida." onSave={v => saveText("slide_3_headline_es", v)} />
                      <TextField label="Subtítulo (ES)" value={text.slide_3_subline_es} defaultValue="" placeholder="Desde $2.40/lb · Edredones desde $33" onSave={v => saveText("slide_3_subline_es", v)} multiline />
                      <TextField label="Botón (ES)" value={text.slide_3_cta_es} defaultValue="" placeholder="Ver Precios" onSave={v => saveText("slide_3_cta_es", v)} />
                    </>
                  )}
                </div>
              )}

              {/* ── Why Choose Us text (why_us image card) ── */}
              {slot.key === "why_us" && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#0D2240] uppercase tracking-wide">Why Choose Us Text</p>
                    <LangTabs value={langTab} onChange={setLangTab} />
                  </div>
                  <p className="text-[10px] text-gray-400 italic">Leave blank to use translation text automatically.</p>
                  {langTab === "en" ? (
                    <>
                      <TextField label="Heading" value={text.why_heading} defaultValue="" placeholder="Why Choose WashFold Orlando?" onSave={v => saveText("why_heading", v)} />
                      <TextField label="Subheading" value={text.why_subheading} defaultValue="" placeholder="Unmatched Quality and Service in Every Load" onSave={v => saveText("why_subheading", v)} />
                      <TextField label="Body paragraph 1" value={text.why_body1} defaultValue="" placeholder="At WashFold Orlando, we understand…" onSave={v => saveText("why_body1", v)} multiline />
                      <TextField label="Body paragraph 2" value={text.why_body2} defaultValue="" placeholder="Giving you more time for what truly matters." onSave={v => saveText("why_body2", v)} multiline />
                      <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Photo Overlay</p>
                        <TextField label="Tag line" value={text.why_photo_tag} defaultValue="" placeholder="Pick Up & Delivery" onSave={v => saveText("why_photo_tag", v)} />
                        <TextField label="Headline" value={text.why_photo_headline} defaultValue="" placeholder="We Come to You.\nYou Enjoy Life." onSave={v => saveText("why_photo_headline", v)} multiline />
                        <TextField label="Button text" value={text.why_photo_cta} defaultValue="" placeholder="Schedule a Pickup" onSave={v => saveText("why_photo_cta", v)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <TextField label="Encabezado (ES)" value={text.why_heading_es} defaultValue="" placeholder="¿Por qué elegir WashFold Orlando?" onSave={v => saveText("why_heading_es", v)} />
                      <TextField label="Subtítulo (ES)" value={text.why_subheading_es} defaultValue="" placeholder="Calidad y servicio sin igual en cada carga" onSave={v => saveText("why_subheading_es", v)} />
                      <TextField label="Párrafo 1 (ES)" value={text.why_body1_es} defaultValue="" placeholder="En WashFold Orlando, entendemos…" onSave={v => saveText("why_body1_es", v)} multiline />
                      <TextField label="Párrafo 2 (ES)" value={text.why_body2_es} defaultValue="" placeholder="Dándote más tiempo para lo que realmente importa." onSave={v => saveText("why_body2_es", v)} multiline />
                      <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Superposición de foto (ES)</p>
                        <TextField label="Etiqueta (ES)" value={text.why_photo_tag_es} defaultValue="" placeholder="Recogida y entrega" onSave={v => saveText("why_photo_tag_es", v)} />
                        <TextField label="Titular foto (ES)" value={text.why_photo_headline_es} defaultValue="" placeholder="Llegamos a ti.\nTú disfrutas la vida." onSave={v => saveText("why_photo_headline_es", v)} multiline />
                        <TextField label="Botón foto (ES)" value={text.why_photo_cta_es} defaultValue="" placeholder="Programar Recogido" onSave={v => saveText("why_photo_cta_es", v)} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-gray-400 text-center pt-2">
        JPG, PNG or WebP · Max 5 MB per image · All changes go live instantly
      </p>
    </div>
  )
}
