"use client"

import { useState } from "react"
import Link from "next/link"
import { submitApplication } from "@/app/actions/workers"

// ── IC Agreement text per role ─────────────────────────────────────────────────
const IC_AGREEMENT = {
  driver: `INDEPENDENT CONTRACTOR AGREEMENT — DRIVER

This Independent Contractor Agreement ("Agreement") is entered into between WashFold Orlando ("Company") and the individual identified below ("Contractor").

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee of the Company. Contractor shall have no authority to act on behalf of or bind the Company in any manner.

2. SERVICES
Contractor agrees to perform pickup and delivery services for laundry orders as assigned through the Company's platform. Contractor sets their own schedule and accepts or declines jobs at their discretion.

3. COMPENSATION
Contractor will be compensated on a per-order and per-mile basis at rates set by the Company and communicated prior to acceptance of shifts. Payment is issued weekly via Stripe direct deposit to the Contractor's connected bank account.

4. EXPENSES & EQUIPMENT
Contractor is responsible for all expenses related to their vehicle, including fuel, insurance, maintenance, and registration. Contractor must maintain valid driver's license and personal auto insurance.

5. TAXES
As an independent contractor, Contractor is solely responsible for all federal, state, and local taxes on income earned. The Company will issue a Form 1099-NEC for earnings of $600 or more in a calendar year.

6. BACKGROUND CHECK
Contractor consents to a background check as a condition of onboarding.

7. CONFIDENTIALITY
Contractor agrees to keep all customer information, route details, and business information confidential.

8. TERMINATION
Either party may terminate this Agreement at any time with no notice required.

9. GOVERNING LAW
This Agreement is governed by the laws of the State of Florida.`,

  operator: `INDEPENDENT CONTRACTOR AGREEMENT — WASHING OPERATOR

This Independent Contractor Agreement ("Agreement") is entered into between WashFold Orlando ("Company") and the individual identified below ("Contractor").

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee of the Company. Contractor shall have no authority to act on behalf of or bind the Company in any manner.

2. SERVICES
Contractor agrees to perform washing and folding services at designated partner laundry facilities as assigned through the Company's platform. Contractor sets their own schedule and accepts or declines jobs at their discretion.

3. COMPENSATION
Contractor will be compensated on an hourly and per-mile basis at rates set by the Company and communicated prior to acceptance of shifts. Payment is issued weekly via Stripe direct deposit to the Contractor's connected bank account.

4. EXPENSES
Contractor is responsible for transportation to and from assigned facilities. Mileage reimbursement is included in the per-mile compensation rate.

5. TAXES
As an independent contractor, Contractor is solely responsible for all federal, state, and local taxes on income earned. The Company will issue a Form 1099-NEC for earnings of $600 or more in a calendar year.

6. BACKGROUND CHECK
Contractor consents to a background check as a condition of onboarding.

7. CONFIDENTIALITY
Contractor agrees to keep all customer information and business information confidential.

8. TERMINATION
Either party may terminate this Agreement at any time with no notice required.

9. GOVERNING LAW
This Agreement is governed by the laws of the State of Florida.`,

  combo: `INDEPENDENT CONTRACTOR AGREEMENT — WASHING OPERATOR / DRIVER

This Independent Contractor Agreement ("Agreement") is entered into between WashFold Orlando ("Company") and the individual identified below ("Contractor").

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee of the Company. Contractor shall have no authority to act on behalf of or bind the Company in any manner.

2. SERVICES
Contractor agrees to perform both (a) pickup and delivery services for laundry orders and (b) washing and folding services at designated partner laundry facilities, as assigned through the Company's platform. Contractor sets their own schedule and accepts or declines jobs at their discretion.

3. COMPENSATION
Contractor will be compensated on a per-order, per-mile, and hourly basis depending on the type of shift accepted, at rates set by the Company and communicated prior to acceptance. Payment is issued weekly via Stripe direct deposit to the Contractor's connected bank account.

4. EXPENSES & EQUIPMENT
Contractor is responsible for all expenses related to their vehicle, including fuel, insurance, maintenance, and registration. Contractor must maintain valid driver's license and personal auto insurance.

5. TAXES
As an independent contractor, Contractor is solely responsible for all federal, state, and local taxes on income earned. The Company will issue a Form 1099-NEC for earnings of $600 or more in a calendar year.

6. BACKGROUND CHECK
Contractor consents to a background check as a condition of onboarding.

7. CONFIDENTIALITY
Contractor agrees to keep all customer information, route details, and business information confidential.

8. TERMINATION
Either party may terminate this Agreement at any time with no notice required.

9. GOVERNING LAW
This Agreement is governed by the laws of the State of Florida.`,
}

type Role = "driver" | "operator" | "combo" | null

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#0D2240" />
      <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
        stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

const ROLE_LABELS: Record<NonNullable<Role>, string> = {
  driver:   "Driver",
  operator: "Washing Operator",
  combo:    "Washing Operator / Driver",
}

