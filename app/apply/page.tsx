"use client"

import { useState } from "react"
import Link from "next/link"
import { submitApplication } from "@/app/actions/workers"

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#0D2240" />
      <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
        stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function ApplyPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [roles, setRoles] = useState({ driver: false, operator: false })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!roles.driver && !roles.operator) {
      setErrorMsg("Please select at least one role.")
      setStatus("error")
      return
    }
    setStatus("submitting")
    const fd = new FormData(e.currentTarget)
    const result = await submitApplication(fd)
    if (result.success) {
      setStatus("success")
    } else {
      setErrorMsg(result.error ?? "Something went wrong.")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
          <h1 className="text-2xl font-extrabold text-[#0D2240] mb-2">Application Received!</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Thanks for applying to join the WashFold Orlando team. We'll review your application and reach out within 2–3 business days.
          </p>
          <Link href="/" className="inline-block bg-[#0D2240] text-white font-bold px-8 py-3 rounded-full text-sm uppercase tracking-wide hover:bg-[#1a3a5c] transition-colors">
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#0D2240] font-extrabold text-lg">
            <Logo />
            Wash<span className="text-[#E8726A]">Fold</span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
            ← Back to site
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#0D2240] py-10 text-center px-4">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-3">
          <span className="text-white font-bold text-sm uppercase tracking-wide">We're Hiring</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Join the WashFold Team</h1>
        <p className="text-white/60 text-sm max-w-md mx-auto">
          Drive deliveries, run laundry operations, or both. Flexible hours, competitive pay, and weekly direct deposit via Stripe.
        </p>
      </div>

      <div className="mx-auto max-w-xl px-4 py-10">

        {/* Role highlights */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-2xl mb-2">🚐</div>
            <h3 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-1">Driver</h3>
            <p className="text-xs text-gray-400 leading-relaxed">Pickup & delivery routes. Pay per order + mileage reimbursement.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-2xl mb-2">🧺</div>
            <h3 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-1">Operator</h3>
            <p className="text-xs text-gray-400 leading-relaxed">Wash & fold at our partner facilities. Paid hourly + mileage.</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="font-extrabold text-[#0D2240] text-lg">Your Information</h2>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Full Name *</label>
            <input name="name" required placeholder="Jane Smith"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Email Address *</label>
            <input name="email" type="email" required placeholder="jane@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Phone Number *</label>
            <input name="phone" type="tel" required placeholder="(407) 555-0100"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Your Address *</label>
            <input name="address" required placeholder="123 Oak St, Orlando FL 32827"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>

          {/* Role selection */}
          <div>
            <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">I want to work as... *</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "driver", label: "🚐 Driver", name: "role_driver" },
                { key: "operator", label: "🧺 Operator", name: "role_operator" },
              ].map((r) => (
                <label key={r.key}
                  className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${
                    roles[r.key as keyof typeof roles]
                      ? "border-[#E8726A] bg-[#fdf6f3]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <input type="checkbox" name={r.name}
                    checked={roles[r.key as keyof typeof roles]}
                    onChange={(e) => setRoles(p => ({ ...p, [r.key]: e.target.checked }))}
                    className="sr-only" />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    roles[r.key as keyof typeof roles] ? "bg-[#E8726A] border-[#E8726A]" : "border-gray-300"
                  }`}>
                    {roles[r.key as keyof typeof roles] && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-[#0D2240]">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Vehicle — only shown if driver is selected */}
          {roles.driver && (
            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">Do you have your own vehicle?</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="has_vehicle" className="w-4 h-4 accent-[#E8726A]" />
                <span className="text-sm text-gray-600">Yes, I have a reliable vehicle for deliveries</span>
              </label>
            </div>
          )}

          {/* Experience */}
          <div>
            <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">
              Relevant Experience <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea name="experience" rows={3}
              placeholder="Tell us about any relevant experience — delivery, laundry, customer service, etc."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A] resize-none" />
          </div>

          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          <button type="submit" disabled={status === "submitting"}
            className="w-full bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold py-4 rounded-xl text-sm uppercase tracking-wide transition-colors disabled:opacity-60">
            {status === "submitting" ? "Submitting…" : "Submit Application →"}
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            By submitting you agree to a background check as part of our onboarding process.
            Pay is issued weekly via Stripe direct deposit.
          </p>
        </form>
      </div>
    </main>
  )
}
