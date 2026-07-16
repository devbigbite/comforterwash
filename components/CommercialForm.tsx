"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { submitCommercialInquiry } from "@/app/actions/commercial-inquiry"
import { useLang } from "@/components/lang-provider"
import en from "@/lib/translations/en"

// Canonical (always-English) values submitted to the backend/admin email,
// paired by index with the localized label shown to the customer. Keeps
// "Other" detection language-independent and keeps the admin notification
// readable regardless of which language the customer submitted in.
const BUSINESS_TYPE_VALUES = en.commercialForm.businessTypes

const inp = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white placeholder-gray-400"
const label = "block text-xs font-extrabold text-white/90 uppercase tracking-wide mb-1.5"

export function CommercialForm() {
  const { translations: tr } = useLang()
  const t = tr.commercialForm

  const [pending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState("")
  const loadedAtRef = useRef<number>(0)

  useEffect(() => {
    loadedAtRef.current = Date.now()
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set("_loaded_at", String(loadedAtRef.current))
    startTransition(async () => {
      const result = await submitCommercialInquiry(formData)
      if (result.success) {
        setSubmitted(true)
      } else {
        setError(result.error ?? t.genericError)
      }
    })
  }

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-extrabold text-white mb-2">{t.successTitle}</h3>
        <p className="text-white/70 text-sm max-w-sm mx-auto">
          {t.successBody}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from real users, bots fill it in */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}>
        <label htmlFor="_company">Company</label>
        <input id="_company" name="_company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {/* Row 1: Business Name + Owner/Manager */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{t.businessNameLabel} <span className="text-[#E8726A]">*</span></label>
          <input
            name="business_name"
            type="text"
            required
            placeholder={t.businessNamePlaceholder}
            className={inp}
          />
        </div>
        <div>
          <label className={label}>{t.ownerLabel} <span className="text-[#E8726A]">*</span></label>
          <input
            name="contact"
            type="text"
            required
            placeholder={t.ownerPlaceholder}
            className={inp}
          />
        </div>
      </div>

      {/* Row 2: Email + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{t.emailLabel} <span className="text-[#E8726A]">*</span></label>
          <input
            name="email"
            type="email"
            required
            placeholder={t.emailPlaceholder}
            className={inp}
          />
        </div>
        <div>
          <label className={label}>{t.phoneLabel} <span className="text-[#E8726A]">*</span></label>
          <input
            name="phone"
            type="tel"
            required
            placeholder={t.phonePlaceholder}
            className={inp}
          />
        </div>
      </div>

      {/* Row 3: Business Type */}
      <div>
        <label className={label}>{t.businessTypeLabel} <span className="text-[#E8726A]">*</span></label>
        <select
          name="business_type"
          required
          defaultValue=""
          className={inp}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="" disabled>{t.selectIndustry}</option>
          {BUSINESS_TYPE_VALUES.map((value, i) => (
            <option key={value} value={value}>{t.businessTypes[i] ?? value}</option>
          ))}
        </select>
        {selectedType === "Other" && (
          <input
            name="other_type"
            type="text"
            required
            placeholder={t.otherTypePlaceholder}
            className={`${inp} mt-2`}
          />
        )}
      </div>

      {/* Row 4: Optional fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>
            {t.weeklyVolumeLabel}
            <span className="ml-1 text-white/40 normal-case font-normal">{t.optional}</span>
          </label>
          <input
            name="weekly_volume"
            type="text"
            placeholder={t.weeklyVolumePlaceholder}
            className={inp}
          />
        </div>
        <div>
          <label className={label}>
            {t.preferredDaysLabel}
            <span className="ml-1 text-white/40 normal-case font-normal">{t.optional}</span>
          </label>
          <input
            name="preferred_days"
            type="text"
            placeholder={t.preferredDaysPlaceholder}
            className={inp}
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-sm uppercase tracking-widest py-4 rounded-full transition-colors"
      >
        {pending ? t.sending : t.submitBtn}
      </button>

      <p className="text-center text-white/40 text-xs">
        {t.replyNote}
      </p>
    </form>
  )
}