export default function ApplyPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [selectedRole, setSelectedRole] = useState<Role>(null)

  // IC agreement signing state
  const [icRead, setIcRead]           = useState(false)
  const [icAgreed, setIcAgreed]       = useState(false)
  const [icSignature, setIcSignature] = useState("")

  // Reset IC state whenever role changes
  function pickRole(role: Role) {
    setSelectedRole(role)
    setIcRead(false)
    setIcAgreed(false)
    setIcSignature("")
  }

  const icValid = icAgreed && icSignature.trim().length > 1

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedRole) {
      setErrorMsg("Please select a role.")
      setStatus("error")
      return
    }
    if (!icValid) {
      setErrorMsg("Please read and sign the Independent Contractor Agreement.")
      setStatus("error")
      return
    }
    setStatus("submitting")
    const fd = new FormData(e.currentTarget)
    fd.set(`role_${selectedRole}`, "on")
    fd.set("ic_signature", icSignature.trim())
    fd.set("ic_role", ROLE_LABELS[selectedRole])
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
          Wash & fold, drive deliveries, or both. Flexible hours, competitive pay, and weekly direct deposit via Stripe.
        </p>
      </div>

      <div className="mx-auto max-w-xl px-4 py-10">

        {/* Role highlights */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl mb-2">🚐</div>
            <h3 className="font-extrabold text-[#0D2240] text-xs uppercase tracking-wide mb-1">Driver</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">Pickup & delivery routes. Pay per order + mileage.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl mb-2">🧺</div>
            <h3 className="font-extrabold text-[#0D2240] text-xs uppercase tracking-wide mb-1">Washing Operator</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">Wash & fold at partner facilities. Paid hourly + mileage.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl mb-2">🚐🧺</div>
            <h3 className="font-extrabold text-[#0D2240] text-xs uppercase tracking-wide mb-1">Both</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">Do both roles for maximum earning flexibility.</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="font-extrabold text-[#0D2240] text-lg">Your Information</h2>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Full Name *</label>
              <input name="name" required placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Email Address *</label>
              <input name="email" type="email" required placeholder="jane@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Phone Number *</label>
              <input name="phone" type="tel" required placeholder="(407) 555-0100"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">Your Address *</label>
              <input name="address" required placeholder="123 Oak St, Orlando FL 32827"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            {/* Role selection */}
            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">I want to work as... *</label>
              <div className="space-y-2">
                {([
                  { key: "driver",   emoji: "🚐", label: "Driver",                    sub: "Pickup & delivery" },
                  { key: "operator", emoji: "🧺", label: "Washing Operator",           sub: "Wash & fold at facilities" },
                  { key: "combo",    emoji: "🚐🧺", label: "Washing Operator / Driver", sub: "Both roles — max flexibility" },
                ] as const).map((r) => (
                  <label key={r.key}
                    className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${
                      selectedRole === r.key
                        ? "border-[#E8726A] bg-[#fdf6f3]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => pickRole(r.key)}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      selectedRole === r.key ? "bg-[#E8726A] border-[#E8726A]" : "border-gray-300"
                    }`}>
                      {selectedRole === r.key && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="text-base">{r.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#0D2240]">{r.label}</p>
                      <p className="text-xs text-gray-400">{r.sub}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Vehicle checkbox — shown if driver or combo */}
            {(selectedRole === "driver" || selectedRole === "combo") && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="has_vehicle" className="w-4 h-4 accent-[#E8726A]" />
                  <span className="text-sm text-gray-600">Yes, I have a reliable vehicle for deliveries</span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">
                Relevant Experience <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea name="experience" rows={3}
                placeholder="Tell us about any relevant experience — delivery, laundry, customer service, etc."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A] resize-none" />
            </div>
          </div>

          {/* ── IC Agreement ── shown once a role is selected */}
          {selectedRole && (
            <div className="bg-white rounded-2xl shadow-sm border-2 border-[#0D2240]/20 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📄</span>
                <div>
                  <h2 className="font-extrabold text-[#0D2240] text-base">Independent Contractor Agreement</h2>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[selectedRole]} — read and sign to continue</p>
                </div>
              </div>

              {/* Scrollable agreement text */}
              <div
                onScroll={(e) => {
                  const el = e.currentTarget
                  // Mark as "read" once scrolled near the bottom
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setIcRead(true)
                }}
                className="h-52 overflow-y-auto border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-mono"
              >
                {IC_AGREEMENT[selectedRole]}
                <div className="h-4" />
              </div>

              {!icRead && (
                <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
                  <span>⬇</span> Scroll to the bottom to read the full agreement
                </p>
              )}

              {icRead && (
                <>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={icAgreed}
                      onChange={(e) => setIcAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#E8726A] shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-snug">
                      I have read and agree to the Independent Contractor Agreement above. I understand I am an independent contractor, not an employee.
                    </span>
                  </label>

                  {icAgreed && (
                    <div>
                      <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">
                        Sign below — type your full legal name *
                      </label>
                      <input
                        type="text"
                        value={icSignature}
                        onChange={(e) => setIcSignature(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full border-b-2 border-gray-300 focus:border-[#E8726A] bg-transparent px-0 py-2 text-lg italic text-[#0D2240] focus:outline-none placeholder:text-gray-300 font-serif"
                        style={{ fontFamily: "Georgia, serif" }}
                      />
                      {icSignature.trim().length > 1 && (
                        <p className="text-xs text-green-600 font-semibold mt-1.5 flex items-center gap-1">
                          ✓ Agreement signed as &ldquo;{icSignature.trim()}&rdquo; — {new Date().toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting" || (selectedRole !== null && !icValid)}
            className="w-full bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold py-4 rounded-xl text-sm uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
