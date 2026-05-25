"use client"

import { useState, useCallback, useRef } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { CheckCircle2, Check } from "lucide-react"
import { SubscriptionPlan, startPlanCheckout } from "@/app/actions/subscription-plans"
import { ServiceOption } from "@/app/actions/service-options"
import { getAllTimeWindows, type Route } from "@/lib/route-availability"
import { AddressAutocomplete } from "@/components/address-autocomplete"

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
  { id: "monday",    short: "MON", label: "Monday" },
  { id: "tuesday",   short: "TUE", label: "Tuesday" },
  { id: "wednesday", short: "WED", label: "Wednesday" },
  { id: "thursday",  short: "THU", label: "Thursday" },
  { id: "friday",    short: "FRI", label: "Friday" },
]

function buildAddr(street: string, city: string, state: string, zip: string) {
  return `${street}, ${city}, ${state} ${zip}`.trim()
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ["PLAN", "SCHEDULE", "YOUR INFO", "PAYMENT"]
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num = i + 1
        const done = num < current
        const active = num === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                done    ? "bg-[#E8726A] text-white" :
                active  ? "bg-[#0D2240] text-white" :
                          "bg-gray-100 text-gray-400"
              }`}>
                {done ? <Check className="w-4 h-4" /> : num}
              </div>
              <span className={`text-[10px] mt-1 font-semibold tracking-wide ${active ? "text-[#0D2240]" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-1 mb-4 ${num < current ? "bg-[#E8726A]" : "bg-gray-200"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Plan banner shown on signup steps ─────────────────────────────────────────
function PlanBanner({ plan }: { plan: SubscriptionPlan }) {
  return (
    <div className="bg-[#0D2240] text-white rounded-2xl p-4 mb-6 flex justify-between items-center">
      <div>
        <p className="font-bold">{plan.name}</p>
        <p className="text-white/60 text-sm">{plan.lbs_included} lbs/mo · ${(plan.overage_rate_cents / 100).toFixed(2)}/lb overage</p>
      </div>
      <p className="text-[#E8726A] font-extrabold text-xl">${(plan.monthly_price_cents / 100).toFixed(0)}<span className="text-xs font-normal text-white/50">/mo</span></p>
    </div>
  )
}

// ── Time slot pills ────────────────────────────────────────────────────────────
function TimeSlotPicker({ value, onChange, windows }: {
  value: string
  onChange: (v: string) => void
  windows: { id: string; label: string }[]
}) {
  if (windows.length === 0) return null
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">Available time slots</p>
      <div className="flex flex-wrap gap-2">
        {windows.map(w => (
          <button key={w.id} type="button" onClick={() => onChange(w.label)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              value === w.label
                ? "bg-[#E8726A] border-[#E8726A] text-white"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
            {w.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Address block (street + city/state/zip) ────────────────────────────────────
function AddressBlock({ label, street, city, state, zip, onChange }: {
  label: string
  street: string
  city: string
  state: string
  zip: string
  onChange: (parts: { street?: string; city?: string; state?: string; zip?: string }) => void
}) {
  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">{label} *</p>
      <AddressAutocomplete
        value={street}
        onChange={v => onChange({ street: v })}
        onPlaceSelect={parts => onChange({ street: parts.street, city: parts.city, state: parts.state, zip: parts.zip })}
        placeholder="Street address"
        className={inputCls}
      />
      <div className="grid gap-2" style={{ gridTemplateColumns: "2fr 1fr 2fr" }}>
        <input placeholder="City" value={city}
          onChange={e => onChange({ city: e.target.value })}
          className={inputCls} />
        <input placeholder="FL" maxLength={2} value={state}
          onChange={e => onChange({ state: e.target.value.toUpperCase() })}
          className={`${inputCls} text-center uppercase`} />
        <input placeholder="Zip" value={zip}
          onChange={e => onChange({ zip: e.target.value })}
          className={inputCls} />
      </div>
    </div>
  )
}

export default function PricingClient({
  plans, routes, detergents,
}: {
  plans: SubscriptionPlan[]
  routes: Route[]
  detergents: ServiceOption[]
}) {
  const timeWindows = getAllTimeWindows(routes)
  const defaultWindow = timeWindows[0]?.label ?? ""

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const sessionIdRef = useRef<string | null>(null)

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    pickupStreet: "", pickupCity: "", pickupState: "FL", pickupZip: "",
    sameAddress: true,
    deliveryStreet: "", deliveryCity: "", deliveryState: "FL", deliveryZip: "",
    pickupDay: "monday", pickupWindow: defaultWindow,
    deliveryDay: "wednesday", deliveryWindow: defaultWindow,
    detergentId: detergents[0]?.id ?? "",
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function patchPickup(parts: { street?: string; city?: string; state?: string; zip?: string }) {
    setForm(p => ({
      ...p,
      pickupStreet: parts.street  ?? p.pickupStreet,
      pickupCity:   parts.city    ?? p.pickupCity,
      pickupState:  parts.state   ?? p.pickupState,
      pickupZip:    parts.zip     ?? p.pickupZip,
    }))
  }

  function patchDelivery(parts: { street?: string; city?: string; state?: string; zip?: string }) {
    setForm(p => ({
      ...p,
      deliveryStreet: parts.street  ?? p.deliveryStreet,
      deliveryCity:   parts.city    ?? p.deliveryCity,
      deliveryState:  parts.state   ?? p.deliveryState,
      deliveryZip:    parts.zip     ?? p.deliveryZip,
    }))
  }

  function selectPlan(plan: SubscriptionPlan) {
    setSelectedPlan(plan)
    setStep(2)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function goTo(n: 1 | 2 | 3 | 4 | 5) {
    setError("")
    setStep(n)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function getAddresses() {
    const pickup = buildAddr(form.pickupStreet, form.pickupCity, form.pickupState, form.pickupZip)
    const delivery = form.sameAddress
      ? pickup
      : buildAddr(form.deliveryStreet, form.deliveryCity, form.deliveryState, form.deliveryZip)
    return { pickup, delivery }
  }

  async function submitSignup() {
    if (!selectedPlan) return
    const required = [form.name, form.email, form.phone, form.pickupStreet, form.pickupCity, form.pickupZip]
    if (required.some(v => !v.trim())) { setError("Please fill in all required fields."); return }
    if (!form.sameAddress && (!form.deliveryStreet.trim() || !form.deliveryCity.trim())) {
      setError("Please fill in the delivery address."); return
    }

    const selectedDetergent = detergents.find(d => d.id === form.detergentId)
    const { pickup, delivery } = getAddresses()

    setSaving(true)
    setError("")
    const result = await startPlanCheckout({
      planId:             selectedPlan.id,
      customerName:       form.name,
      customerEmail:      form.email,
      customerPhone:      form.phone,
      customerAddress:    pickup,
      deliveryAddress:    delivery,
      pickupDayOfWeek:    form.pickupDay,
      pickupTimeWindow:   form.pickupWindow,
      deliveryDayOfWeek:  form.deliveryDay,
      deliveryTimeWindow: form.deliveryWindow,
      detergent:          selectedDetergent?.name ?? "",
    })
    setSaving(false)

    if ("error" in result) { setError(result.error); return }
    sessionIdRef.current = result.sessionId
    setStep(4)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const fetchClientSecret = useCallback(async () => {
    if (!selectedPlan) return ""
    const selectedDetergent = detergents.find(d => d.id === form.detergentId)
    const { pickup, delivery } = getAddresses()
    const result = await startPlanCheckout({
      planId:             selectedPlan.id,
      customerName:       form.name,
      customerEmail:      form.email,
      customerPhone:      form.phone,
      customerAddress:    pickup,
      deliveryAddress:    delivery,
      pickupDayOfWeek:    form.pickupDay,
      pickupTimeWindow:   form.pickupWindow,
      deliveryDayOfWeek:  form.deliveryDay,
      deliveryTimeWindow: form.deliveryWindow,
      detergent:          selectedDetergent?.name ?? "",
    })
    if ("error" in result) return ""
    sessionIdRef.current = result.sessionId
    return result.clientSecret
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan, form, detergents])

  // ── Done ───────────────────────────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-[#0D2240] mb-2">You&apos;re all set! 🎉</h2>
          <p className="text-gray-600 mb-2">Your <strong>{selectedPlan?.name}</strong> plan is active.</p>
          <p className="text-gray-500 text-sm">We&apos;ll reach out to confirm your first pickup. Check your email for confirmation.</p>
        </div>
      </div>
    )
  }

  // ── Step 4: Payment ────────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Steps current={4} />
        {selectedPlan && <PlanBanner plan={selectedPlan} />}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-extrabold text-[#0D2240] mb-1">Complete your subscription</h2>
          <p className="text-sm text-gray-500 mb-6">Billed monthly · cancel anytime</p>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret, onComplete: () => setStep(5) }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
          <button onClick={() => goTo(3)} className="mt-4 text-sm text-gray-400 hover:text-[#0D2240]">← Back</button>
        </div>
      </div>
    )
  }

  // ── Step 3: Your Info ──────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <Steps current={3} />
        {selectedPlan && <PlanBanner plan={selectedPlan} />}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-xl font-extrabold text-[#0D2240]">Your details</h2>

          <div>
            <label className="text-xs text-gray-600 font-medium uppercase tracking-wide">Full Name *</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
              value={form.name} onChange={e => set("name", e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium uppercase tracking-wide">Email *</label>
              <input type="email" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium uppercase tracking-wide">Phone *</label>
              <input type="tel" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
                value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(407) 555-0100" />
            </div>
          </div>

          <AddressBlock
            label="Pickup Address"
            street={form.pickupStreet} city={form.pickupCity} state={form.pickupState} zip={form.pickupZip}
            onChange={patchPickup}
          />

          <label className="flex items-center gap-2.5 cursor-pointer bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <input type="checkbox" className="rounded" checked={form.sameAddress}
              onChange={e => set("sameAddress", e.target.checked)} />
            <span className="text-sm text-gray-700 font-medium">Same address for pickup &amp; delivery</span>
          </label>

          {!form.sameAddress && (
            <AddressBlock
              label="Delivery Address"
              street={form.deliveryStreet} city={form.deliveryCity} state={form.deliveryState} zip={form.deliveryZip}
              onChange={patchDelivery}
            />
          )}

          <hr className="border-gray-100" />

          {/* Detergent preference */}
          {detergents.length > 0 && (
            <div>
              <p className="text-sm font-bold text-[#0D2240] mb-3">Detergent Preference</p>
              <div className="space-y-2">
                {detergents.map(d => (
                  <button key={d.id} type="button"
                    onClick={() => set("detergentId", d.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      form.detergentId === d.id
                        ? "border-[#E8726A] bg-[#E8726A]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      form.detergentId === d.id ? "border-[#E8726A]" : "border-gray-300"
                    }`}>
                      {form.detergentId === d.id && <div className="w-2 h-2 rounded-full bg-[#E8726A]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0D2240]">{d.name}</p>
                      {d.description && <p className="text-xs text-gray-500">{d.description}</p>}
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${d.price_cents === 0 ? "text-green-600" : "text-gray-600"}`}>
                      {d.price_cents === 0 ? "Free" : `+$${(d.price_cents / 100).toFixed(2)}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => goTo(2)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={submitSignup} disabled={saving}
              className="flex-[2] bg-[#0D2240] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#0D2240]/90 transition-colors disabled:opacity-50">
              {saving ? "Setting up…" : "Continue: Payment →"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Schedule ───────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <Steps current={2} />
        {selectedPlan && <PlanBanner plan={selectedPlan} />}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          {/* Pickup */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#E8726A] text-white text-xs font-bold flex items-center justify-center">1</div>
              <p className="font-bold text-[#0D2240]">Pickup Day &amp; Time</p>
              <span className="text-xs text-gray-500 ml-1">— recurring weekly</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Which day should we pick up each week?</p>
            <div className="flex gap-2 mb-4">
              {DAYS.map(d => (
                <button key={d.id} type="button" onClick={() => set("pickupDay", d.id)}
                  className={`flex-1 py-3 rounded-xl border text-center transition-colors ${
                    form.pickupDay === d.id
                      ? "bg-[#E8726A] border-[#E8726A] text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}>
                  <p className="text-[10px] font-bold">{d.short}</p>
                </button>
              ))}
            </div>
            <TimeSlotPicker value={form.pickupWindow} onChange={v => set("pickupWindow", v)} windows={timeWindows} />
          </div>

          <hr className="border-gray-100" />

          {/* Delivery */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#0D2240] text-white text-xs font-bold flex items-center justify-center">2</div>
              <p className="font-bold text-[#0D2240]">Delivery Day &amp; Time</p>
              <span className="text-xs text-gray-500 ml-1">— 48–72hrs after pickup</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Which day should we deliver each week?</p>
            <div className="flex gap-2 mb-4">
              {DAYS.map(d => (
                <button key={d.id} type="button" onClick={() => set("deliveryDay", d.id)}
                  className={`flex-1 py-3 rounded-xl border text-center transition-colors ${
                    form.deliveryDay === d.id
                      ? "bg-[#E8726A] border-[#E8726A] text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}>
                  <p className="text-[10px] font-bold">{d.short}</p>
                </button>
              ))}
            </div>
            <TimeSlotPicker value={form.deliveryWindow} onChange={v => set("deliveryWindow", v)} windows={timeWindows} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => goTo(1)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={() => goTo(3)}
              className="flex-[2] bg-[#0D2240] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#0D2240]/90 transition-colors">
              Continue: Your Info →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 1: Plan selection ──────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        {/* Left: features */}
        <div className="lg:w-72 shrink-0">
          <h1 className="text-3xl font-extrabold text-[#0D2240] mb-2">Choose Your Plan</h1>
          <p className="text-gray-600 text-sm mb-6">All plans include:</p>
          <ul className="space-y-3">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Check className="w-4 h-4 text-[#E8726A] shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-6">*Change, pause, or cancel anytime.</p>
        </div>

        {/* Right: plan cards */}
        <div className="flex-1 space-y-4">
          {plans.length === 0 ? (
            <p className="text-gray-500">No plans available yet. Check back soon.</p>
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
                      ${(plan.monthly_price_cents / 100).toFixed(0)}<span className="text-sm font-normal text-gray-500">/mo</span>
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-600 shrink-0">
                    <p className="font-semibold text-gray-700">{plan.lbs_included} lbs included</p>
                    <p>${(plan.overage_rate_cents / 100).toFixed(2)}/lb overage</p>
                  </div>
                </div>
                <button onClick={() => selectPlan(plan)}
                  className="mt-4 w-full bg-[#0D2240] text-white py-3 rounded-xl font-bold hover:bg-[#0D2240]/90 transition-colors">
                  Choose This Plan →
                </button>
                <p className="text-xs text-center text-gray-400 mt-2">
                  {plan.min_commitment_months ?? 3}-month minimum commitment · cancel anytime after
                </p>
              </div>
            ))
          )}
          <p className="text-xs text-center text-gray-400 mt-4">
            All plans require a {plans[0]?.min_commitment_months ?? 3}-month minimum commitment.
            After that, cancel anytime with 30 days&apos; notice.
          </p>
        </div>
      </div>
    </div>
  )
}
