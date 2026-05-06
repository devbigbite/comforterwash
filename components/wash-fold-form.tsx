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
import { getPricingConfig } from "@/app/actions/pricing"
import { getServiceOptions, type ServiceOption } from "@/app/actions/service-options"
import { getDeliveryFeeSettings } from "@/app/actions/settings"
import { calcDeliveryFee, calcTip, TIP_PRESETS, type TipOption, type FeeSettings } from "@/lib/checkout-fees"
import { isOnOrAfterMinPickup } from "@/lib/pickup-cutoff"
import { isPickupDay, isDeliveryDay, getEarliestRouteDelivery, getTimeWindowsForDate, getAllTimeWindows, type Route, type TimeWindow } from "@/lib/route-availability"
import { getActiveRoutes } from "@/app/actions/routes"
import { useLang } from "@/components/lang-provider"

// ─── constants ───────────────────────────────────────────────────────────────
const LBS_PER_BAG = 15

// Dynamic — overwritten on mount from Supabase
let MIN_POUNDS = 20
let FREQ_CENTS = { one_time: 240, weekly: 215, biweekly: 215 }

function buildFreqPricing() {
  return {
    one_time: { cents: FREQ_CENTS.one_time, label: `$${(FREQ_CENTS.one_time / 100).toFixed(2)}/lb` },
    weekly:   { cents: FREQ_CENTS.weekly,   label: `$${(FREQ_CENTS.weekly   / 100).toFixed(2)}/lb` },
    biweekly: { cents: FREQ_CENTS.biweekly, label: `$${(FREQ_CENTS.biweekly / 100).toFixed(2)}/lb` },
  }
}

function bagsToEstLbs(bags: number) {
  return Math.max(bags * LBS_PER_BAG, MIN_POUNDS)
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

// ─── weekday schedule helpers ────────────────────────────────────────────────
const WEEKDAYS = [
  { id: "monday",    label: "Monday",    short: "Mon", num: 1 },
  { id: "tuesday",   label: "Tuesday",   short: "Tue", num: 2 },
  { id: "wednesday", label: "Wednesday", short: "Wed", num: 3 },
  { id: "thursday",  label: "Thursday",  short: "Thu", num: 4 },
  { id: "friday",    label: "Friday",    short: "Fri", num: 5 },
]

function getValidDeliveryDays(pickupDayId: string): string[] {
  const pickup = WEEKDAYS.find(d => d.id === pickupDayId)
  if (!pickup) return []
  const minGap = pickupDayId === "friday" ? 5 : 3
  return WEEKDAYS.filter(d => {
    const gap = d.num > pickup.num ? d.num - pickup.num : 7 - pickup.num + d.num
    return gap >= minGap
  }).map(d => d.id)
}

function nextOccurrence(dayId: string, after?: Date): Date {
  const dayNums: Record<string, number> = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5
  }
  const target = dayNums[dayId]
  const base = after ? new Date(after) : new Date()
  base.setHours(0, 0, 0, 0)
  const todayNum = base.getDay()
  let diff = target - todayNum
  if (diff <= 0) diff += 7
  const result = new Date(base)
  result.setDate(base.getDate() + diff)
  return result
}

