"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import Checkout from "./checkout"
import { Checkbox } from "@/components/ui/checkbox"
import { PromoCodeField } from "./promo-code-field"
import { useLang } from "@/components/lang-provider"

const COMFORTER_SIZES = [
  { id: "twin",  label: "Twin",  note: "Up to 50\"×70\"",  cents: 2900 },
  { id: "full",  label: "Full",  note: "Up to 54\"×75\"",  cents: 3300 },
  { id: "queen", label: "Queen", note: "Up to 60\"×80\"",  cents: 3800 },
  { id: "king",  label: "King",  note: "Up to 108\"×90\"", cents: 4300 },
]

const TIME_WINDOWS = [
  { value: "9am-1pm", label: "9am – 1pm" },
  { value: "3pm-7pm", label: "3pm – 7pm" },
]

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

const DETERGENT_OPTS = [
  { id: "standard",       labelKey: "standard" as const,        noteKey: "stdNote" as const },
  { id: "tide",           label: "Tide",                         note: "Popular choice" },
  { id: "gain",           label: "Gain",                         note: "Fresh floral scent" },
  { id: "fragrance_free", label: "Fragrance-Free / Hypoallergenic", note: "Great for sensitive skin" },
]

function getEarliestDelivery(pickup: Date): Date {
  const d = new Date(pickup)
  d.setDate(d.getDate() + 3)
  while ([0, 4, 5, 6].includes(d.getDay())) d.setDate(d.getDate() + 1)
  return d
}

