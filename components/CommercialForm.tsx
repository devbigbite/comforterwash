"use client"

import { useState, useTransition } from "react"
import { submitCommercialInquiry } from "@/app/actions/commercial-inquiry"

const BUSINESS_TYPES = [
  "Lodging and Hosting",
  "Short-Term Rentals / Airbnb",
  "Gyms & Fitness Centers",
  "Spas & Salons",
  "Restaurant / Café",
  "Medical / Dental Office",
  "Construction / Contractors",
  "Offices & Co-Working Spaces",
  "Other",
]

const inp = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white placeholder-gray-400"
const label = "block text-xs font-extrabold text-white/90 uppercase tracking-wide mb-1.5"

export function CommercialForm() {
  const [pending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState("")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitCommercialInquiry(formData)
      if (result.success) {
        setSubmitted(true)
      } else {
        setError(result.error ?? "Something went wrong.")
      }
    })
  }

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-extrabold text-white mb-2">We&apos;ve Got Your Request!</h3>
        <p className="text-white/70 text-sm max-w-sm mx-auto">
          We&apos;ll review your information and reach out within one business day with a custom quote.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Row 1: Business Name + Owner/Manager */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Business Name <span className="text-[#E8726A]">*</span></label>
          <input
            name="business_name"
            type="text"
            required
            placeholder="Sunshine Gym & Spa"
            className={inp}
          />
        </div>
        <div>
          <label className={label}>Owner or Manager <span className="text-[#E8726A]">*</span></label>
          <input
            name="contact"
            type="text"
            required
            placeholder="Maria Rodriguez"
            className={inp}
          />
        </div>
      </div>

      {/* Row 2: Email + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Email <span className="text-[#E8726A]">*</span></label>
          <input
            name="email"
            type="email"
            required
            placeholder="maria@sunshinegym.com"
            className={inp}
          />
        </div>
        <div>
          <label className={label}>Phone <span className="text-[#E8726A]">*</span></label>
          <input
            name="phone"
            type="tel"
            required
            placeholder="(407) 555-0100"
            className={inp}
          />
        </div>
      </div>

      {/* Row 3: Business Type */}
      <div>
        <label className={label}>Business Type <span className="text-[#E8726A]">*</span></label>
        <select
          name="business_type"
          required
          defaultValue=""
          className={inp}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="" disabled>Select your industry…</option>
          {BUSINESS_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {selectedType === "Other" && (
          <input
            name="other_type"
            type="text"
            required
            placeholder="Please describe your business…"
            className={`${inp} mt-2`}
          />
        )}
      </div>

      {/* Row 4: Optional fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>
            Estimated Weekly Volume
            <span className="ml-1 text-white/40 normal-case font-normal">(optional)</span>
          </label>
          <input
            name="weekly_volume"
            type="text"
            placeholder="e.g. 50 lbs, 20 towels/day"
            className={inp}
          />
        </div>
        <div>
          <label className={label}>
            Preferred Pickup / Delivery Days
            <span className="ml-1 text-white/40 normal-case font-normal">(optional)</span>
          </label>
          <input
            name="preferred_days"
            type="text"
            placeholder="e.g. Mon, Wed, Fri"
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
        {pending ? "Sending…" : "Request a Bid →"}
      </button>

      <p className="text-center text-white/40 text-xs">
        We&apos;ll reply within one business day.
      </p>
    </form>
  )
}