function firstDeliveryDate(pickupDate: Date, deliveryDayId: string, pickupDayId: string): Date {
  const minGap = pickupDayId === "friday" ? 5 : 3
  const earliest = new Date(pickupDate)
  earliest.setDate(earliest.getDate() + minGap)
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
  return (
    <div className="overflow-x-auto pb-1 -mx-1">
      <div className="flex gap-2 px-1 w-max">
        {dates.map((d, i) => {
          const avail = isAvailable(d)
          const sel = !!selected && isSameDay(d, selected)
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
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TimeSlotPicker({ value, onChange, label, windows }: { value: string; onChange: (v: string) => void; label: string; windows: TimeWindow[] }) {
  return (
    <div>
      <p className="text-xs text-center text-gray-400 mb-3 mt-4">{label}</p>
      <div className="flex gap-2 justify-center flex-wrap">
        {windows.map((w) => (
          <button key={w.id} type="button" onClick={() => onChange(w.label)}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              value === w.label ? "bg-[#E8726A] text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
  const { translations: tr } = useLang()
  const tf = tr.form
  const tw = tr.washFoldForm

  const STEPS = [
    { id: 1, label: tf.stepService },
    { id: 2, label: tf.stepAddOns },
    { id: 3, label: tf.stepYourInfo },
    { id: 4, label: tf.stepConfirm },
  ]

  const [detergentOptions, setDetergentOptions] = useState<ServiceOption[]>([])
  const [extraOptions, setExtraOptions] = useState<ServiceOption[]>([])
  const [freqPricing, setFreqPricing] = useState(buildFreqPricing())
  const [minLbs, setMinLbs] = useState(MIN_POUNDS)

  const [step, setStep] = useState<1 | 2 | 3 | 4 | "payment">(1)
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", address: "",
    pickupDate:          undefined as Date | undefined,
    deliveryDate:        undefined as Date | undefined,
    pickupTimeWindow:    "",
    deliveryTimeWindow:  "",
    recurringPickupDay:      "",
    recurringPickupTime:     "",
    recurringDeliveryDay:    "",
    recurringDeliveryTime:   "",
    numBags:     2,
    pounds:      bagsToEstLbs(2),
    frequency:   "one_time" as "one_time" | "weekly" | "biweekly",
    detergentId:    "" as string,
    selectedExtras: {} as Record<string, boolean>,
    signature:        "",
    agreedToTerms:    false,
    smsConsent:       false,
  })

  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set())
  const [activeRoutes, setActiveRoutes] = useState<Route[]>([])
  const [promo, setPromo] = useState<{ code: string; discountCents: number } | null>(null)
  const [tipOption, setTipOption] = useState<TipOption>("none")
  const [customTipCents, setCustomTipCents] = useState(0)
  const [feeSettings, setFeeSettings] = useState<FeeSettings>({ deliveryEnabled: false, deliveryFeeCents: 499, waiverCents: 0 })

  useEffect(() => {
    getExcludedDates().then(dates => setExcludedDates(new Set(dates)))
    getActiveRoutes().then(setActiveRoutes)
    getDeliveryFeeSettings().then(s => setFeeSettings({ deliveryEnabled: s.enabled, deliveryFeeCents: s.feeCents, waiverCents: s.waiverCents }))
    getPricingConfig().then(cfg => {
      FREQ_CENTS = { one_time: cfg.washFoldOneTimeCents, weekly: cfg.washFoldSubCents, biweekly: cfg.washFoldSubCents }
      MIN_POUNDS = cfg.washFoldMinLbs
      setFreqPricing(buildFreqPricing())
      setMinLbs(cfg.washFoldMinLbs)
    })
    Promise.all([getServiceOptions("detergent"), getServiceOptions("extra")]).then(([dets, exts]) => {
      setDetergentOptions(dets)
      setExtraOptions(exts)
      if (dets.length > 0) setFormData(f => ({ ...f, detergentId: dets[0].id }))
      if (exts.length > 0) {
        const init: Record<string, boolean> = {}
        exts.forEach(e => { init[e.id] = false })
        setFormData(f => ({ ...f, selectedExtras: init }))
      }
    })
  }, [])

  const isRecurring  = formData.frequency !== "one_time"

  const selectedDetergent   = detergentOptions.find(d => d.id === formData.detergentId)
  const selectedExtrasList  = extraOptions.filter(e => formData.selectedExtras[e.id])
  const extrasCents         = (selectedDetergent?.price_cents ?? 0) + selectedExtrasList.reduce((s, e) => s + e.price_cents, 0)

  const pricePerLbCents = freqPricing[formData.frequency as keyof typeof freqPricing].cents
  const baseCents       = Math.max(formData.pounds * pricePerLbCents, minLbs * pricePerLbCents)
  const subtotalCents    = baseCents + extrasCents
  const discountCents    = promo ? Math.min(promo.discountCents, subtotalCents) : 0
  const afterDiscountCents = subtotalCents - discountCents
  const deliveryFeeCents = calcDeliveryFee(feeSettings, afterDiscountCents)
  const tipCents         = calcTip(tipOption, customTipCents, afterDiscountCents)
  const totalCents       = afterDiscountCents + deliveryFeeCents + tipCents
  const preAuthCents     = Math.ceil((afterDiscountCents + deliveryFeeCents) * 1.25) + tipCents
  const totalDisplay     = (totalCents / 100).toFixed(2)
  const priceLabel      = freqPricing[formData.frequency as keyof typeof freqPricing].label

  const isExcluded = (d: Date) => excludedDates.has(d.toISOString().split("T")[0])
  const isWeekday  = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5

  const isPickupAvailable = (d: Date) => {
    if (isExcluded(d) || !isOnOrAfterMinPickup(d)) return false
    if (activeRoutes.length === 0) return isWeekday(d)
    return isPickupDay(d, activeRoutes)
  }

  const isDeliveryAvailable = (d: Date) => {
    if (isExcluded(d)) return false
    const available = activeRoutes.length > 0 ? isDeliveryDay(d, activeRoutes) : isWeekday(d)
    if (!available) return false
    if (formData.pickupDate) {
      const min = new Date(formData.pickupDate)
      min.setDate(min.getDate() + 3)
      min.setHours(0, 0, 0, 0)
      return d >= min
    }
    return true
  }

  const handlePickupSelect = (date: Date) => {
    const delv = getEarliestRouteDelivery(date, activeRoutes, 3)
    setFormData(p => ({ ...p, pickupDate: date, deliveryDate: delv }))
  }

  const firstPickup   = formData.recurringPickupDay ? nextOccurrence(formData.recurringPickupDay) : undefined
  const firstDelivery = (firstPickup && formData.recurringDeliveryDay && formData.recurringPickupDay)
    ? firstDeliveryDate(firstPickup, formData.recurringDeliveryDay, formData.recurringPickupDay)
    : undefined
  const validDeliveryDays = formData.recurringPickupDay ? getValidDeliveryDays(formData.recurringPickupDay) : []

  const handlePickupDayChange = (day: string) => {
    const valid = getValidDeliveryDays(day)
    setFormData(p => ({
      ...p,
      recurringPickupDay:   day,
      recurringDeliveryDay: valid.includes(p.recurringDeliveryDay) ? p.recurringDeliveryDay : "",
    }))
  }

  const canStep1 = isRecurring
    ? !!formData.recurringPickupDay && !!formData.recurringPickupTime
      && !!formData.recurringDeliveryDay && !!formData.recurringDeliveryTime
    : !!formData.pickupDate && !!formData.deliveryDate
      && !!formData.pickupTimeWindow && !!formData.deliveryTimeWindow

  const canStep3 = !!formData.name && !!formData.email && !!formData.phone && !!formData.address
  const canStep4 = formData.agreedToTerms && formData.smsConsent && formData.signature.trim().length > 0

  const addOnsSummary = [
    selectedDetergent && detergentOptions[0]?.id !== formData.detergentId ? selectedDetergent.name : null,
    ...selectedExtrasList.map(e => e.name),
  ].filter(Boolean).join(", ") || tw.standardNone

  const pickupSummary = isRecurring
    ? `${tw.pickupEvery} ${WEEKDAYS.find(d => d.id === formData.recurringPickupDay)?.label} · ${formData.recurringPickupTime}`
    : formData.pickupDate
      ? `${format(formData.pickupDate, "EEE, MMM d")} · ${formData.pickupTimeWindow}`
      : ""

  const deliverySummary = isRecurring
    ? `${tw.pickupEvery} ${WEEKDAYS.find(d => d.id === formData.recurringDeliveryDay)?.label} · ${formData.recurringDeliveryTime}`
    : formData.deliveryDate
      ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${formData.deliveryTimeWindow}`
      : ""

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
    detergent:       selectedDetergent?.name ?? "",
    extras:          selectedExtrasList.map(e => e.name).join(", "),
    extrasCents:     String(extrasCents),
    signature:       formData.signature,
    agreedToTerms:   formData.agreedToTerms.toString(),
    smsConsent:      formData.smsConsent.toString(),
    promoCode:           promo?.code ?? "",
    promoDiscountCents:  String(discountCents),
    deliveryFeeCents:    String(deliveryFeeCents),
    tipCents:            String(tipCents),
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

  const CONTACT_FIELDS = [
    { label: tf.fullName,              key: "name",    placeholder: "Jane Smith",                      type: "text"  },
    { label: tf.email,                 key: "email",   placeholder: "jane@example.com",                type: "email" },
    { label: tf.phone,                 key: "phone",   placeholder: "(407) 555-0100",                  type: "tel"   },
    { label: tf.pickupDeliveryAddress, key: "address", placeholder: "123 Oak St, Orlando FL 32827",    type: "text"  },
  ]

  // ── payment step ───────────────────────────────────────────────────────────
  if (step === "payment") {
    return (
      <Card className="shadow-lg border-0 ring-1 ring-gray-100">
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5">
            <h3 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide mb-3">{tw.orderSummary}</h3>
            {[
              { label: tf.labelService,    value: tw.washFoldLabel },
              { label: tf.labelFrequency,  value: formData.frequency === "one_time" ? tw.oneTimeLabel : formData.frequency === "weekly" ? tw.weeklyLabel : tw.biweeklyLabel },
              { label: tf.labelRate,       value: priceLabel },
              { label: tf.labelBags,       value: `${formData.numBags} ${formData.numBags > 1 ? tf.bags : tf.bag}` },
              { label: tf.labelEstWeight,  value: `~${formData.pounds} lbs (estimated)` },
              { label: tf.labelAddOns,     value: addOnsSummary },
              { label: tf.labelPickup,     value: pickupSummary },
              { label: tf.labelDelivery,   value: deliverySummary },
              { label: tf.labelAddress,    value: formData.address },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400 shrink-0">{row.label}</span>
                <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
              </div>
            ))}
            {isRecurring && firstPickup && firstDelivery && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mt-1">
                <p className="text-xs font-bold text-blue-700 mb-1">{tw.subscriptionSchedule}</p>
                <p className="text-xs text-blue-600">{tw.firstPickupDate} <strong>{format(firstPickup, "EEE, MMM d")}</strong></p>
                <p className="text-xs text-blue-600">{tw.firstDeliveryDate} <strong>{format(firstDelivery, "EEE, MMM d")}</strong></p>
                <p className="text-[10px] text-blue-500 mt-1">{tw.subscriptionCardCharge}</p>
              </div>
            )}
            {promo && (
              <div className="flex justify-between gap-4 text-sm text-green-700">
                <span className="shrink-0">{tf.promo} ({promo.code})</span>
                <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
              </div>
            )}
            {deliveryFeeCents > 0 && (
              <div className="flex justify-between gap-4 text-sm text-gray-600">
                <span className="shrink-0">Delivery fee</span>
                <span className="font-semibold">${(deliveryFeeCents / 100).toFixed(2)}</span>
              </div>
            )}
            {tipCents > 0 && (
              <div className="flex justify-between gap-4 text-sm text-gray-600">
                <span className="shrink-0">Tip</span>
                <span className="font-semibold">${(tipCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
              <span className="text-[#0D2240]">{tf.preAuthEst}</span>
              <span className="text-[#E8726A]">${totalDisplay}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              {tw.chargedAtSummary.replace("{priceLabel}", priceLabel)}
            </p>
          </div>
          <Checkout
            amountCents={preAuthCents}
            label={`Wash & Fold — ~${formData.pounds} lbs`}
            manualCapture={true}
            metadata={checkoutMeta}
          />
          <button className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors" onClick={() => setStep(4)}>
            {tf.backToReview}
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
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tw.howOften}</h3>
              <p className="text-sm text-gray-400 mb-4">{tw.subscriberNote}</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "one_time", label: tw.oneTime,  price: freqPricing.one_time.label, note: "" },
                  { value: "weekly",   label: tw.weekly,   price: freqPricing.weekly.label,   note: tw.save10 },
                  { value: "biweekly", label: tw.biweekly, price: freqPricing.biweekly.label, note: tw.save10 },
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
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tw.howManyBags}</h3>
              <p className="text-sm text-gray-400">{tw.bagWeightNote}</p>
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
                  <div className="text-sm text-gray-400 mt-1.5 font-medium">{formData.numBags > 1 ? tf.bags : tf.bag}</div>
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
                    {n} {n > 1 ? tf.bags : tf.bag}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimate card */}
            <div className="bg-[#fdf6f5] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs text-[#0D2240]/50 font-medium uppercase tracking-wide">{tw.estimatedWeight}</p>
                  <p className="text-sm font-bold text-[#0D2240]">~{formData.pounds} lbs ({formData.numBags} {formData.numBags > 1 ? tf.bags : tf.bag} × ~15 lbs)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#0D2240]/50 font-medium uppercase tracking-wide">{tw.preAuth}</p>
                  <p className="text-2xl font-extrabold text-[#E8726A]">${totalDisplay}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-amber-700 leading-relaxed">
                  <span className="font-bold">{tw.estimateNote}</span> {tw.chargedAt.replace("{priceLabel}", priceLabel)}
                </p>
              </div>
            </div>

            {/* ── DATE / SCHEDULE SECTION ── */}
            <div className="border-t border-gray-100 pt-6">

              {/* RECURRING: weekday + time picker */}
              {isRecurring ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-extrabold text-[#0D2240] text-base mb-1">{tw.recurringTitle}</h4>
                    <p className="text-sm text-gray-400">
                      {formData.frequency === "weekly" ? tw.recurringWeekly : tw.recurringBiweekly}
                      {" "}{tw.recurringCardCharge}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                    {/* Pickup day */}
                    <WeekdayPicker
                      label={tw.pickupDay}
                      value={formData.recurringPickupDay}
                      available={WEEKDAYS.map(d => d.id)}
                      onChange={handlePickupDayChange}
                    />

                    {/* Pickup time */}
                    {formData.recurringPickupDay && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{tw.pickupTime}</p>
                        <div className="flex gap-2 flex-wrap">
                          {getAllTimeWindows(activeRoutes).map(w => (
                            <button key={w.id} type="button"
                              onClick={() => setFormData(p => ({ ...p, recurringPickupTime: w.label }))}
                              className={cn("px-5 py-2 rounded-xl text-sm font-bold border-2 transition-all",
                                formData.recurringPickupTime === w.label
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
                        label={tw.deliveryDay}
                        value={formData.recurringDeliveryDay}
                        available={validDeliveryDays}
                        onChange={(d) => setFormData(p => ({ ...p, recurringDeliveryDay: d }))}
                        note={formData.recurringPickupDay === "friday" ? tw.fridayNote : tw.minTurnaround}
                      />
                    )}

                    {/* Delivery time */}
                    {formData.recurringDeliveryDay && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{tw.deliveryTime}</p>
                        <div className="flex gap-2 flex-wrap">
                          {getAllTimeWindows(activeRoutes).map(w => (
                            <button key={w.id} type="button"
                              onClick={() => setFormData(p => ({ ...p, recurringDeliveryTime: w.label }))}
                              className={cn("px-5 py-2 rounded-xl text-sm font-bold border-2 transition-all",
                                formData.recurringDeliveryTime === w.label
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
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">{tw.yourFirstOrder}</p>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-blue-500 text-[10px] font-bold uppercase">{tw.pickupLabel}</p>
                          <p className="font-extrabold text-[#0D2240]">{format(firstPickup, "EEE, MMM d")}</p>
                        </div>
                        <div>
                          <p className="text-blue-500 text-[10px] font-bold uppercase">{tw.deliveryLabel}</p>
                          <p className="font-extrabold text-[#0D2240]">{format(firstDelivery, "EEE, MMM d")}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-blue-500 mt-2">
                        {formData.frequency === "weekly" ? tw.repeatsEveryWeek : tw.repeatsEveryTwoWeeks}
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
                      <h4 className="font-bold text-[#0D2240] text-sm">{tf.labelPickup} Date &amp; Time</h4>
                      <span className="text-xs text-gray-400">— {tw.anyWeekday}</span>
                    </div>
                    <DateStrip selected={formData.pickupDate} onSelect={handlePickupSelect} isAvailable={isPickupAvailable} />
                    {formData.pickupDate && (
                      <>
                        {formData.pickupDate.getDay() === 5 && (
                          <p className="text-[10px] text-amber-600 font-medium mt-2 bg-amber-50 px-3 py-1.5 rounded-lg">
                            {tw.fridayNote}
                          </p>
                        )}
                        <TimeSlotPicker label={tf.availableTimeSlots} value={formData.pickupTimeWindow} onChange={(v) => setFormData(p => ({ ...p, pickupTimeWindow: v }))} windows={getTimeWindowsForDate(formData.pickupDate!, activeRoutes, "pickup")} />
                      </>
                    )}
                  </div>
                  {formData.pickupDate && formData.pickupTimeWindow && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                        <h4 className="font-bold text-[#0D2240] text-sm">{tf.labelDelivery} Date &amp; Time</h4>
                        <span className="text-xs text-gray-400">— {formData.pickupDate.getDay() === 5 ? "5" : "3"}+ {tw.daysAfterPickup}</span>
                      </div>
                      {formData.deliveryDate && (
                        <p className="text-xs text-[#E8726A] font-medium mb-3">
                          {tw.suggested} {format(formData.deliveryDate, "EEE, MMM d")}
                        </p>
                      )}
                      <DateStrip selected={formData.deliveryDate} onSelect={(d) => setFormData(p => ({ ...p, deliveryDate: d }))} isAvailable={isDeliveryAvailable} />
                      {formData.deliveryDate && <TimeSlotPicker label={tf.availableTimeSlots} value={formData.deliveryTimeWindow} onChange={(v) => setFormData(p => ({ ...p, deliveryTimeWindow: v }))} windows={getTimeWindowsForDate(formData.deliveryDate!, activeRoutes, "delivery")} />}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button className="w-full h-12 text-base font-bold bg-[#0D2240] hover:bg-[#1a3a5c] mt-2"
              disabled={!canStep1} onClick={() => setStep(2)}>
              {tf.continueAddOns}
            </Button>
          </div>
        )}

        {/* ── STEP 2: Add-Ons ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tr.bookingForm.customizeWash}</h3>
              <p className="text-sm text-gray-400">{tr.bookingForm.addOnsOptional}</p>
            </div>

            {detergentOptions.length > 0 && (
              <div>
                <h4 className="font-bold text-[#0D2240] text-sm mb-3">{tf.detergentPreference}</h4>
                <div className="space-y-2">
                  {detergentOptions.map((opt, i) => (
                    <label key={opt.id}
                      className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                        formData.detergentId === opt.id ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white hover:border-gray-200")}>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        formData.detergentId === opt.id ? "border-[#E8726A] bg-[#E8726A]" : "border-gray-300")}>
                        {formData.detergentId === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <input type="radio" className="sr-only" name="detergent" value={opt.id}
                        checked={formData.detergentId === opt.id}
                        onChange={() => setFormData(p => ({ ...p, detergentId: opt.id }))} />
                      <div className="flex-1">
                        <p className="font-semibold text-[#0D2240] text-sm">{opt.name}</p>
                        {opt.description && <p className="text-xs text-gray-400">{opt.description}</p>}
                      </div>
                      {opt.price_cents === 0
                        ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{tf.freeBadge}</span>
                        : <span className="text-[10px] font-bold text-[#0D2240] bg-gray-100 px-2 py-0.5 rounded-full">+${(opt.price_cents / 100).toFixed(2)}</span>
                      }
                    </label>
                  ))}
                </div>
              </div>
            )}

            {extraOptions.length > 0 && (
              <div>
                <h4 className="font-bold text-[#0D2240] text-sm mb-3">{tf.treatmentAddOns}</h4>
                <div className="space-y-2">
                  {extraOptions.map((addon) => (
                    <label key={addon.id}
                      className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                        formData.selectedExtras[addon.id] ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white hover:border-gray-200")}>
                      <Checkbox
                        checked={!!formData.selectedExtras[addon.id]}
                        onCheckedChange={(c) => setFormData(p => ({ ...p, selectedExtras: { ...p.selectedExtras, [addon.id]: c as boolean } }))}
                        className="shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-[#0D2240] text-sm">{addon.name}</p>
                        {addon.description && <p className="text-xs text-gray-400">{addon.description}</p>}
                      </div>
                      {addon.price_cents === 0
                        ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{tf.freeBadge}</span>
                        : <span className="text-[10px] font-bold text-[#0D2240] bg-gray-100 px-2 py-0.5 rounded-full">+${(addon.price_cents / 100).toFixed(2)}</span>
                      }
                    </label>
                  ))}
                </div>
              </div>
            )}

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
                  <Input type={type} placeholder={placeholder}
                    value={(formData as Record<string, unknown>)[key] as string}
                    onChange={(e) => setFormData(p => ({ ...p, [key]: e.target.value }))}
                    className="h-12 border-gray-200 focus:border-[#E8726A] text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(2)}>{tf.back}</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canStep3} onClick={() => setStep(4)}>
                {tf.continueConfirm}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tf.almostDone}</h3>
              <p className="text-sm text-gray-400">{tf.reviewOrder}</p>
            </div>

            <PromoCodeField
              serviceType="wash_fold"
              subtotalCents={subtotalCents}
              onApply={(code, dc) => setPromo({ code, discountCents: dc })}
              onRemove={() => setPromo(null)}
            />

            {/* Tip selector */}
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-bold text-[#0D2240] mb-3">Add a Tip <span className="text-gray-400 font-normal">(optional — shared among all staff)</span></p>
              <div className="flex gap-2 flex-wrap mb-3">
                {TIP_PRESETS.map(p => (
                  <button key={p.value} type="button"
                    onClick={() => setTipOption(p.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${tipOption === p.value ? "bg-[#0D2240] text-white border-[#0D2240]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0D2240]"}`}>
                    {p.label}{p.value !== "none" && p.value !== "custom" ? ` · $${(calcTip(p.value, 0, afterDiscountCents) / 100).toFixed(2)}` : ""}
                  </button>
                ))}
              </div>
              {tipOption === "custom" && (
                <div className="relative max-w-[160px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input type="number" min="0" step="0.50" placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]"
                    onChange={e => setCustomTipCents(Math.round(parseFloat(e.target.value || "0") * 100))} />
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5 text-sm">
              {[
                { label: tf.labelService,    value: tw.washFoldLabel },
                { label: tf.labelFrequency,  value: formData.frequency === "one_time" ? tw.oneTimeLabel : formData.frequency === "weekly" ? tw.weeklyLabel : tw.biweeklyLabel },
                { label: tf.labelRate,       value: priceLabel },
                { label: tf.labelEstWeight,  value: `~${formData.pounds} lbs` },
                { label: tf.labelBags,       value: `${formData.numBags} ${formData.numBags > 1 ? tf.bags : tf.bag}` },
                { label: tw.detergentLabel,  value: selectedDetergent?.name ?? "" },
                { label: tf.labelAddOns,     value: addOnsSummary === tw.standardNone ? tw.none : addOnsSummary },
                { label: tf.labelPickup,     value: pickupSummary },
                { label: tf.labelDelivery,   value: deliverySummary },
                { label: tf.labelAddress,    value: formData.address },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
                </div>
              ))}
              {isRecurring && firstPickup && firstDelivery && (
                <div className="bg-blue-50 rounded-xl px-3 py-2 mt-1">
                  <p className="text-xs text-blue-600">
                    {tw.firstPickupDate} <strong>{format(firstPickup, "EEE, MMM d")}</strong> →
                    {tw.firstDeliveryDate} <strong>{format(firstDelivery, "EEE, MMM d")}</strong>
                  </p>
                </div>
              )}
              {promo && (
                <div className="flex justify-between gap-4 text-green-700">
                  <span className="shrink-0">{tf.promo} ({promo.code})</span>
                  <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
                </div>
              )}
              {deliveryFeeCents > 0 && (
                <div className="flex justify-between gap-4 text-gray-600">
                  <span className="shrink-0">Delivery fee</span>
                  <span className="font-semibold">${(deliveryFeeCents / 100).toFixed(2)}</span>
                </div>
              )}
              {feeSettings.deliveryEnabled && deliveryFeeCents === 0 && feeSettings.waiverCents > 0 && (
                <div className="flex justify-between gap-4 text-green-700">
                  <span className="shrink-0">Delivery fee</span>
                  <span className="font-semibold">Free 🎉</span>
                </div>
              )}
              {tipCents > 0 && (
                <div className="flex justify-between gap-4 text-gray-600">
                  <span className="shrink-0">Tip</span>
                  <span className="font-semibold">${(tipCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
                <span className="text-[#0D2240]">{tf.estimatedTotal}</span>
                <span className="text-[#E8726A]">${totalDisplay}</span>
              </div>
              <p className="text-[10px] text-gray-400">{tw.finalChargeNote}</p>
            </div>

            {isRecurring && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-blue-700 mb-1">{tw.subscriptionCommitment}</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  {tw.subscriptionCommitText} {formData.frequency === "weekly" ? tw.weeklyLabel : tw.biweeklyLabel} {priceLabel}.
                  {" "}{tw.subscriptionCommitText2}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={formData.agreedToTerms}
                  onCheckedChange={(c) => setFormData(p => ({ ...p, agreedToTerms: c as boolean }))}
                  className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  {isRecurring ? tw.agreeWeightSubTerms : tw.agreeWeightTerms}
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer bg-[#fdf6f5] rounded-xl p-3">
                <Checkbox checked={formData.smsConsent}
                  onCheckedChange={(c) => setFormData(p => ({ ...p, smsConsent: c as boolean }))}
                  className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  <strong>{tf.smsConsentBold}</strong>{tf.smsConsentSuffix}
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-[#0D2240] text-sm">{tf.signatureLabel}</Label>
              <Input placeholder={tf.signaturePlaceholder} value={formData.signature}
                onChange={(e) => setFormData(p => ({ ...p, signature: e.target.value }))}
                className="h-12 font-serif text-lg italic border-gray-200 focus:border-[#E8726A]" />
              <p className="text-xs text-gray-400">{tf.signatureNote}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(3)}>{tf.back}</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                disabled={!canStep4} onClick={() => setStep("payment")}>
                {tf.proceedToPayment}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