function DateStrip({
  label, sublabel, selected, onSelect, isAvailable, tomorrow,
}: {
  label: string
  sublabel?: string
  selected: Date | undefined
  onSelect: (d: Date) => void
  isAvailable: (d: Date) => boolean
  tomorrow: string
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i + 1)
    return d
  })

  function isSameDay(a: Date, b: Date) {
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  }

  function dayHint(d: Date) {
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    return diff === 1 ? tomorrow : ""
  }

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-bold text-[#0D2240] text-sm">{label}</span>
        {sublabel && <span className="text-xs text-gray-400">{sublabel}</span>}
      </div>
      <div className="overflow-x-auto pb-1 -mx-1 scrollbar-thin">
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
                  sel
                    ? "bg-[#E8726A] border-[#E8726A] text-white shadow-md"
                    : avail
                    ? "bg-white border-gray-200 text-[#0D2240] hover:border-[#E8726A] hover:shadow-sm cursor-pointer"
                    : "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                )}
              >
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", sel ? "text-white/80" : avail ? "text-gray-400" : "text-gray-300")}>
                  {DAY_ABBR[d.getDay()]}
                </span>
                <span className={cn("text-xl font-extrabold leading-tight my-0.5", sel ? "text-white" : avail ? "text-[#0D2240]" : "text-gray-300")}>
                  {d.getDate()}
                </span>
                <span className={cn("text-[10px] font-bold uppercase", sel ? "text-white/70" : avail ? "text-gray-400" : "text-gray-300")}>
                  {MON_ABBR[d.getMonth()]}
                </span>
                {hint && (
                  <span className={cn("text-[9px] mt-0.5 font-medium", sel ? "text-white/60" : "text-[#E8726A]")}>
                    {hint}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TimeSlotPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <p className="text-xs text-center text-gray-400 mb-3 mt-4">{label}</p>
      <div className="flex gap-2 justify-center flex-wrap">
        {TIME_WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => onChange(w.value)}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              value === w.value
                ? "bg-[#E8726A] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BookingForm() {
  const { translations: tr } = useLang()
  const tf = tr.form
  const tb = tr.bookingForm

  const STEPS = [
    { id: 1, label: tf.stepService },
    { id: 2, label: tf.stepAddOns },
    { id: 3, label: tf.stepYourInfo },
    { id: 4, label: tf.stepConfirm },
  ]

  const DETERGENT_OPTIONS = [
    { id: "standard",       label: tf.standard,                        note: "Included · fresh-scented" },
    { id: "tide",           label: "Tide",                              note: "Popular choice" },
    { id: "gain",           label: "Gain",                              note: "Fresh floral scent" },
    { id: "fragrance_free", label: "Fragrance-Free / Hypoallergenic",   note: "Great for sensitive skin" },
  ]

  const [step, setStep] = useState<1 | 2 | 3 | 4 | "payment">(1)
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    import("@/app/actions/holidays").then(m => m.getExcludedDates()).then(dates => {
      setExcludedDates(new Set(dates))
    })
  }, [])

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
    comforterSize: "queen",
    numBags: 1,
    detergent: "standard",
    fabricSoftener: false,
    oxiClean: false,
    signature: "",
    agreedToTerms: false,
    smsConsent: false,
  })

  const [promo, setPromo] = useState<{ code: string; discountCents: number } | null>(null)

  const sizeOption = COMFORTER_SIZES.find(s => s.id === formData.comforterSize) ?? COMFORTER_SIZES[2]
  const subtotal = formData.comforterCount * sizeOption.cents
  const discountCents = promo?.discountCents ?? 0
  const totalPrice = Math.max(0, subtotal - discountCents)
  const totalDisplay = (totalPrice / 100).toFixed(2)
  const pricePerDisplay = (sizeOption.cents / 100).toFixed(2)

  const handlePickupSelect = (date: Date) => {
    const suggested = getEarliestDelivery(date)
    setFormData((p) => ({ ...p, pickupDate: date, deliveryDate: suggested, deliveryTimeWindow: p.deliveryTimeWindow }))
  }

  const isExcluded = (d: Date) => {
    const str = d.toISOString().split("T")[0]
    return excludedDates.has(str)
  }

  const isPickupAvailable = (d: Date) => {
    if (isExcluded(d)) return false
    const day = d.getDay()
    return day === 1 || day === 2 || day === 3
  }

  const isDeliveryAvailable = (d: Date) => {
    if (isExcluded(d)) return false
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

  const canProceedStep1 =
    !!formData.pickupDate && !!formData.deliveryDate &&
    !!formData.pickupTimeWindow && !!formData.deliveryTimeWindow

  const canProceedStep3 =
    !!formData.name && !!formData.email && !!formData.phone && !!formData.address

  const canProceedStep4 =
    formData.agreedToTerms && formData.smsConsent && formData.signature.trim().length > 0

  const addOnsSummary = [
    formData.detergent !== "standard" ? DETERGENT_OPTIONS.find(d => d.id === formData.detergent)?.label : null,
    formData.fabricSoftener ? tf.fabricSoftenerLabel : null,
    formData.oxiClean ? tf.oxiCleanLabel : null,
  ].filter(Boolean).join(", ") || tf.standard

  const CONTACT_FIELDS = [
    { label: tf.fullName,             key: "name",    placeholder: "Jane Smith",                         type: "text" },
    { label: tf.email,                key: "email",   placeholder: "jane@example.com",                   type: "email" },
    { label: tf.phone,                key: "phone",   placeholder: "(407) 555-0100",                     type: "tel" },
    { label: tf.pickupDeliveryAddress, key: "address", placeholder: "123 Oak St, Orlando FL 32827",      type: "text" },
  ]

  // ── Payment screen ──────────────────────────────────────────────────────
  if (step === "payment") {
    return (
      <Card className="shadow-lg border-0 ring-1 ring-gray-100">
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5">
            <h3 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide mb-3">{tb.bookingSummary}</h3>
            {[
              { label: tf.labelName,      value: formData.name },
              { label: tf.labelPickup,    value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.pickupTimeWindow)?.label}` : "" },
              { label: tf.labelDelivery,  value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.deliveryTimeWindow)?.label}` : "" },
              { label: tf.labelAddress,   value: formData.address },
              { label: tb.labelComforters, value: `${formData.comforterCount} × $${pricePerDisplay} (${sizeOption.label})` },
              { label: tf.labelBags,      value: `${formData.numBags} ${formData.numBags > 1 ? tf.bags : tf.bag}` },
              { label: tf.labelAddOns,    value: addOnsSummary },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400 shrink-0">{row.label}</span>
                <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
              </div>
            ))}
            <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
              <span className="text-[#0D2240]">{tf.total}</span>
              <span className="text-[#E8726A]">${totalDisplay}</span>
            </div>
          </div>

          <Checkout
            amountCents={totalPrice}
            label={`Comforter Wash × ${formData.comforterCount} (${sizeOption.label})`}
            manualCapture={false}
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
              serviceType: "comforter_wash",
              numComforters: String(formData.comforterCount),
              numBags: String(formData.comforterCount),
              comforterSize: formData.comforterSize,
              detergent: formData.detergent,
              fabricSoftener: formData.fabricSoftener.toString(),
              oxiClean: formData.oxiClean.toString(),
              promoCode: promo?.code ?? "",
              promoDiscountCents: String(promo?.discountCents ?? 0),
            }}
          />
          <button
            className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
            onClick={() => setStep(4)}
          >
            {tf.backToReview}
          </button>
        </CardContent>
      </Card>
    )
  }

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
                      ? "bg-[#0D2240] text-white ring-4 ring-[#0D2240]/15"
                      : (step as number) > s.id
                      ? "bg-[#E8726A] text-white"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  {(step as number) > s.id ? "✓" : s.id}
                </div>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide hidden sm:block",
                  step === s.id ? "text-[#0D2240]" : "text-gray-300")}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2 mb-4 transition-colors",
                  (step as number) > s.id ? "bg-[#E8726A]" : "bg-gray-100")} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Service + Dates ── */}
        {step === 1 && (
          <div className="space-y-7">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tb.selectSize}</h3>
              <p className="text-sm text-gray-400">{tb.selectSizeNote}</p>
            </div>

            {/* Size selector */}
            <div className="grid grid-cols-2 gap-2.5">
              {COMFORTER_SIZES.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => setFormData(p => ({ ...p, comforterSize: s.id }))}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-2xl border-2 transition-all text-left",
                    formData.comforterSize === s.id
                      ? "border-[#E8726A] bg-[#fdf6f3]"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}>
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={cn("font-extrabold text-sm", formData.comforterSize === s.id ? "text-[#0D2240]" : "text-gray-700")}>{s.label}</span>
                    <span className={cn("font-extrabold text-sm", formData.comforterSize === s.id ? "text-[#E8726A]" : "text-gray-400")}>${(s.cents / 100).toFixed(0)}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{s.note}</span>
                </button>
              ))}
            </div>

            {/* Counter */}
            <div>
              <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">
                {tb.howManyComforters} {sizeOption.label} {formData.comforterCount > 1 ? tb.comfortersSuffix : tb.comforterSuffix}?
              </p>
              <div className="flex items-center justify-center gap-6 py-1">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, comforterCount: Math.max(1, p.comforterCount - 1), numBags: Math.max(1, p.comforterCount - 1) }))}
                  disabled={formData.comforterCount <= 1}
                  className="w-11 h-11 rounded-full border-2 border-[#0D2240] text-[#0D2240] font-bold text-2xl flex items-center justify-center disabled:opacity-25 hover:bg-[#0D2240] hover:text-white transition-colors"
                >
                  −
                </button>
                <div className="text-center min-w-[70px]">
                  <div className="text-5xl font-extrabold text-[#0D2240] leading-none tabular-nums">
                    {formData.comforterCount}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formData.comforterCount > 1 ? tb.comfortersSuffix : tb.comforterSuffix}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, comforterCount: p.comforterCount + 1, numBags: p.comforterCount + 1 }))}
                  className="w-11 h-11 rounded-full border-2 border-[#0D2240] text-[#0D2240] font-bold text-2xl flex items-center justify-center hover:bg-[#0D2240] hover:text-white transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="bg-[#fdf6f5] rounded-xl p-4 flex items-center justify-between">
              <span className="text-[#0D2240]/60 font-medium text-sm">{formData.comforterCount} × ${pricePerDisplay} ({sizeOption.label})</span>
              <span className="text-2xl font-extrabold text-[#E8726A]">${totalDisplay}</span>
            </div>

            {/* Care label note */}
            <details className="group">
              <summary className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#0D2240] transition-colors cursor-pointer list-none">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{tb.careTitle}</span>
                <span className="ml-auto text-xs text-gray-300 group-open:hidden">{tb.careTap}</span>
              </summary>
              <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-700 leading-relaxed space-y-1.5">
                <p className="font-semibold">{tb.careWarningTitle}</p>
                <p>{tb.careWarningText}</p>
              </div>
            </details>

            <div className="space-y-6 border-t border-gray-100 pt-6">
              {/* Pickup section */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <h4 className="font-bold text-[#0D2240] text-sm">{tb.pickupDateTitle}</h4>
                  <span className="text-xs text-gray-400">— {tb.pickupDaysNote}</span>
                </div>
                <p className="text-xs text-gray-400 mb-4 ml-6.5">{tb.pickupWhen}</p>
                <DateStrip
                  label=""
                  selected={formData.pickupDate}
                  onSelect={handlePickupSelect}
                  isAvailable={isPickupAvailable}
                  tomorrow={tf.tomorrow}
                />
                {formData.pickupDate && (
                  <TimeSlotPicker
                    label={tf.availableTimeSlots}
                    value={formData.pickupTimeWindow}
                    onChange={(v) => setFormData((p) => ({ ...p, pickupTimeWindow: v }))}
                  />
                )}
              </div>

              {/* Delivery section */}
              {formData.pickupDate && formData.pickupTimeWindow && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <h4 className="font-bold text-[#0D2240] text-sm">{tb.deliveryDateTitle}</h4>
                    <span className="text-xs text-gray-400">— {tb.deliveryGapNote}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    {tb.deliveryWhen}
                    {formData.deliveryDate && (
                      <span className="text-[#E8726A] font-medium ml-1">
                        ({tb.deliverySuggested} {format(formData.deliveryDate, "EEE, MMM d")})
                      </span>
                    )}
                  </p>
                  <DateStrip
                    label=""
                    selected={formData.deliveryDate}
                    onSelect={(d) => setFormData((p) => ({ ...p, deliveryDate: d }))}
                    isAvailable={isDeliveryAvailable}
                    tomorrow={tf.tomorrow}
                  />
                  {formData.deliveryDate && (
                    <TimeSlotPicker
                      label={tf.availableTimeSlots}
                      value={formData.deliveryTimeWindow}
                      onChange={(v) => setFormData((p) => ({ ...p, deliveryTimeWindow: v }))}
                    />
                  )}
                </div>
              )}
            </div>

            <Button
              className="w-full h-12 text-base font-bold bg-[#0D2240] hover:bg-[#1a3a5c] mt-2"
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
            >
              {tf.continueAddOns}
            </Button>
          </div>
        )}

        {/* ── STEP 2: Add-Ons ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tb.customizeWash}</h3>
              <p className="text-sm text-gray-400">{tb.addOnsOptional}</p>
            </div>

            {/* Detergent choice */}
            <div>
              <h4 className="font-bold text-[#0D2240] text-sm mb-3">{tf.detergentPreference}</h4>
              <div className="space-y-2">
                {DETERGENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      formData.detergent === opt.id
                        ? "border-[#E8726A] bg-[#fdf6f3]"
                        : "border-gray-100 bg-white hover:border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      formData.detergent === opt.id ? "border-[#E8726A] bg-[#E8726A]" : "border-gray-300"
                    )}>
                      {formData.detergent === opt.id && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <input
                      type="radio"
                      className="sr-only"
                      name="detergent"
                      value={opt.id}
                      checked={formData.detergent === opt.id}
                      onChange={() => setFormData(p => ({ ...p, detergent: opt.id }))}
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-[#0D2240] text-sm">{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.note}</p>
                    </div>
                    {opt.id === "standard" && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{tf.freeBadge}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Treatment add-ons */}
            <div>
              <h4 className="font-bold text-[#0D2240] text-sm mb-3">{tf.treatmentAddOns}</h4>
              <div className="space-y-2">
                {[
                  { key: "fabricSoftener" as const, label: tf.fabricSoftenerLabel, desc: tf.fabricSoftenerComforterDesc, icon: "🌸" },
                  { key: "oxiClean"       as const, label: tf.oxiCleanLabel,        desc: tf.oxiCleanDesc,                icon: "✨" },
                ].map((addon) => (
                  <label
                    key={addon.key}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      formData[addon.key]
                        ? "border-[#E8726A] bg-[#fdf6f3]"
                        : "border-gray-100 bg-white hover:border-gray-200"
                    )}
                  >
                    <Checkbox
                      checked={formData[addon.key]}
                      onCheckedChange={(c) => setFormData(p => ({ ...p, [addon.key]: c as boolean }))}
                      className="shrink-0"
                    />
                    <span className="text-xl shrink-0">{addon.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-[#0D2240] text-sm">{addon.label}</p>
                      <p className="text-xs text-gray-400">{addon.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(1)}>{tf.back}</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]" onClick={() => setStep(3)}>
                {tf.continueYourInfo}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Contact Info ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tf.whereToGo}</h3>
              <p className="text-sm text-gray-400">{tf.sameAddressNote}</p>
            </div>

            <div className="space-y-4">
              {CONTACT_FIELDS.map(({ label, key, placeholder, type }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="font-semibold text-[#0D2240] text-sm">{label}</Label>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    value={(formData as Record<string, unknown>)[key] as string}
                    onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
                    className="h-12 border-gray-200 focus:border-[#E8726A] text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(2)}>{tf.back}</Button>
              <Button
                className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canProceedStep3}
                onClick={() => setStep(4)}
              >
                {tf.continueConfirm}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm & Sign ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tf.almostDone}</h3>
              <p className="text-sm text-gray-400">{tf.reviewAndSign}</p>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5 text-sm">
              {[
                { label: tf.labelPickup,   value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.pickupTimeWindow)?.label}` : "" },
                { label: tf.labelDelivery, value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${TIME_WINDOWS.find((w) => w.value === formData.deliveryTimeWindow)?.label}` : "" },
                { label: tf.labelAddress,  value: formData.address },
                { label: tb.labelComforters, value: `${formData.comforterCount} × $${pricePerDisplay} (${sizeOption.label})` },
                { label: tf.labelAddOns,   value: addOnsSummary },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
                </div>
              ))}
              {discountCents > 0 && (
                <div className="flex justify-between gap-4 text-green-600">
                  <span className="shrink-0">{tf.promo} ({promo!.code})</span>
                  <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
                <span className="text-[#0D2240]">{tf.total}</span>
                <span className="text-[#E8726A]">${totalDisplay}</span>
              </div>
            </div>

            {/* Promo code */}
            <PromoCodeField
              serviceType="comforter_wash"
              subtotalCents={subtotal}
              onApply={(code, discountCents) => setPromo({ code, discountCents })}
              onRemove={() => setPromo(null)}
            />

            {/* Conditions */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-[#0D2240] bg-gray-50 rounded-xl px-4 py-3 hover:bg-[#fdf6f5] transition-colors list-none">
                <span>📋 {tf.conditionsTitle}</span>
                <span className="text-gray-400 text-xs font-normal">{tf.conditionsTap}</span>
              </summary>
              <div className="mt-2 rounded-xl border border-gray-100 bg-white p-4 max-h-48 overflow-y-auto text-xs text-gray-500 space-y-2.5 leading-relaxed">
                <p><strong>CONDITIONS:</strong> {tf.conditionsText1}</p>
                <p>{tf.conditionsText2}</p>
                <p>{tf.conditionsText3}</p>
              </div>
            </details>

            {/* Agreements */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={formData.agreedToTerms}
                  onCheckedChange={(c) => setFormData((p) => ({ ...p, agreedToTerms: c as boolean }))}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-sm text-gray-600 leading-relaxed">
                  {tf.agreeTerms}
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer bg-[#fdf6f5] rounded-xl p-3">
                <Checkbox
                  checked={formData.smsConsent}
                  onCheckedChange={(c) => setFormData((p) => ({ ...p, smsConsent: c as boolean }))}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-sm text-gray-600 leading-relaxed">
                  <strong>{tf.smsConsentBold}</strong>{tf.smsConsentSuffix}
                </span>
              </label>
            </div>

            {/* Signature */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-[#0D2240] text-sm">{tf.signatureLabel}</Label>
              <Input
                placeholder={tf.signaturePlaceholder}
                value={formData.signature}
                onChange={(e) => setFormData((p) => ({ ...p, signature: e.target.value }))}
                className="h-12 font-serif text-lg italic border-gray-200 focus:border-[#E8726A]"
              />
              <p className="text-xs text-gray-400">{tf.signatureNote}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(3)}>{tf.back}</Button>
              <Button
                className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canProceedStep4}
                onClick={() => setStep("payment")}
              >
                {tf.proceedToPayment}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
