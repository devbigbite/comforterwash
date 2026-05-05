"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import Checkout from "./checkout"
import { Checkbox } from "@/components/ui/checkbox"
import { PromoCodeField } from "@/components/promo-code-field"
import { getExcludedDates } from "@/app/actions/holidays"

// ─── constants ───────────────────────────────────────────────────────────────
const MIN_POUNDS = 20
const LBS_PER_BAG = 15

const FREQUENCY_PRICING: Record<string, { cents: number; label: string }> = {
  one_time: { cents: 250, label: "$2.50/lb" },
  weekly:   { cents: 225, label: "$2.25/lb" },
  biweekly: { cents: 225, label: "$2.25/lb" },
}

function bagsToEstLbs(bags: number) {
  return Math.max(bags * LBS_PER_BAG, MIN_POUNDS)
}

const TIME_WINDOWS = [
  { value: "9am-1pm", label: "9am – 1pm" },
  { value: "3pm-7pm", label: "3pm – 7pm" },
]

const STEPS = [
  { id: 1, label: "Service" },
  { id: 2, label: "Add-Ons" },
  { id: 3, label: "Your Info" },
  { id: 4, label: "Confirm" },
]

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

const DETERGENT_OPTIONS = [
  { id: "standard",       label: "Our Standard Detergent",        note: "Included · fresh-scented" },
  { id: "tide",           label: "Tide",                           note: "Popular choice" },
  { id: "gain",           label: "Gain",                           note: "Fresh floral scent" },
  { id: "fragrance_free", label: "Fragrance-Free / Hypoallergenic", note: "Great for sensitive skin" },
]

// ─── weekday schedule helpers ────────────────────────────────────────────────
const WEEKDAYS = [
  { id: "monday",    label: "Monday",    short: "Mon", num: 1 },
  { id: "tuesday",   label: "Tuesday",   short: "Tue", num: 2 },
  { id: "wednesday", label: "Wednesday", short: "Wed", num: 3 },
  { id: "thursday",  label: "Thursday",  short: "Thu", num: 4 },
  { id: "friday",    label: "Friday",    short: "Fri", num: 5 },
]

/** Returns weekday IDs that are valid delivery days given a pickup day.
 *  Rules: ≥ 3 calendar-day gap (Friday pickups require ≥ 5 days → Wednesday+). */
function getValidDeliveryDays(pickupDayId: string): string[] {
  const pickup = WEEKDAYS.find(d => d.id === pickupDayId)
  if (!pickup) return []
  const minGap = pickupDayId === "friday" ? 5 : 3
  return WEEKDAYS.filter(d => {
    const gap = d.num > pickup.num ? d.num - pickup.num : 7 - pickup.num + d.num
    return gap >= minGap
  }).map(d => d.id)
}

/** Returns the next calendar date (from tomorrow) for a given weekday ID. */
function nextOccurrence(dayId: string, after?: Date): Date {
  const dayNums: Record<string, number> = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5
  }
  const target = dayNums[dayId]
  const base = after ? new Date(after) : new Date()
  base.setHours(0, 0, 0, 0)
  // getDay(): 0=Sun,1=Mon...6=Sat; convert to Mon=1..Fri=5,Sun=0,Sat=6
  const todayNum = base.getDay()
  let diff = target - todayNum
  if (diff <= 0) diff += 7
  const result = new Date(base)
  result.setDate(base.getDate() + diff)
  return result
}

/** First delivery date for a recurring schedule, respecting the minimum gap. */
function firstDeliveryDate(pickupDate: Date, deliveryDayId: string, pickupDayId: string): Date {
  const minGap = pickupDayId === "friday" ? 5 : 3
  const earliest = new Date(pickupDate)
  earliest.setDate(earliest.getDate() + minGap)
  // Find the next occurrence of deliveryDayId that is >= earliest
  const candidate = nextOccurrence(deliveryDayId, new Date(pickupDate))
  return candidate >= earliest ? candidate : nextOccurrence(deliveryDayId, earliest)
}

