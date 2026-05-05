"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import Checkout from "./checkout"
import { Checkbox } from "@/components/ui/checkbox"

const PRICE_PER_LB = 250   // $2.50 in cents
const MIN_POUNDS = 8        // $20 minimum ÷ $2.50 = 8 lbs

const TIME_WINDOWS = [
  { value: "9am-1pm", label: "9am – 1pm" },
  { value: "3pm-7pm", label: "3pm – 7pm" },
]

const STEPS = [
  { id: 1, label: "Service" },
  { id: 2, label: "Your Info" },
  { id: 3, label: "Confirm" },
]

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

function getEarliestDelivery(pickup: Date): Date {
  const d = new Date(pickup)
  d.setDate(d.getDate() + 3)
  while ([0, 4, 5, 6].includes(d.getDay())) d.setDate(d.getDate() + 1)
  return d
}

function DateStrip({
  selected,
  onSelect,
  isAvailable,
}: {
  selected: Date | undefined
  onSelect: (d: Date) => void
  isAvailable: (d: Date) => boolean
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dates = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i + 1)
    return d
  })
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const dayHint = (d: Date) => {
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    return diff === 1 ? "tomorrow" : ""
  }
  return (
    <div className="overflow-x-auto pb-1 -mx-1">
      <div className="flex gap-2 px-1 w-max">
        {dates.map((d, i) => {
          const avail = isAvailable(d)
          const sel = !!selected && isSameDay(d, selected)
          const hint = dayHint(d)
          return (
            <button
              key={i}
              type="button"
              disabled={!avail}
              onClick={() => onSelect(d)}
              className={cn(
                "flex flex-col items-center justify-center w-[62px] rounded-2xl border-2 py-2.5 transition-all shrink-0",
                sel ? "bg-[#E8726A] border-[#E8726A] text-white shadow-md"
                  : avail ? "bg-white border-gray-200 text-[#0D2240] hover:border-[#E8726A] hover:shadow-sm cursor-pointer"
                  : "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
              )}
            >
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", sel ? "text-white/80" : avail ? "text-gray-400" : "text-gray-300")}>{DAY_ABBR[d.getDay()]}</span>
              <span className={cn("text-xl font-extrabold leading-tight my-0.5", sel ? "text-white" : avail ? "text-[#0D2240]" : "text-gray-300")}>{d.getDate()}</span>
              <span className={cn("text-[10px] font-bold uppercase", sel ? "text-white/70" : avail ? "text-gray-400" : "text-gray-300")}>{MON_ABBR[d.getMonth()]}</span>
              {hint && <span className={cn("text-[9px] mt-0.5 font-medium", sel ? "text-white/60" : "text-[#E8726A]")}>{hint}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TimeSlotPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs text-center text-gray-400 mb-3 mt-4">Available time slots</p>
      <div className="flex gap-2 justify-center flex-wrap">
        {TIME_WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => onChange(w.value)}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              value === w.value ? "bg-[#E8726A] text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function WashFoldForm() {
  const [step, setStep] = useState<1 | 2 | 3 | "payment">(1)
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", address: "",
    pickupDate: undefined as Date | undefined,
    deliveryDate: undefined as Date | undefined,
    pickupTimeWindow: "",
    deliveryTimeWindow: "",
    pounds: MIN_POUNDS,
    signature: "",
    agreedToTerms: false,
    smsConsent: false,
  })

  const totalCents = Math.max(formData.pounds * PRICE_PER_LB, 2000) // $20 minimum
  const totalDisplay = (totalCents / 100).toFixed(2)

  const handlePickupSelect = (date: Date) => {
    setFormData((p) => ({ ...p, pickupDate: date, deliveryDate: getEarliestDelivery(date) }))
  }

  const isPickupAvailable = (d: Date) => { const day = d.getDay(); return day === 1 || day === 2 || day === 3 }
  const isDeliveryAvailable = (d: Date) => {
    const day = d.getDay()
    if (day !== 1 && day !== 2 && day !== 3) return false
    if (formData.pickupDate) {
      const min = new Date(formData.pickupDate)
      min.setDate(min.getDate() + 3)
      min.setHours(0, 0, 0, 0)
      return d >= min
    }
    return true
  }

  const canStep1 = !!formData.pickupDate && !!formData.deliveryDate && !!formData.pickupTimeWindow && !!formData.deliveryTimeWindow
  const canStep2 = !!formData.name && !!formData.email && !!formData.phone && !!formData.address
  const canStep3 = formData.agreedToTerms && formData.smsConsent && formData.signature.trim().length > 0

  // ── Payment ──────────────────────────────────────────────────────────────
  if (step === "payment") {
    return (
      <Card className="shadow-lg border-0 ring-1 ring-gray-100">
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5">
            <h3 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide mb-3">Order Summary</h3>
            {[
              { label: "Service", value: "Wash & Fold" },
              { label: "Est. Weight", value: `~${formData.pounds} lbs` },
              { label: "Pickup", value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${TIME_WINDOWS.find(w => w.value === formData.pickupTimeWindow)?.label}` : "" },
              { label: "Delivery", value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${TIME_WINDOWS.find(w => w.value === formData.deliveryTimeWindow)?.label}` : "" },
              { label: "Address", value: formData.address },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400 shrink-0">{row.label}</span>
                <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
              </div>
            ))}
            <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
              <span className="text-[#0D2240]">Total (est.)</span>
              <span className="text-[#E8726A]">${totalDisplay}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Charged at $2.50/lb · $20 minimum. Final charge adjusted to actual weight after pickup.
            </p>
          </div>
          <Checkout
            productId="wash-fold"
            quantity={formData.pounds}
            metadata={{
              customerName: formData.name,
              customerEmail: formData.email,
              customerPhone: formData.phone,
              address: formData.address,
              pickupDate: formData.pickupDate?.toISOString() || "",
              deliveryDate: formData.deliveryDate?.toISOString() || "",
              pickupTimeWindow: formData.pickupTimeWindow,
              deliveryTimeWindow: formData.deliveryTimeWindow,
              signature: formData.signature,
              agreedToTerms: formData.agreedToTerms.toString(),
              smsConsent: formData.smsConsent.toString(),
              serviceType: "wash_fold",
              pounds: String(formData.pounds),
            }}
          />
          <button className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors" onClick={() => setStep(3)}>
            ← Back to review
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-0 ring-1 ring-gray-100">
      <CardContent className="pt-6">
        {/* Progress */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === s.id ? "bg-[#0D2240] text-white ring-4 ring-[#0D2240]/15"
                    : (step as number) > s.id ? "bg-[#E8726A] text-white" : "bg-gray-100 text-gray-400")}>
                  {(step as number) > s.id ? "✓" : s.id}
                </div>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide hidden sm:block",
                  step === s.id ? "text-[#0D2240]" : "text-gray-300")}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2 mb-4 transition-colors", (step as number) > s.id ? "bg-[#E8726A]" : "bg-gray-100")} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-7">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Estimate your laundry weight</h3>
              <p className="text-sm text-gray-400">$2.50/lb · $20 minimum · final charge adjusted to actual weight</p>
            </div>

            {/* Pounds slider + counter */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-6 py-1">
                <button type="button"
                  onClick={() => setFormData(p => ({ ...p, pounds: Math.max(MIN_POUNDS, p.pounds - 1) }))}
                  disabled={formData.pounds <= MIN_POUNDS}
                  className="w-11 h-11 rounded-full border-2 border-[#0D2240] text-[#0D2240] font-bold text-2xl flex items-center justify-center disabled:opacity-25 hover:bg-[#0D2240] hover:text-white transition-colors">
                  −
                </button>
                <div className="text-center min-w-[80px]">
                  <div className="text-5xl font-extrabold text-[#0D2240] leading-none tabular-nums">{formData.pounds}</div>
                  <div className="text-xs text-gray-400 mt-1">pounds (est.)</div>
                </div>
                <button type="button"
                  onClick={() => setFormData(p => ({ ...p, pounds: p.pounds + 1 }))}
                  className="w-11 h-11 rounded-full border-2 border-[#0D2240] text-[#0D2240] font-bold text-2xl flex items-center justify-center hover:bg-[#0D2240] hover:text-white transition-colors">
                  +
                </button>
              </div>

              {/* Quick-select common weights */}
              <div className="flex gap-2 justify-center flex-wrap">
                {[10, 15, 20, 25, 30].map((lb) => (
                  <button key={lb} type="button"
                    onClick={() => setFormData(p => ({ ...p, pounds: lb }))}
                    className={cn("px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all",
                      formData.pounds === lb
                        ? "bg-[#0D2240] border-[#0D2240] text-white"
                        : "border-gray-200 text-gray-500 hover:border-[#0D2240]")}>
                    {lb} lbs
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#fdf6f5] rounded-xl p-4 flex items-center justify-between">
              <div className="text-sm text-[#0D2240]/60">
                <span className="font-medium">{formData.pounds} lbs × $2.50</span>
                {formData.pounds < MIN_POUNDS && <span className="text-[#E8726A] ml-1.5">(min. $20)</span>}
              </div>
              <span className="text-2xl font-extrabold text-[#E8726A]">${totalDisplay}</span>
            </div>

            {/* Size guide */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1.5">
              <p className="font-semibold">Weight guide:</p>
              <p>Small load (~10 lbs): jeans + a few shirts + underwear</p>
              <p>Medium load (~15 lbs): a full week of clothes for one person</p>
              <p>Large load (~20-25 lbs): family laundry or bedding</p>
              <p className="text-blue-500 mt-1">Don&apos;t stress about exact weight — we&apos;ll weigh it at pickup and adjust.</p>
            </div>

            {/* Date selection */}
            <div className="space-y-6 border-t border-gray-100 pt-6">
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <h4 className="font-bold text-[#0D2240] text-sm">Pickup Date &amp; Time</h4>
                  <span className="text-xs text-gray-400">— Mon, Tue, Wed</span>
                </div>
                <DateStrip selected={formData.pickupDate} onSelect={handlePickupSelect} isAvailable={isPickupAvailable} />
                {formData.pickupDate && <TimeSlotPicker value={formData.pickupTimeWindow} onChange={(v) => setFormData(p => ({ ...p, pickupTimeWindow: v }))} />}
              </div>
              {formData.pickupDate && formData.pickupTimeWindow && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <h4 className="font-bold text-[#0D2240] text-sm">Delivery Date &amp; Time</h4>
                    <span className="text-xs text-gray-400">— 72hrs after pickup</span>
                  </div>
                  {formData.deliveryDate && (
                    <p className="text-xs text-[#E8726A] font-medium mb-3">
                      Suggested: {format(formData.deliveryDate, "EEE, MMM d")}
                    </p>
                  )}
                  <DateStrip selected={formData.deliveryDate} onSelect={(d) => setFormData(p => ({ ...p, deliveryDate: d }))} isAvailable={isDeliveryAvailable} />
                  {formData.deliveryDate && <TimeSlotPicker value={formData.deliveryTimeWindow} onChange={(v) => setFormData(p => ({ ...p, deliveryTimeWindow: v }))} />}
                </div>
              )}
            </div>

            <Button className="w-full h-12 text-base font-bold bg-[#0D2240] hover:bg-[#1a3a5c] mt-2"
              disabled={!canStep1} onClick={() => setStep(2)}>
              Continue: Your Info →
            </Button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Where should we go?</h3>
              <p className="text-sm text-gray-400">Pickup and delivery to the same address</p>
            </div>
            <div className="space-y-4">
              {[
                { label: "Full Name", key: "name", placeholder: "Jane Smith", type: "text" },
                { label: "Email", key: "email", placeholder: "jane@example.com", type: "email" },
                { label: "Phone", key: "phone", placeholder: "(407) 555-0100", type: "tel" },
                { label: "Pickup & Delivery Address", key: "address", placeholder: "123 Oak St, Orlando FL 32827", type: "text" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="font-semibold text-[#0D2240] text-sm">{label}</Label>
                  <Input type={type} placeholder={placeholder}
                    value={(formData as Record<string, unknown>)[key] as string}
                    onChange={(e) => setFormData(p => ({ ...p, [key]: e.target.value }))}
                    className="h-12 border-gray-200 focus:border-[#E8726A] text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(1)}>← Back</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canStep2} onClick={() => setStep(3)}>
                Continue: Confirm →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Almost done!</h3>
              <p className="text-sm text-gray-400">Review your order and sign below</p>
            </div>
            <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5 text-sm">
              {[
                { label: "Service", value: "Wash & Fold" },
                { label: "Est. Weight", value: `~${formData.pounds} lbs` },
                { label: "Pickup", value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${TIME_WINDOWS.find(w => w.value === formData.pickupTimeWindow)?.label}` : "" },
                { label: "Delivery", value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${TIME_WINDOWS.find(w => w.value === formData.deliveryTimeWindow)?.label}` : "" },
                { label: "Address", value: formData.address },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
                </div>
              ))}
              <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
                <span className="text-[#0D2240]">Estimated Total</span>
                <span className="text-[#E8726A]">${totalDisplay}</span>
              </div>
              <p className="text-[10px] text-gray-400">Final charge adjusted to actual weight after pickup.</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={formData.agreedToTerms}
                  onCheckedChange={(c) => setFormData(p => ({ ...p, agreedToTerms: c as boolean }))}
                  className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I understand the final charge will be based on actual weight and agree to the terms of service.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer bg-[#fdf6f5] rounded-xl p-3">
                <Checkbox checked={formData.smsConsent}
                  onCheckedChange={(c) => setFormData(p => ({ ...p, smsConsent: c as boolean }))}
                  className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  <strong>I consent to SMS &amp; email updates</strong> for pickup/delivery notifications.
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-[#0D2240] text-sm">Electronic Signature</Label>
              <Input placeholder="Type your full name to sign" value={formData.signature}
                onChange={(e) => setFormData(p => ({ ...p, signature: e.target.value }))}
                className="h-12 font-serif text-lg italic border-gray-200 focus:border-[#E8726A]" />
              <p className="text-xs text-gray-400">Typing your name constitutes a legal electronic signature.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(2)}>← Back</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canStep3} onClick={() => setStep("payment")}>
                Proceed to Payment →
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
