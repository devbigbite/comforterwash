"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { CalendarIcon, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import Checkout from "./checkout"
import { Checkbox } from "@/components/ui/checkbox"

const PRICE_PER_COMFORTER = 2900 // $29.00 in cents

const TIME_WINDOWS = [
  { value: "9am-1pm", label: "9:00 AM – 1:00 PM" },
  { value: "3pm-7pm", label: "3:00 PM – 7:00 PM" },
]

const STEPS = [
  { id: 1, label: "Service" },
  { id: 2, label: "Your Info" },
  { id: 3, label: "Confirm" },
]

/** Returns the earliest valid Mon/Tue/Wed that is ≥72h after the pickup date */
function getEarliestDelivery(pickup: Date): Date {
  const d = new Date(pickup)
  d.setHours(d.getHours() + 72)
  // Advance to next Mon/Tue/Wed (days 1, 2, 3)
  while ([0, 4, 5, 6].includes(d.getDay())) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

function isValidDeliveryDay(date: Date) {
  const day = date.getDay()
  return day === 1 || day === 2 || day === 3
}

export function BookingForm() {
  const [step, setStep] = useState<1 | 2 | 3 | "payment">(1)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    pickupDate: undefined as Date | undefined,
    deliveryDate: undefined as Date | undefined,
    pickupTimeWindow: "",
    deliveryTimeWindow: "",
    comforterCount: 1,
    signature: "",
    agreedToTerms: false,
    smsConsent: false,
  })

  const totalPrice = formData.comforterCount * PRICE_PER_COMFORTER
  const totalDisplay = (totalPrice / 100).toFixed(2)

  const handlePickupSelect = (date: Date | undefined) => {
    if (!date) return
    const suggestedDelivery = getEarliestDelivery(date)
    setFormData((prev) => ({ ...prev, pickupDate: date, deliveryDate: suggestedDelivery }))
  }

  const canProceedStep1 =
    !!formData.pickupDate &&
    !!formData.deliveryDate &&
    !!formData.pickupTimeWindow &&
    !!formData.deliveryTimeWindow

  const canProceedStep2 =
    !!formData.name && !!formData.email && !!formData.phone && !!formData.address

  const canProceedStep3 =
    formData.agreedToTerms && formData.smsConsent && formData.signature.trim().length > 0

  const handleProceedToPayment = () => {
    if (!formData.pickupDate || !formData.deliveryDate) return

    const dayOfWeek = formData.deliveryDate.getDay()
    if (dayOfWeek !== 1 && dayOfWeek !== 2 && dayOfWeek !== 3) {
      alert("Delivery is only available on Mondays, Tuesdays, and Wednesdays")
      return
    }
    const hoursDiff =
      (formData.deliveryDate.getTime() - formData.pickupDate.getTime()) / (1000 * 60 * 60)
    if (hoursDiff < 72) {
      alert("Delivery date must be at least 72 hours after pickup date")
      return
    }

    setStep("payment")
  }

  // ── Payment screen ──
  if (step === "payment") {
    return (
      <Card className="shadow-lg border-0 ring-1 ring-gray-100">
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-xl bg-[#f0f6ff] p-4 space-y-2.5">
            <h3 className="font-bold text-[#1e3a8a] text-sm uppercase tracking-wide mb-3">
              Booking Summary
            </h3>
            {[
              { label: "Name", value: formData.name },
              {
                label: "Pickup",
                value: formData.pickupDate
                  ? `${format(formData.pickupDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.pickupTimeWindow)?.label}`
                  : "",
              },
              {
                label: "Delivery",
                value: formData.deliveryDate
                  ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.deliveryTimeWindow)?.label}`
                  : "",
              },
              { label: "Address", value: formData.address },
              {
                label: "Comforters",
                value: `${formData.comforterCount} × $29.00`,
              },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400 shrink-0">{row.label}</span>
                <span className="font-medium text-[#1e3a8a] text-right">{row.value}</span>
              </div>
            ))}
            <div className="border-t border-[#1e3a8a]/10 pt-2.5 flex justify-between font-extrabold text-base">
              <span className="text-[#1e3a8a]">Total</span>
              <span className="text-[#1e3a8a]">${totalDisplay}</span>
            </div>
          </div>

          <Checkout
            productId="comforter-wash"
            quantity={formData.comforterCount}
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
            }}
          />
          <Button
            variant="ghost"
            className="w-full text-gray-400 hover:text-gray-600"
            onClick={() => setStep(3)}
          >
            ← Back to review
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Step wizard ──
  return (
    <Card className="shadow-lg border-0 ring-1 ring-gray-100">
      <CardContent className="pt-6">

        {/* Progress indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    step === s.id
                      ? "bg-[#1e3a8a] text-white ring-4 ring-[#1e3a8a]/20"
                      : (step as number) > s.id
                      ? "bg-[#67e8f9] text-[#1e3a8a]"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  {(step as number) > s.id ? "✓" : s.id}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide hidden sm:block",
                    step === s.id ? "text-[#1e3a8a]" : "text-gray-300"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 mb-4 transition-colors",
                    (step as number) > s.id ? "bg-[#67e8f9]" : "bg-gray-100"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Service Details ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-[#1e3a8a] mb-1">How many comforters?</h3>
              <p className="text-sm text-gray-400">$29 each · any size · free premium bag included</p>
            </div>

            {/* Counter */}
            <div className="flex items-center justify-center gap-6 py-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({ ...p, comforterCount: Math.max(1, p.comforterCount - 1) }))
                }
                disabled={formData.comforterCount <= 1}
                className="w-12 h-12 rounded-full border-2 border-[#1e3a8a] text-[#1e3a8a] font-bold text-2xl flex items-center justify-center disabled:opacity-25 hover:bg-[#1e3a8a] hover:text-white transition-colors"
                aria-label="Remove comforter"
              >
                −
              </button>
              <div className="text-center min-w-[80px]">
                <div className="text-6xl font-extrabold text-[#1e3a8a] leading-none tabular-nums">
                  {formData.comforterCount}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  comforter{formData.comforterCount > 1 ? "s" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({ ...p, comforterCount: p.comforterCount + 1 }))
                }
                className="w-12 h-12 rounded-full border-2 border-[#1e3a8a] text-[#1e3a8a] font-bold text-2xl flex items-center justify-center hover:bg-[#1e3a8a] hover:text-white transition-colors"
                aria-label="Add comforter"
              >
                +
              </button>
            </div>

            {/* Price display */}
            <div className="bg-[#f0f6ff] rounded-xl p-4 flex items-center justify-between">
              <span className="text-[#1e3a8a] font-semibold text-sm">
                {formData.comforterCount} × $29.00
              </span>
              <span className="text-2xl font-extrabold text-[#1e3a8a]">${totalDisplay}</span>
            </div>

            {/* Care label info — collapsed by default, no friction */}
            <details className="group">
              <summary className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#1e3a8a] transition-colors cursor-pointer list-none">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">What types of comforters can we wash?</span>
                <span className="ml-auto text-xs text-gray-300">tap to expand</span>
              </summary>
              <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm space-y-2">
                <p className="font-semibold text-amber-700">Quick check: look at your care label.</p>
                <p className="text-amber-600 text-xs leading-relaxed">
                  We wash in cold/warm water and tumble dry. We <strong>cannot</strong> process items
                  labeled "Do Not Tumble Dry," "Hang Dry," or "Dry Clean Only," weighted comforters,
                  fuzzy comforters, or featherbeds. Every comforter must have a care label.
                </p>
              </div>
            </details>

            {/* Dates */}
            <div className="space-y-4 pt-2">
              {/* Pickup date */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">
                  Pickup Date
                  <span className="ml-1.5 text-gray-400 font-normal text-xs">Mon–Wed only</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal h-12 border-gray-200 hover:border-[#1e3a8a] transition-colors text-sm",
                        !formData.pickupDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[#1e3a8a]" />
                      {formData.pickupDate
                        ? format(formData.pickupDate, "EEEE, MMMM d")
                        : "Choose pickup date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.pickupDate}
                      onSelect={handlePickupSelect}
                      disabled={(date) => {
                        if (date < new Date()) return true
                        const d = date.getDay()
                        return d !== 1 && d !== 2 && d !== 3
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Pickup time */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">Pickup Time</Label>
                <Select
                  value={formData.pickupTimeWindow}
                  onValueChange={(v) => setFormData((p) => ({ ...p, pickupTimeWindow: v }))}
                >
                  <SelectTrigger className="h-12 border-gray-200 hover:border-[#1e3a8a] text-sm">
                    <SelectValue placeholder="Choose time window" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_WINDOWS.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery date */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">
                  Delivery Date
                  <span className="ml-1.5 text-gray-400 font-normal text-xs">
                    Mon–Wed · 72hrs after pickup
                  </span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal h-12 border-gray-200 hover:border-[#1e3a8a] transition-colors text-sm",
                        !formData.deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[#1e3a8a]" />
                      {formData.deliveryDate
                        ? format(formData.deliveryDate, "EEEE, MMMM d")
                        : "Choose delivery date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.deliveryDate}
                      onSelect={(date) => setFormData((p) => ({ ...p, deliveryDate: date }))}
                      disabled={(date) => {
                        if (date < new Date()) return true
                        if (!isValidDeliveryDay(date)) return true
                        if (formData.pickupDate) {
                          const min = new Date(formData.pickupDate)
                          min.setHours(min.getHours() + 72)
                          return date < min
                        }
                        return false
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {formData.pickupDate && formData.deliveryDate && (
                  <p className="text-xs text-[#67e8f9] font-medium">
                    ✓ Delivery auto-suggested based on your pickup date
                  </p>
                )}
              </div>

              {/* Delivery time */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">Delivery Time</Label>
                <Select
                  value={formData.deliveryTimeWindow}
                  onValueChange={(v) => setFormData((p) => ({ ...p, deliveryTimeWindow: v }))}
                >
                  <SelectTrigger className="h-12 border-gray-200 hover:border-[#1e3a8a] text-sm">
                    <SelectValue placeholder="Choose time window" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_WINDOWS.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-bold bg-[#1e3a8a] hover:bg-[#1d4ed8] mt-2"
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
            >
              Continue: Your Info →
            </Button>
          </div>
        )}

        {/* ── STEP 2: Contact Info ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#1e3a8a] mb-1">Where should we go?</h3>
              <p className="text-sm text-gray-400">Pickup and delivery to the same address</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">Full Name</Label>
                <Input
                  placeholder="Jane Smith"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="h-12 border-gray-200 focus:border-[#1e3a8a] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">Email</Label>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="h-12 border-gray-200 focus:border-[#1e3a8a] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">Phone</Label>
                <Input
                  type="tel"
                  placeholder="(407) 555-0100"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="h-12 border-gray-200 focus:border-[#1e3a8a] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-[#1e3a8a] text-sm">
                  Pickup &amp; Delivery Address
                </Label>
                <Input
                  placeholder="123 Oak Street, Orlando FL 32801"
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  className="h-12 border-gray-200 focus:border-[#1e3a8a] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button
                className="flex-[2] h-12 text-sm font-bold bg-[#1e3a8a] hover:bg-[#1d4ed8]"
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
              >
                Continue: Confirm →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm & Sign ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#1e3a8a] mb-1">Almost done!</h3>
              <p className="text-sm text-gray-400">Review your booking and sign below</p>
            </div>

            {/* Summary card */}
            <div className="rounded-xl bg-[#f0f6ff] p-4 space-y-2.5 text-sm">
              {[
                {
                  label: "Pickup",
                  value: formData.pickupDate
                    ? `${format(formData.pickupDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.pickupTimeWindow)?.label}`
                    : "",
                },
                {
                  label: "Delivery",
                  value: formData.deliveryDate
                    ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.deliveryTimeWindow)?.label}`
                    : "",
                },
                { label: "Address", value: formData.address },
                { label: "Comforters", value: `${formData.comforterCount} × $29.00` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className="font-medium text-[#1e3a8a] text-right">{row.value}</span>
                </div>
              ))}
              <div className="border-t border-[#1e3a8a]/10 pt-2.5 flex justify-between font-extrabold text-base">
                <span className="text-[#1e3a8a]">Total</span>
                <span className="text-[#1e3a8a]">${totalDisplay}</span>
              </div>
            </div>

            {/* Conditions — collapsed by default */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-[#1e3a8a] bg-gray-50 rounded-xl px-4 py-3 hover:bg-[#f0f6ff] transition-colors list-none">
                <span>📋 Conditions of Service</span>
                <span className="text-gray-400 text-xs font-normal">tap to read</span>
              </summary>
              <div className="mt-2 rounded-xl border border-gray-100 bg-white p-4 max-h-52 overflow-y-auto text-xs text-gray-500 space-y-2.5 leading-relaxed">
                <p>
                  <strong>CONDITIONS:</strong> We exercise utmost care in processing articles entrusted
                  to us and use such processes which, in our opinion, are best suited to the nature and
                  condition of each individual article. Nevertheless, we cannot assume responsibility for
                  inherent weaknesses of or defects in materials that are not readily apparent or
                  identifiable prior to processing.
                </p>
                <p>
                  Any visible stain will be pre-treated, but that is not a guarantee that any stain,
                  dirt or blemish will be removed. Responsibility also is disclaimed for trimmings,
                  buckles, beads, buttons, bells and sequins. In laundering we cannot guarantee against
                  color loss and shrinkage, or against damage to weak and tender fabrics. Any claim must
                  be reported and presented within 48 hours. Unless a list accompanied the bundle, our
                  count must be accepted. The company&apos;s liability with respect to any lost or
                  damaged article shall not exceed 5 times our charge for processing it. We are not
                  responsible for unclaimed items within 72 hours of willful and clear effort to deliver
                  the item(s) back to the owner.
                </p>
                <p>
                  We will send applicable reminders and information regarding processing through SMS and
                  Email.
                </p>
              </div>
            </details>

            {/* Agreements */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <Checkbox
                  checked={formData.agreedToTerms}
                  onCheckedChange={(c) =>
                    setFormData((p) => ({ ...p, agreedToTerms: c as boolean }))
                  }
                  className="mt-0.5 shrink-0"
                />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I have read and agree to all Conditions of Service.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer bg-[#f0f6ff] rounded-xl p-3">
                <Checkbox
                  checked={formData.smsConsent}
                  onCheckedChange={(c) =>
                    setFormData((p) => ({ ...p, smsConsent: c as boolean }))
                  }
                  className="mt-0.5 shrink-0"
                />
                <span className="text-sm text-gray-600 leading-relaxed">
                  <strong>I consent to SMS &amp; email updates</strong> for pickup/delivery
                  notifications and service reminders at the contact info I provided.
                </span>
              </label>
            </div>

            {/* Signature */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-[#1e3a8a] text-sm">Electronic Signature</Label>
              <Input
                placeholder="Type your full name to sign"
                value={formData.signature}
                onChange={(e) => setFormData((p) => ({ ...p, signature: e.target.value }))}
                className="h-12 font-serif text-lg italic border-gray-200 focus:border-[#1e3a8a]"
              />
              <p className="text-xs text-gray-400">
                Typing your name constitutes a legal electronic signature.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button
                className="flex-[2] h-12 text-sm font-bold bg-[#1e3a8a] hover:bg-[#1d4ed8]"
                disabled={!canProceedStep3}
                onClick={handleProceedToPayment}
              >
                Proceed to Payment →
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