// ─── sub-components ──────────────────────────────────────────────────────────
function DateStrip({
  selected, onSelect, isAvailable,
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
            <button key={i} type="button" disabled={!avail} onClick={() => onSelect(d)}
              className={cn(
                "flex flex-col items-center justify-center w-[62px] rounded-2xl border-2 py-2.5 transition-all shrink-0",
                sel ? "bg-[#E8726A] border-[#E8726A] text-white shadow-md"
                  : avail ? "bg-white border-gray-200 text-[#0D2240] hover:border-[#E8726A] hover:shadow-sm cursor-pointer"
                  : "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
              )}>
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
          <button key={w.value} type="button" onClick={() => onChange(w.value)}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              value === w.value ? "bg-[#E8726A] text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}>
            {w.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function WeekdayPicker({
  label, value, available, onChange, note,
}: {
  label: string
  value: string
  available: string[]
  onChange: (id: string) => void
  note?: string
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {WEEKDAYS.map(d => {
          const isAvail = available.includes(d.id)
          const isSel   = value === d.id
          return (
            <button key={d.id} type="button" disabled={!isAvail} onClick={() => onChange(d.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all",
                isSel   ? "bg-[#E8726A] border-[#E8726A] text-white shadow-sm"
                : isAvail ? "bg-white border-gray-200 text-[#0D2240] hover:border-[#E8726A]"
                : "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
              )}>
              {d.short}
            </button>
          )
        })}
      </div>
      {note && <p className="text-[10px] text-gray-400 mt-1.5">{note}</p>}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export function WashFoldForm() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | "payment">(1)
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", address: "",
    // one-time dates
    pickupDate:          undefined as Date | undefined,
    deliveryDate:        undefined as Date | undefined,
    pickupTimeWindow:    "",
    deliveryTimeWindow:  "",
    // recurring schedule
    recurringPickupDay:      "",
    recurringPickupTime:     "",
    recurringDeliveryDay:    "",
    recurringDeliveryTime:   "",
    // shared
    numBags:     2,
    pounds:      bagsToEstLbs(2),
    frequency:   "one_time" as "one_time" | "weekly" | "biweekly",
    detergent:   "standard",
    fabricSoftener:   false,
    oxiClean:         false,
    colorSafeBleach:  false,
    signature:        "",
    agreedToTerms:    false,
    smsConsent:       false,
  })

  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set())
  const [promo, setPromo] = useState<{ code: string; discountCents: number } | null>(null)

  useEffect(() => {
    getExcludedDates().then(dates => setExcludedDates(new Set(dates)))
  }, [])

  const isRecurring  = formData.frequency !== "one_time"
  const isExcluded   = (d: Date) => excludedDates.has(d.toISOString().split("T")[0])

  // ── pricing ────────────────────────────────────────────────────────────────
  const pricePerLbCents = FREQUENCY_PRICING[formData.frequency].cents
  const subtotalCents   = Math.max(formData.pounds * pricePerLbCents, MIN_POUNDS * pricePerLbCents)
  const discountCents   = promo ? Math.min(promo.discountCents, subtotalCents) : 0
  const totalCents      = subtotalCents - discountCents
  const preAuthCents    = Math.ceil(totalCents * 1.25)
  const totalDisplay    = (totalCents / 100).toFixed(2)
  const priceLabel      = FREQUENCY_PRICING[formData.frequency].label

  // ── one-time date helpers ──────────────────────────────────────────────────
  const minGapForDay = (d: Date) => d.getDay() === 5 ? 5 : 3  // Friday → 5 days, else 3
  const isWeekday    = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5
  const isPickupAvailable   = (d: Date) => isWeekday(d) && !isExcluded(d)
  const isDeliveryAvailable = (d: Date) => {
    if (!isWeekday(d) || isExcluded(d)) return false
    if (formData.pickupDate) {
      const gap  = minGapForDay(formData.pickupDate)
      const min  = new Date(formData.pickupDate)
      min.setDate(min.getDate() + gap)
      min.setHours(0, 0, 0, 0)
      return d >= min
    }
    return true
  }

  const handlePickupSelect = (date: Date) => {
    const gap  = minGapForDay(date)
    const delv = new Date(date)
    delv.setDate(delv.getDate() + gap)
    // advance to next weekday if needed
    while (!isWeekday(delv)) delv.setDate(delv.getDate() + 1)
    setFormData(p => ({ ...p, pickupDate: date, deliveryDate: delv }))
  }

  // ── recurring schedule computed values ─────────────────────────────────────
  const firstPickup   = formData.recurringPickupDay
    ? nextOccurrence(formData.recurringPickupDay)
    : undefined

  const firstDelivery = (firstPickup && formData.recurringDeliveryDay && formData.recurringPickupDay)
    ? firstDeliveryDate(firstPickup, formData.recurringDeliveryDay, formData.recurringPickupDay)
    : undefined

  const validDeliveryDays = formData.recurringPickupDay
    ? getValidDeliveryDays(formData.recurringPickupDay)
    : []

  // When pickup day changes, clear delivery day if no longer valid
  const handlePickupDayChange = (day: string) => {
    const valid = getValidDeliveryDays(day)
    setFormData(p => ({
      ...p,
      recurringPickupDay:   day,
      recurringDeliveryDay: valid.includes(p.recurringDeliveryDay) ? p.recurringDeliveryDay : "",
    }))
  }

  // ── step gating ────────────────────────────────────────────────────────────
  const canStep1 = isRecurring
    ? !!formData.recurringPickupDay && !!formData.recurringPickupTime
      && !!formData.recurringDeliveryDay && !!formData.recurringDeliveryTime
    : !!formData.pickupDate && !!formData.deliveryDate
      && !!formData.pickupTimeWindow && !!formData.deliveryTimeWindow

  const canStep3 = !!formData.name && !!formData.email && !!formData.phone && !!formData.address
  const canStep4 = formData.agreedToTerms && formData.smsConsent && formData.signature.trim().length > 0

  const selectedDetergentLabel = DETERGENT_OPTIONS.find(d => d.id === formData.detergent)?.label ?? ""
  const addOnsSummary = [
    formData.detergent !== "standard" ? selectedDetergentLabel : null,
    formData.fabricSoftener  ? "Fabric Softener" : null,
    formData.oxiClean        ? "OXI Clean" : null,
    formData.colorSafeBleach ? "Color-Safe Bleach" : null,
  ].filter(Boolean).join(", ") || "Standard (none)"

  // ── schedule summary strings ───────────────────────────────────────────────
  const pickupSummary = isRecurring
    ? `Every ${WEEKDAYS.find(d => d.id === formData.recurringPickupDay)?.label} · ${TIME_WINDOWS.find(w => w.value === formData.recurringPickupTime)?.label}`
    : formData.pickupDate
      ? `${format(formData.pickupDate, "EEE, MMM d")} · ${TIME_WINDOWS.find(w => w.value === formData.pickupTimeWindow)?.label}`
      : ""

  const deliverySummary = isRecurring
    ? `Every ${WEEKDAYS.find(d => d.id === formData.recurringDeliveryDay)?.label} · ${TIME_WINDOWS.find(w => w.value === formData.recurringDeliveryTime)?.label}`
    : formData.deliveryDate
      ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${TIME_WINDOWS.find(w => w.value === formData.deliveryTimeWindow)?.label}`
      : ""

  // ── Checkout metadata ──────────────────────────────────────────────────────
  const checkoutMeta: Record<string, string> = {
    customerName:    formData.name,
    customerEmail:   formData.email,
    customerPhone:   formData.phone,
    address:         formData.address,
    serviceType:     "wash_fold",
    subscriptionFrequency: formData.frequency,
    pricePerLbCents: String(pricePerLbCents),
    pounds:          String(formData.pounds),
    numBags:         String(formData.numBags),
    numComforters:   "0",
    detergent:       formData.detergent,
    fabricSoftener:  formData.fabricSoftener.toString(),
    oxiClean:        formData.oxiClean.toString(),
    colorSafeBleach: formData.colorSafeBleach.toString(),
    signature:       formData.signature,
    agreedToTerms:   formData.agreedToTerms.toString(),
    smsConsent:      formData.smsConsent.toString(),
    promoCode:           promo?.code ?? "",
    promoDiscountCents:  String(discountCents),
  }

  if (isRecurring) {
    checkoutMeta.recurringPickupDay      = formData.recurringPickupDay
    checkoutMeta.recurringPickupTime     = formData.recurringPickupTime
    checkoutMeta.recurringDeliveryDay    = formData.recurringDeliveryDay
    checkoutMeta.recurringDeliveryTime   = formData.recurringDeliveryTime
    checkoutMeta.pickupDate    = firstPickup?.toISOString()  ?? ""
    checkoutMeta.deliveryDate  = firstDelivery?.toISOString() ?? ""
    checkoutMeta.pickupTimeWindow   = formData.recurringPickupTime
    checkoutMeta.deliveryTimeWindow = formData.recurringDeliveryTime
  } else {
    checkoutMeta.pickupDate         = formData.pickupDate?.toISOString()  ?? ""
    checkoutMeta.deliveryDate       = formData.deliveryDate?.toISOString() ?? ""
    checkoutMeta.pickupTimeWindow   = formData.pickupTimeWindow
    checkoutMeta.deliveryTimeWindow = formData.deliveryTimeWindow
  }

  // ── payment step ───────────────────────────────────────────────────────────
  if (step === "payment") {
    return (
      <Card className="shadow-lg border-0 ring-1 ring-gray-100">
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5">
            <h3 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide mb-3">Order Summary</h3>
            {[
              { label: "Service",    value: "Wash & Fold" },
              { label: "Frequency",  value: formData.frequency === "one_time" ? "One-Time" : formData.frequency === "weekly" ? "Weekly" : "Biweekly" },
              { label: "Rate",       value: priceLabel },
              { label: "Bags",       value: `${formData.numBags} bag${formData.numBags > 1 ? "s" : ""}` },
              { label: "Est. Weight", value: `~${formData.pounds} lbs (estimated)` },
              { label: "Add-Ons",    value: addOnsSummary },
              { label: "Pickup",     value: pickupSummary },
              { label: "Delivery",   value: deliverySummary },
              { label: "Address",    value: formData.address },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400 shrink-0">{row.label}</span>
                <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
              </div>
            ))}
            {isRecurring && firstPickup && firstDelivery && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mt-1">
                <p className="text-xs font-bold text-blue-700 mb-1">Subscription Schedule</p>
                <p className="text-xs text-blue-600">First pickup: <strong>{format(firstPickup, "EEE, MMM d")}</strong></p>
                <p className="text-xs text-blue-600">First delivery: <strong>{format(firstDelivery, "EEE, MMM d")}</strong></p>
                <p className="text-[10px] text-blue-500 mt-1">Your card will be charged automatically for each pickup at actual weight.</p>
              </div>
            )}
            {promo && (
              <div className="flex justify-between gap-4 text-sm text-green-700">
                <span className="shrink-0">Promo ({promo.code})</span>
                <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
              <span className="text-[#0D2240]">Pre-authorization (est.)</span>
              <span className="text-[#E8726A]">${totalDisplay}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Charged at {priceLabel} · 20 lb minimum. Final charge adjusted to actual weight after pickup.
            </p>
          </div>
          <Checkout
            amountCents={preAuthCents}
            label={`Wash & Fold — ~${formData.pounds} lbs`}
            manualCapture={true}
            metadata={checkoutMeta}
          />
          <button className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors" onClick={() => setStep(4)}>
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

        {/* ── STEP 1: Frequency + Schedule ── */}
        {step === 1 && (
          <div className="space-y-7">

            {/* Frequency selector */}
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">How often do you need this service?</h3>
              <p className="text-sm text-gray-400 mb-4">Subscribers get a lower per-pound rate and a fixed weekly schedule.</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "one_time", label: "One-Time", price: "$2.50/lb", note: "" },
                  { value: "weekly",   label: "Weekly",   price: "$2.25/lb", note: "Save 10%" },
                  { value: "biweekly", label: "Biweekly", price: "$2.25/lb", note: "Save 10%" },
                ] as const).map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => setFormData(p => ({ ...p, frequency: opt.value }))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl border-2 py-3 px-2 transition-all",
                      formData.frequency === opt.value ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-200 bg-white hover:border-gray-300"
                    )}>
                    <span className={cn("font-extrabold text-sm", formData.frequency === opt.value ? "text-[#0D2240]" : "text-gray-700")}>
                      {opt.label}
                    </span>
                    <span className={cn("font-bold text-lg", formData.frequency === opt.value ? "text-[#E8726A]" : "text-gray-400")}>
                      {opt.price}
                    </span>
                    {opt.note && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        {opt.note}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Bag counter */}
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">How many bags are you leaving for us?</h3>
              <p className="text-sm text-gray-400">One standard laundry bag holds about 15 lbs. We&apos;ll weigh everything at pickup and adjust the final charge.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center gap-6 py-1">
                <button type="button"
                  onClick={() => setFormData(p => { const bags = Math.max(1, p.numBags - 1); return { ...p, numBags: bags, pounds: bagsToEstLbs(bags) } })}
                  disabled={formData.numBags <= 1}
                  className="w-12 h-12 rounded-full border-2 border-[#0D2240] text-[#0D2240] font-bold text-2xl flex items-center justify-center disabled:opacity-25 hover:bg-[#0D2240] hover:text-white transition-colors">
                  −
                </button>
                <div className="text-center min-w-[90px]">
                  <div className="text-6xl font-extrabold text-[#0D2240] leading-none tabular-nums">{formData.numBags}</div>
                  <div className="text-sm text-gray-400 mt-1.5 font-medium">bag{formData.numBags > 1 ? "s" : ""}</div>
                </div>
                <button type="button"
                  onClick={() => setFormData(p => { const bags = p.numBags + 1; return { ...p, numBags: bags, pounds: bagsToEstLbs(bags) } })}
                  className="w-12 h-12 rounded-full border-2 border-[#0D2240] text-[#0D2240] font-bold text-2xl flex items-center justify-center hover:bg-[#0D2240] hover:text-white transition-colors">
                  +
                </button>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button"
                    onClick={() => setFormData(p => ({ ...p, numBags: n, pounds: bagsToEstLbs(n) }))}
                    className={cn("px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all",
                      formData.numBags === n ? "bg-[#0D2240] border-[#0D2240] text-white" : "border-gray-200 text-gray-500 hover:border-[#0D2240]")}>
                    {n} bag{n > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimate card */}
            <div className="bg-[#fdf6f5] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs text-[#0D2240]/50 font-medium uppercase tracking-wide">Estimated weight</p>
                  <p className="text-sm font-bold text-[#0D2240]">~{formData.pounds} lbs ({formData.numBags} bag{formData.numBags > 1 ? "s" : ""} × ~15 lbs)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#0D2240]/50 font-medium uppercase tracking-wide">Pre-authorization</p>
                  <p className="text-2xl font-extrabold text-[#E8726A]">${totalDisplay}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-amber-700 leading-relaxed">
                  <span className="font-bold">This is an estimate.</span> Charged at {priceLabel} · 20 lb minimum. We weigh at pickup and charge the exact amount.
                </p>
              </div>
            </div>

            {/* ── DATE / SCHEDULE SECTION ── */}
            <div className="border-t border-gray-100 pt-6">

              {/* RECURRING: weekday + time picker */}
              {isRecurring ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-extrabold text-[#0D2240] text-base mb-1">Set your recurring schedule</h4>
                    <p className="text-sm text-gray-400">
                      {formData.frequency === "weekly" ? "Pickup every week on the same day." : "Pickup every two weeks on the same day."}
                      {" "}Your card is charged automatically at actual weight.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                    {/* Pickup day */}
                    <WeekdayPicker
                      label="↑ Pickup day"
                      value={formData.recurringPickupDay}
                      available={WEEKDAYS.map(d => d.id)}
                      onChange={handlePickupDayChange}
                    />

                    {/* Pickup time */}
                    {formData.recurringPickupDay && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">↑ Pickup time</p>
                        <div className="flex gap-2 flex-wrap">
                          {TIME_WINDOWS.map(w => (
                            <button key={w.value} type="button"
                              onClick={() => setFormData(p => ({ ...p, recurringPickupTime: w.value }))}
                              className={cn("px-5 py-2 rounded-xl text-sm font-bold border-2 transition-all",
                                formData.recurringPickupTime === w.value
                                  ? "bg-[#E8726A] border-[#E8726A] text-white"
                                  : "bg-white border-gray-200 text-[#0D2240] hover:border-[#E8726A]")}>
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery day */}
                    {formData.recurringPickupDay && formData.recurringPickupTime && (
                      <WeekdayPicker
                        label="↓ Delivery day"
                        value={formData.recurringDeliveryDay}
                        available={validDeliveryDays}
                        onChange={(d) => setFormData(p => ({ ...p, recurringDeliveryDay: d }))}
                        note={
                          formData.recurringPickupDay === "friday"
                            ? "Friday pickups are processed over the weekend — earliest delivery is Wednesday."
                            : "3-day turnaround minimum."
                        }
                      />
                    )}

                    {/* Delivery time */}
                    {formData.recurringDeliveryDay && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">↓ Delivery time</p>
                        <div className="flex gap-2 flex-wrap">
                          {TIME_WINDOWS.map(w => (
                            <button key={w.value} type="button"
                              onClick={() => setFormData(p => ({ ...p, recurringDeliveryTime: w.value }))}
                              className={cn("px-5 py-2 rounded-xl text-sm font-bold border-2 transition-all",
                                formData.recurringDeliveryTime === w.value
                                  ? "bg-[#E8726A] border-[#E8726A] text-white"
                                  : "bg-white border-gray-200 text-[#0D2240] hover:border-[#E8726A]")}>
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* First pickup / delivery preview */}
                  {firstPickup && firstDelivery && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Your first order</p>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-blue-500 text-[10px] font-bold uppercase">Pickup</p>
                          <p className="font-extrabold text-[#0D2240]">{format(firstPickup, "EEE, MMM d")}</p>
                        </div>
                        <div>
                          <p className="text-blue-500 text-[10px] font-bold uppercase">Delivery</p>
                          <p className="font-extrabold text-[#0D2240]">{format(firstDelivery, "EEE, MMM d")}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-blue-500 mt-2">
                        Then repeats every {formData.frequency === "weekly" ? "week" : "two weeks"} automatically.
                      </p>
                    </div>
                  )}
                </div>

              ) : (
                /* ONE-TIME: date strip (Mon–Fri) */
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                      <h4 className="font-bold text-[#0D2240] text-sm">Pickup Date &amp; Time</h4>
                      <span className="text-xs text-gray-400">— Any weekday</span>
                    </div>
                    <DateStrip selected={formData.pickupDate} onSelect={handlePickupSelect} isAvailable={isPickupAvailable} />
                    {formData.pickupDate && (
                      <>
                        {formData.pickupDate.getDay() === 5 && (
                          <p className="text-[10px] text-amber-600 font-medium mt-2 bg-amber-50 px-3 py-1.5 rounded-lg">
                            Friday pickups are processed over the weekend — earliest delivery is Wednesday.
                          </p>
                        )}
                        <TimeSlotPicker value={formData.pickupTimeWindow} onChange={(v) => setFormData(p => ({ ...p, pickupTimeWindow: v }))} />
                      </>
                    )}
                  </div>
                  {formData.pickupDate && formData.pickupTimeWindow && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                        <h4 className="font-bold text-[#0D2240] text-sm">Delivery Date &amp; Time</h4>
                        <span className="text-xs text-gray-400">— {formData.pickupDate.getDay() === 5 ? "5" : "3"}+ days after pickup</span>
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
              )}
            </div>

            <Button className="w-full h-12 text-base font-bold bg-[#0D2240] hover:bg-[#1a3a5c] mt-2"
              disabled={!canStep1} onClick={() => setStep(2)}>
              Continue: Add-Ons →
            </Button>
          </div>
        )}

        {/* ── STEP 2: Add-Ons ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Customize your wash</h3>
              <p className="text-sm text-gray-400">All add-ons are optional — skip to continue with standard service</p>
            </div>

            <div>
              <h4 className="font-bold text-[#0D2240] text-sm mb-3">Detergent Preference</h4>
              <div className="space-y-2">
                {DETERGENT_OPTIONS.map((opt) => (
                  <label key={opt.id}
                    className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      formData.detergent === opt.id ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white hover:border-gray-200")}>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      formData.detergent === opt.id ? "border-[#E8726A] bg-[#E8726A]" : "border-gray-300")}>
                      {formData.detergent === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <input type="radio" className="sr-only" name="detergent" value={opt.id}
                      checked={formData.detergent === opt.id}
                      onChange={() => setFormData(p => ({ ...p, detergent: opt.id }))} />
                    <div className="flex-1">
                      <p className="font-semibold text-[#0D2240] text-sm">{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.note}</p>
                    </div>
                    {opt.id === "standard" && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Free</span>}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-[#0D2240] text-sm mb-3">Treatment Add-Ons</h4>
              <div className="space-y-2">
                {[
                  { key: "fabricSoftener" as const,  label: "Fabric Softener",   desc: "Leaves clothes feeling soft and static-free",   icon: "🌸" },
                  { key: "oxiClean" as const,         label: "OXI Clean",         desc: "Extra stain-fighting power for whites and colors", icon: "✨" },
                  { key: "colorSafeBleach" as const,  label: "Color-Safe Bleach", desc: "Brightens colors without fading",                icon: "🎨" },
                ].map((addon) => (
                  <label key={addon.key}
                    className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      formData[addon.key] ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white hover:border-gray-200")}>
                    <Checkbox checked={formData[addon.key]}
                      onCheckedChange={(c) => setFormData(p => ({ ...p, [addon.key]: c as boolean }))}
                      className="shrink-0" />
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
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(1)}>← Back</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]" onClick={() => setStep(3)}>
                Continue: Your Info →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Contact Info ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Where should we go?</h3>
              <p className="text-sm text-gray-400">Pickup and delivery to the same address</p>
            </div>
            <div className="space-y-4">
              {[
                { label: "Full Name",                    key: "name",    placeholder: "Jane Smith",               type: "text"  },
                { label: "Email",                        key: "email",   placeholder: "jane@example.com",         type: "email" },
                { label: "Phone",                        key: "phone",   placeholder: "(407) 555-0100",           type: "tel"   },
                { label: "Pickup & Delivery Address",    key: "address", placeholder: "123 Oak St, Orlando FL 32827", type: "text" },
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
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(2)}>← Back</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canStep3} onClick={() => setStep(4)}>
                Continue: Confirm →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Almost done!</h3>
              <p className="text-sm text-gray-400">Review your order and sign below</p>
            </div>

            <PromoCodeField
              serviceType="wash_fold"
              subtotalCents={subtotalCents}
              onApply={(code, dc) => setPromo({ code, discountCents: dc })}
              onRemove={() => setPromo(null)}
            />

            <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5 text-sm">
              {[
                { label: "Service",     value: "Wash & Fold" },
                { label: "Frequency",   value: formData.frequency === "one_time" ? "One-Time" : formData.frequency === "weekly" ? "Weekly" : "Biweekly" },
                { label: "Rate",        value: priceLabel },
                { label: "Est. Weight", value: `~${formData.pounds} lbs` },
                { label: "Bags",        value: `${formData.numBags} bag${formData.numBags > 1 ? "s" : ""}` },
                { label: "Detergent",   value: DETERGENT_OPTIONS.find(d => d.id === formData.detergent)?.label ?? "" },
                { label: "Add-Ons",     value: addOnsSummary === "Standard (none)" ? "None" : addOnsSummary },
                { label: "Pickup",      value: pickupSummary },
                { label: "Delivery",    value: deliverySummary },
                { label: "Address",     value: formData.address },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
                </div>
              ))}
              {isRecurring && firstPickup && firstDelivery && (
                <div className="bg-blue-50 rounded-xl px-3 py-2 mt-1">
                  <p className="text-xs text-blue-600">
                    First pickup: <strong>{format(firstPickup, "EEE, MMM d")}</strong> →
                    delivery: <strong>{format(firstDelivery, "EEE, MMM d")}</strong>
                  </p>
                </div>
              )}
              {promo && (
                <div className="flex justify-between gap-4 text-green-700">
                  <span className="shrink-0">Promo ({promo.code})</span>
                  <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
                <span className="text-[#0D2240]">Estimated Total</span>
                <span className="text-[#E8726A]">${totalDisplay}</span>
              </div>
              <p className="text-[10px] text-gray-400">Final charge adjusted to actual weight after pickup.</p>
            </div>

            {isRecurring && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-blue-700 mb-1">Subscription commitment</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  By proceeding, I commit to a minimum of 4 pickups at the {formData.frequency} rate of {priceLabel}.
                  I understand my card will be charged automatically at actual weight after each pickup.
                  I can pause or cancel anytime with 48 hours&apos; notice before my next pickup.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={formData.agreedToTerms}
                  onCheckedChange={(c) => setFormData(p => ({ ...p, agreedToTerms: c as boolean }))}
                  className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I understand the final charge will be based on actual weight{isRecurring ? ", agree to the subscription commitment above," : ""} and agree to the terms of service.
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
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(3)}>← Back</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canStep4} onClick={() => setStep("payment")}>
                Proceed to Payment →
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
