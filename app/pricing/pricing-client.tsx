"use client"

import { useState, useCallback, useRef } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { CheckCircle2, Check } from "lucide-react"
import { SubscriptionPlan, startPlanCheckout } from "@/app/actions/subscription-plans"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const FEATURES = [
  "Free pickup & delivery",
  "No delivery fee, no service fee",
  "Hospital-grade ozone on every wash",
  "No minimum per pickup",
  "Priority scheduling",
  "Change, pause, or cancel anytime",
]

const DAYS = [
  { id: "monday",    label: "Monday" },
  { id: "tuesday",   label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday",  label: "Thursday" },
  { id: "friday",    label: "Friday" },
]
const WINDOWS = ["8am–12pm", "12pm–4pm", "4pm–7pm"]
const DETERGENTS = ["Standard", "Free & Clear (Fragrance-Free)", "Premium Tide"]

export default function PricingClient({ plans }: { plans: SubscriptionPlan[] }) {
  const [step, setStep] = useState<"plans" | "signup" | "checkout" | "done">("plans")
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const sessionIdRef = useRef<string | null>(null)

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    address: "", deliveryAddress: "", sameAddress: true,
    pickupDay: "monday", pickupWindow: "8am–12pm",
    deliveryDay: "wednesday", deliveryWindow: "8am–12pm",
    detergent: "Standard",
  })

  function selectPlan(plan: SubscriptionPlan) {
    setSelectedPlan(plan)
    setStep("signup")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function submitSignup() {
    if (!selectedPlan) return
    const required = [form.name, form.email, form.phone, form.address]
    if (required.some(v => !v.trim())) { setError("Please fill in all required fields."); return }
    if (!form.sameAddress && !form.deliveryAddress.trim()) { setError("Please enter a delivery address."); return }

    setSaving(true)
    setError("")
    const result = await startPlanCheckout({
      planId:            selectedPlan.id,
      customerName:      form.name,
      customerEmail:     form.email,
      customerPhone:     form.phone,
      customerAddress:   form.address,
      deliveryAddress:   form.sameAddress ? form.address : form.deliveryAddress,
      pickupDayOfWeek:   form.pickupDay,
      pickupTimeWindow:  form.pickupWindow,
      deliveryDayOfWeek: form.deliveryDay,
      deliveryTimeWindow: form.deliveryWindow,
      detergent:         form.detergent,
    })
    setSaving(false)

    if ("error" in result) { setError(result.error); return }
    sessionIdRef.current = result.sessionId
    setStep("checkout")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const fetchClientSecret = useCallback(async () => {
    // clientSecret was already obtained in submitSignup; re-fetch if needed
    if (!selectedPlan) return ""
    const result = await startPlanCheckout({
      planId:            selectedPlan.id,
      customerName:      form.name,
      customerEmail:     form.email,
      customerPhone:     form.phone,
      customerAddress:   form.address,
      deliveryAddress:   form.sameAddress ? form.address : form.deliveryAddress,
      pickupDayOfWeek:   form.pickupDay,
      pickupTimeWindow:  form.pickupWindow,
      deliveryDayOfWeek: form.deliveryDay,
      deliveryTimeWindow: form.deliveryWindow,
      detergent:         form.detergent,
    })
    if ("error" in result) return ""
    sessionIdRef.current = result.sessionId
    return result.clientSecret
  }, [selectedPlan, form])

  if (step === "done") {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-[#0D2240] mb-2">You're all set! 🎉</h2>
          <p className="text-gray-600 mb-2">Your <strong>{selectedPlan?.name}</strong> plan is active.</p>
          <p className="text-gray-500 text-sm">We'll reach out to confirm your first pickup. Check your email for confirmation.</p>
        </div>
      </div>
    )
  }

  if (step === "checkout") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button onClick={() => setStep("signup")} className="text-sm text-gray-400 hover:text-[#0D2240] mb-6 flex items-center gap-1">
          ← Back
        </button>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-extrabold text-[#0D2240] mb-1">Complete your subscription</h2>
          <p className="text-sm text-gray-500 mb-6">
            {selectedPlan?.name} — ${((selectedPlan?.monthly_price_cents ?? 0) / 100).toFixed(0)}/mo
          </p>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret, onComplete: () => setStep("done") }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    )
  }

  if (step === "signup") {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <button onClick={() => setStep("plans")} className="text-sm text-gray-400 hover:text-[#0D2240] mb-6 flex items-center gap-1">
          ← Back to plans
        </button>

        {selectedPlan && (
          <div className="bg-[#0D2240] text-white rounded-2xl p-5 mb-6 flex justify-between items-center">
            <div>
              <p className="font-bold text-lg">{selectedPlan.name}</p>
              <p className="text-white/70 text-sm">{selectedPlan.lbs_included} lbs/mo · ${(selectedPlan.overage_rate_cents / 100).toFixed(2)}/lb overage</p>
            </div>
            <p className="text-[#E8726A] font-extrabold text-2xl">${(selectedPlan.monthly_price_cents / 100).toFixed(0)}<span className="text-sm font-normal text-white/60">/mo</span></p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-xl font-extrabold text-[#0D2240]">Your details</h2>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-medium">Full Name *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Email *</label>
              <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Phone *</label>
              <input type="tel" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Pickup Address *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                placeholder="Street address, City, State ZIP"
                value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.sameAddress}
                onChange={e => setForm(p => ({ ...p, sameAddress: e.target.checked }))} />
              Same delivery address
            </label>
            {!form.sameAddress && (
              <div>
                <label className="text-xs text-gray-500 font-medium">Delivery Address *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                  placeholder="Street address, City, State ZIP"
                  value={form.deliveryAddress} onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))} />
              </div>
            )}
          </div>

          <hr className="border-gray-100" />
          <h3 className="font-bold text-[#0D2240]">Pickup schedule</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Pickup Day</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                value={form.pickupDay} onChange={e => setForm(p => ({ ...p, pickupDay: e.target.value }))}>
                {DAYS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Pickup Window</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                value={form.pickupWindow} onChange={e => setForm(p => ({ ...p, pickupWindow: e.target.value }))}>
                {WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Delivery Day</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                value={form.deliveryDay} onChange={e => setForm(p => ({ ...p, deliveryDay: e.target.value }))}>
                {DAYS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Delivery Window</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
                value={form.deliveryWindow} onChange={e => setForm(p => ({ ...p, deliveryWindow: e.target.value }))}>
                {WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Detergent Preference</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1"
              value={form.detergent} onChange={e => setForm(p => ({ ...p, detergent: e.target.value }))}>
              {DETERGENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button onClick={submitSignup} disabled={saving}
            className="w-full bg-[#E8726A] text-white py-3 rounded-xl font-bold text-base hover:bg-[#E8726A]/90 transition-colors disabled:opacity-50">
            {saving ? "Setting up…" : "Continue to Payment →"}
          </button>
        </div>
      </div>
    )
  }

  // ── Plan selection ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        {/* Left: features */}
        <div className="lg:w-72 shrink-0">
          <h1 className="text-3xl font-extrabold text-[#0D2240] mb-2">Choose Your Plan</h1>
          <p className="text-gray-500 text-sm mb-6">All plans include:</p>
          <ul className="space-y-3">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Check className="w-4 h-4 text-[#E8726A] shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-6">*Change, pause, or cancel anytime.</p>
        </div>

        {/* Right: plan cards */}
        <div className="flex-1 space-y-4">
          {plans.length === 0 ? (
            <p className="text-gray-400">No plans available yet. Check back soon.</p>
          ) : (
            plans.map(plan => (
              <div key={plan.id}
                className={`bg-white rounded-2xl border shadow-sm p-6 relative transition-shadow hover:shadow-md ${
                  plan.is_popular ? "border-[#E8726A]/40" : "border-gray-100"
                }`}>
                {plan.is_popular && (
                  <div className="absolute -top-3 left-6">
                    <span className="bg-[#E8726A]/10 text-[#E8726A] text-xs font-semibold px-3 py-1 rounded-full border border-[#E8726A]/20">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-[#0D2240] text-xl">{plan.name}</h3>
                    <p className="text-[#E8726A] text-2xl font-extrabold mt-1">
                      ${(plan.monthly_price_cents / 100).toFixed(0)}<span className="text-sm font-normal text-gray-400">/mo</span>
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500 shrink-0">
                    <p className="font-semibold text-gray-700">{plan.lbs_included} lbs included</p>
                    <p>${(plan.overage_rate_cents / 100).toFixed(2)}/lb overage</p>
                  </div>
                </div>
                <button onClick={() => selectPlan(plan)}
                  className="mt-4 w-full bg-[#0D2240] text-white py-3 rounded-xl font-bold hover:bg-[#0D2240]/90 transition-colors">
                  Choose This Plan →
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
