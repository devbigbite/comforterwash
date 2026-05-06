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
import { isPickupDay, isDeliveryDay, getEarliestRouteDelivery, getTimeWindowsForDate, type Route, type TimeWindow } from "@/lib/route-availability"
import { getActiveRoutes } from "@/app/actions/routes"
import { useLang } from "@/components/lang-provider"

let PRICE_PER_LB = 199  // $1.99 in cents — overwritten on mount
let MIN_POUNDS = 20
const LBS_PER_BAG = 15

function bagsToEstLbs(bags: number) {
  return Math.max(bags * LBS_PER_BAG, MIN_POUNDS)
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

function DateStrip({ selected, onSelect, isAvailable }: {
  selected: Date | undefined
  onSelect: (d: Date) => void
  isAvailable: (d: Date) => boolean
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dates = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i + 1); return d
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
            className={cn("px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              value === w.label ? "bg-[#E8726A] text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {w.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function WashOnlyForm() {
  const { translations: tr } = useLang()
  const tf = tr.form
  const tw = tr.washFoldForm
  const tb = tr.bookingForm
  const two = tr.washOnlyForm

  const STEPS = [
    { id: 1, label: tf.stepService },
    { id: 2, label: tf.stepDetergent },
    { id: 3, label: tf.stepYourInfo },
    { id: 4, label: tf.stepConfirm },
  ]

  const [step, setStep] = useState<1 | 2 | 3 | 4 | "payment">(1)
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "",
    pickupStreet: "", pickupCity: "", pickupState: "FL", pickupZip: "",
    sameAddress: true,
    deliveryStreet: "", deliveryCity: "", deliveryState: "FL", deliveryZip: "",
    pickupDate: undefined as Date | undefined,
    deliveryDate: undefined as Date | undefined,
    pickupTimeWindow: "",
    deliveryTimeWindow: "",
    numBags: 2,
    pounds: bagsToEstLbs(2),
    detergentId: "" as string,
    selectedExtras: {} as Record<string, boolean>,
    signature: "",
    agreedToTerms: false,
    smsConsent: false,
  })
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set())
  const [activeRoutes, setActiveRoutes] = useState<Route[]>([])
  const [promo, setPromo] = useState<{ code: string; discountCents: number } | null>(null)
  const [tipOption, setTipOption] = useState<TipOption>("none")
  const [customTipCents, setCustomTipCents] = useState(0)
  const [feeSettings, setFeeSettings] = useState<FeeSettings>({ deliveryEnabled: false, deliveryFeeCents: 499, waiverCents: 0 })
  const [priceCents, setPriceCents] = useState(PRICE_PER_LB)
  const [minLbs, setMinLbs] = useState(MIN_POUNDS)
  const [detergentOptions, setDetergentOptions] = useState<ServiceOption[]>([])
  const [extraOptions, setExtraOptions] = useState<ServiceOption[]>([])

  useEffect(() => {
    getExcludedDates().then(dates => setExcludedDates(new Set(dates)))
    getActiveRoutes().then(setActiveRoutes)
    getDeliveryFeeSettings().then(s => setFeeSettings({ deliveryEnabled: s.enabled, deliveryFeeCents: s.feeCents, waiverCents: s.waiverCents }))
    getPricingConfig().then(cfg => {
      PRICE_PER_LB = cfg.washOnlyCents
      MIN_POUNDS = cfg.washOnlyMinLbs
      setPriceCents(cfg.washOnlyCents)
      setMinLbs(cfg.washOnlyMinLbs)
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

  const isExcluded = (d: Date) => excludedDates.has(d.toISOString().split("T")[0])

  const isPickupAvailable = (d: Date) => {
    if (isExcluded(d) || !isOnOrAfterMinPickup(d)) return false
    if (activeRoutes.length === 0) {
      const day = d.getDay(); return day === 1 || day === 2 || day === 3
    }
    return isPickupDay(d, activeRoutes)
  }

  const isDeliveryAvailable = (d: Date) => {
    if (isExcluded(d)) return false
    const available = activeRoutes.length > 0
      ? isDeliveryDay(d, activeRoutes)
      : [1, 2, 3].includes(d.getDay())
    if (!available) return false
    if (formData.pickupDate) {
      const min = new Date(formData.pickupDate); min.setDate(min.getDate() + 3); min.setHours(0, 0, 0, 0)
      return d >= min
    }
    return true
  }

  const selectedDetergent = detergentOptions.find(d => d.id === formData.detergentId)
  const selectedExtrasList = extraOptions.filter(e => formData.selectedExtras[e.id])
  const extrasCents = (selectedDetergent?.price_cents ?? 0) + selectedExtrasList.reduce((s, e) => s + e.price_cents, 0)
  const baseCents = Math.max(formData.pounds * priceCents, minLbs * priceCents)
  const subtotalCents      = baseCents + extrasCents
  const discountCents      = promo ? Math.min(promo.discountCents, subtotalCents) : 0
  const afterDiscountCents = subtotalCents - discountCents
  const deliveryFeeCents   = calcDeliveryFee(feeSettings, afterDiscountCents)
  const tipCents           = calcTip(tipOption, customTipCents, afterDiscountCents)
  const totalCents         = afterDiscountCents + deliveryFeeCents + tipCents
  const preAuthCents       = Math.ceil((afterDiscountCents + deliveryFeeCents) * 1.25) + tipCents
  const totalDisplay       = (totalCents / 100).toFixed(2)

  const priceLabel = `$${(priceCents / 100).toFixed(2)}/lb`

  // isPickupAvailable and isDeliveryAvailable defined above near isExcluded

  const canStep1 = !!formData.pickupDate && !!formData.deliveryDate && !!formData.pickupTimeWindow && !!formData.deliveryTimeWindow
  function buildAddr(street: string, city: string, state: string, zip: string) {
    return `${street}, ${city}, ${state} ${zip}`.trim()
  }
  const pickupAddrFull = !!formData.pickupStreet && !!formData.pickupCity && !!formData.pickupState && !!formData.pickupZip
  const deliveryAddrFull = formData.sameAddress || (!!formData.deliveryStreet && !!formData.deliveryCity && !!formData.deliveryState && !!formData.deliveryZip)
  const canStep3 = !!formData.name && !!formData.email && !!formData.phone && pickupAddrFull && deliveryAddrFull
  const canStep4 = formData.agreedToTerms && formData.smsConsent && formData.signature.trim().length > 0

  if (step === "payment") {
    return (
      <Card className="shadow-lg border-0 ring-1 ring-gray-100">
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5">
            <h3 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide mb-3">{tw.orderSummary}</h3>
            {[
              { label: tf.labelService, value: "Wash Only (no folding)" },
              { label: tf.labelRate, value: priceLabel },
              { label: tf.labelBags, value: `${formData.numBags} ${formData.numBags > 1 ? tf.bags : tf.bag}` },
              { label: tf.labelEstWeight, value: `~${formData.pounds} lbs` },
              { label: tw.detergentLabel, value: selectedDetergent?.name ?? "" },
              ...(selectedExtrasList.length > 0 ? [{ label: tf.labelExtras ?? "Extras", value: selectedExtrasList.map(e => e.name).join(", ") }] : []),
              { label: tf.labelPickup,   value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${formData.pickupTimeWindow}` : "" },
              { label: tf.labelDelivery, value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${formData.deliveryTimeWindow}` : "" },
              { label: "Pickup Address", value: buildAddr(formData.pickupStreet, formData.pickupCity, formData.pickupState, formData.pickupZip) },
              ...(!formData.sameAddress ? [{ label: "Delivery Address", value: buildAddr(formData.deliveryStreet, formData.deliveryCity, formData.deliveryState, formData.deliveryZip) }] : []),
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400 shrink-0">{row.label}</span>
                <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
              </div>
            ))}
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
              <span className="text-[#0D2240]">{tf.preAuthEst}</span>
              <span className="text-[#E8726A]">${totalDisplay}</span>
            </div>
            <p className="text-[10px] text-gray-400">{tw.chargedAtSummary.replace("{priceLabel}", priceLabel)}</p>
          </div>
          <Checkout
            amountCents={preAuthCents}
            label={`Wash Only — ~${formData.pounds} lbs`}
            manualCapture={true}
            metadata={{
              customerName: formData.name,
              customerEmail: formData.email,
              customerPhone: formData.phone,
              address: buildAddr(formData.pickupStreet, formData.pickupCity, formData.pickupState, formData.pickupZip),
              deliveryAddress: formData.sameAddress
                ? buildAddr(formData.pickupStreet, formData.pickupCity, formData.pickupState, formData.pickupZip)
                : buildAddr(formData.deliveryStreet, formData.deliveryCity, formData.deliveryState, formData.deliveryZip),
              pickupDate: formData.pickupDate?.toISOString() || "",
              deliveryDate: formData.deliveryDate?.toISOString() || "",
              pickupTimeWindow: formData.pickupTimeWindow,
              deliveryTimeWindow: formData.deliveryTimeWindow,
              signature: formData.signature,
              agreedToTerms: formData.agreedToTerms.toString(),
              smsConsent: formData.smsConsent.toString(),
              serviceType: "wash_only",
              subscriptionFrequency: "one_time",
              pricePerLbCents: String(priceCents),
              pounds: String(formData.pounds),
              numBags: String(formData.numBags),
              numComforters: "0",
              detergent: selectedDetergent?.name ?? "",
              extras: selectedExtrasList.map(e => e.name).join(", "),
              extrasCents: String(extrasCents),
              promoCode: promo?.code ?? "",
              promoDiscountCents: String(discountCents),
              deliveryFeeCents: String(deliveryFeeCents),
              tipCents: String(tipCents),
            }}
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

        {/* ── STEP 1: Bags + Dates ── */}
        {step === 1 && (
          <div className="space-y-7">
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

            <div className="bg-[#fdf6f5] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#0D2240]/50 font-medium uppercase tracking-wide">{tw.estimatedWeight}</p>
                  <p className="text-sm font-bold text-[#0D2240]">~{formData.pounds} lbs</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#0D2240]/50 font-medium uppercase tracking-wide">{tf.preAuthEst}</p>
                  <p className="text-2xl font-extrabold text-[#E8726A]">${totalDisplay}</p>
                  <p className="text-xs text-gray-400">at {priceLabel}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 border-t border-gray-100 pt-6">
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <h4 className="font-bold text-[#0D2240] text-sm">{tb.pickupDateTitle}</h4>
                </div>
                <DateStrip selected={formData.pickupDate} onSelect={(d) => setFormData(p => ({ ...p, pickupDate: d, deliveryDate: getEarliestRouteDelivery(d, activeRoutes) }))} isAvailable={isPickupAvailable} />
                {formData.pickupDate && <TimeSlotPicker value={formData.pickupTimeWindow} onChange={(v) => setFormData(p => ({ ...p, pickupTimeWindow: v }))} label={tf.availableTimeSlots} windows={getTimeWindowsForDate(formData.pickupDate, activeRoutes, "pickup")} />}
              </div>
              {formData.pickupDate && formData.pickupTimeWindow && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <h4 className="font-bold text-[#0D2240] text-sm">{tb.deliveryDateTitle}</h4>
                    <span className="text-xs text-gray-400">— {tb.deliveryGapNote}</span>
                  </div>
                  <DateStrip selected={formData.deliveryDate} onSelect={(d) => setFormData(p => ({ ...p, deliveryDate: d }))} isAvailable={isDeliveryAvailable} />
                  {formData.deliveryDate && <TimeSlotPicker value={formData.deliveryTimeWindow} onChange={(v) => setFormData(p => ({ ...p, deliveryTimeWindow: v }))} label={tf.availableTimeSlots} windows={getTimeWindowsForDate(formData.deliveryDate, activeRoutes, "delivery")} />}
                </div>
              )}
            </div>

            <Button className="w-full h-12 text-base font-bold bg-[#0D2240] hover:bg-[#1a3a5c] mt-2"
              disabled={!canStep1} onClick={() => setStep(2)}>
              {tf.continueDetergent}
            </Button>
          </div>
        )}

        {/* ── STEP 2: Detergent ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tf.detergentPreference}</h3>
              <p className="text-sm text-gray-400">{two.clothesWashedNote}</p>
            </div>
            <div className="space-y-2">
              {detergentOptions.map((opt) => (
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
                    <p className="text-xs text-gray-400">{opt.description}</p>
                  </div>
                  {opt.price_cents === 0
                    ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{tf.freeBadge}</span>
                    : <span className="text-[10px] font-bold text-[#0D2240] bg-[#0D2240]/10 px-2 py-0.5 rounded-full">+${(opt.price_cents / 100).toFixed(2)}</span>
                  }
                </label>
              ))}
            </div>
            {extraOptions.length > 0 && (
              <div className="space-y-2">
                {extraOptions.map((opt) => (
                  <label key={opt.id} className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                    formData.selectedExtras[opt.id] ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white hover:border-gray-200")}>
                    <Checkbox
                      checked={!!formData.selectedExtras[opt.id]}
                      onCheckedChange={(c) => setFormData(p => ({ ...p, selectedExtras: { ...p.selectedExtras, [opt.id]: c as boolean } }))}
                      className="shrink-0"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-[#0D2240] text-sm">{opt.name}</p>
                      <p className="text-xs text-gray-400">{opt.description}</p>
                    </div>
                    {opt.price_cents === 0
                      ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{tf.freeBadge}</span>
                      : <span className="text-[10px] font-bold text-[#0D2240] bg-[#0D2240]/10 px-2 py-0.5 rounded-full">+${(opt.price_cents / 100).toFixed(2)}</span>
                    }
                  </label>
                ))}
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
              <p className="text-sm text-gray-400">Enter your contact info and service address.</p>
            </div>
            <div className="space-y-4">
              {[
                { label: tf.fullName, key: "name", placeholder: "Jane Smith", type: "text" },
                { label: tf.email, key: "email", placeholder: "jane@example.com", type: "email" },
                { label: tf.phone, key: "phone", placeholder: "(407) 555-0100", type: "tel" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="font-semibold text-[#0D2240] text-sm">{label}</Label>
                  <Input type={type} placeholder={placeholder}
                    value={(formData as Record<string, unknown>)[key] as string}
                    onChange={(e) => setFormData(p => ({ ...p, [key]: e.target.value }))}
                    className="h-12 border-gray-200 focus:border-[#E8726A] text-sm" />
                </div>
              ))}

              {/* Pickup address */}
              <div className="space-y-2">
                <Label className="font-semibold text-[#0D2240] text-sm">Pickup Address</Label>
                <Input placeholder="Street address" value={formData.pickupStreet}
                  onChange={(e) => setFormData(p => ({ ...p, pickupStreet: e.target.value }))}
                  className="h-12 border-gray-200 focus:border-[#E8726A] text-sm" />
                <div className="grid grid-cols-5 gap-2">
                  <Input placeholder="City" value={formData.pickupCity}
                    onChange={(e) => setFormData(p => ({ ...p, pickupCity: e.target.value }))}
                    className="col-span-2 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                  <Input placeholder="ST" maxLength={2} value={formData.pickupState}
                    onChange={(e) => setFormData(p => ({ ...p, pickupState: e.target.value.toUpperCase() }))}
                    className="col-span-1 h-10 border-gray-200 focus:border-[#E8726A] text-sm text-center uppercase" />
                  <Input placeholder="Zip" value={formData.pickupZip}
                    onChange={(e) => setFormData(p => ({ ...p, pickupZip: e.target.value }))}
                    className="col-span-2 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                </div>
              </div>

              {/* Same address toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                <Checkbox checked={formData.sameAddress} onCheckedChange={(c) => setFormData(p => ({ ...p, sameAddress: c as boolean }))} />
                <span className="text-sm text-gray-700 font-medium">Same address for pickup &amp; delivery</span>
              </label>

              {/* Delivery address (shown when different) */}
              {!formData.sameAddress && (
                <div className="space-y-2">
                  <Label className="font-semibold text-[#0D2240] text-sm">Delivery Address</Label>
                  <Input placeholder="Street address" value={formData.deliveryStreet}
                    onChange={(e) => setFormData(p => ({ ...p, deliveryStreet: e.target.value }))}
                    className="h-12 border-gray-200 focus:border-[#E8726A] text-sm" />
                  <div className="grid grid-cols-5 gap-2">
                    <Input placeholder="City" value={formData.deliveryCity}
                      onChange={(e) => setFormData(p => ({ ...p, deliveryCity: e.target.value }))}
                      className="col-span-2 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                    <Input placeholder="ST" maxLength={2} value={formData.deliveryState}
                      onChange={(e) => setFormData(p => ({ ...p, deliveryState: e.target.value.toUpperCase() }))}
                      className="col-span-1 h-10 border-gray-200 focus:border-[#E8726A] text-sm text-center uppercase" />
                    <Input placeholder="Zip" value={formData.deliveryZip}
                      onChange={(e) => setFormData(p => ({ ...p, deliveryZip: e.target.value }))}
                      className="col-span-2 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                  </div>
                </div>
              )}
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
              serviceType="wash_only"
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
                { label: tf.labelService, value: "Wash Only (no folding)" },
                { label: tf.labelRate, value: priceLabel },
                { label: tf.labelEstWeight, value: `~${formData.pounds} lbs` },
                { label: tf.labelBags, value: `${formData.numBags} ${formData.numBags > 1 ? tf.bags : tf.bag}` },
                { label: tw.detergentLabel, value: selectedDetergent?.name ?? "" },
                ...(selectedExtrasList.length > 0 ? [{ label: tf.labelExtras ?? "Extras", value: selectedExtrasList.map(e => e.name).join(", ") }] : []),
                { label: tf.labelPickup,   value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${formData.pickupTimeWindow}` : "" },
                { label: tf.labelDelivery, value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${formData.deliveryTimeWindow}` : "" },
                { label: "Pickup Address", value: buildAddr(formData.pickupStreet, formData.pickupCity, formData.pickupState, formData.pickupZip) },
                ...(!formData.sameAddress ? [{ label: "Delivery Address", value: buildAddr(formData.deliveryStreet, formData.deliveryCity, formData.deliveryState, formData.deliveryZip) }] : []),
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
                </div>
              ))}
              {promo && (
                <div className="flex justify-between gap-4 text-green-700">
                  <span className="shrink-0">{tf.promo} ({promo.code})</span>
                  <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
                <span className="text-[#0D2240]">{tf.estimatedTotal}</span>
                <span className="text-[#E8726A]">${totalDisplay}</span>
              </div>
              <p className="text-[10px] text-gray-400">{two.estimatedTotalNote}</p>
            </div>

            {/* ── Required agreements + signature ── */}
            <div className="rounded-2xl border-2 border-[#E8726A]/25 bg-[#fdf6f5]/60 p-4 space-y-3">
              {/* Terms */}
              <label className={`flex items-start gap-3 cursor-pointer rounded-xl border-2 p-3 transition-all ${formData.agreedToTerms ? "border-green-300 bg-green-50" : "border-dashed border-gray-300 bg-white hover:border-[#E8726A]/50"}`}>
                <Checkbox checked={formData.agreedToTerms} onCheckedChange={(c) => setFormData(p => ({ ...p, agreedToTerms: c as boolean }))} className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700 leading-relaxed">
                  {tw.agreeWeightTerms}
                  {!formData.agreedToTerms && <span className="ml-1.5 text-[#E8726A] font-bold text-[11px]">← required</span>}
                </span>
              </label>

              {/* SMS consent */}
              <label className={`flex items-start gap-3 cursor-pointer rounded-xl border-2 p-3 transition-all ${formData.smsConsent ? "border-green-300 bg-green-50" : "border-dashed border-gray-300 bg-white hover:border-[#E8726A]/50"}`}>
                <Checkbox checked={formData.smsConsent} onCheckedChange={(c) => setFormData(p => ({ ...p, smsConsent: c as boolean }))} className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700 leading-relaxed">
                  <strong>{tf.smsConsentBold}</strong>{tf.smsConsentSuffix}
                  {!formData.smsConsent && <span className="ml-1.5 text-[#E8726A] font-bold text-[11px]">← required</span>}
                </span>
              </label>

              {/* Electronic signature */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="font-extrabold text-[#0D2240] text-sm">
                    {tf.signatureLabel} <span className="text-[#E8726A]">*</span>
                  </Label>
                  {formData.signature.trim()
                    ? <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">✓ Signed</span>
                    : <span className="text-[10px] font-bold text-[#E8726A] uppercase tracking-wide">Required</span>
                  }
                </div>
                <div className={`rounded-xl border-2 transition-all ${formData.signature.trim() ? "border-green-300 bg-green-50" : "border-dashed border-gray-300 bg-white"}`}>
                  <Input placeholder={tf.signaturePlaceholder} value={formData.signature}
                    onChange={(e) => setFormData(p => ({ ...p, signature: e.target.value }))}
                    className="h-13 font-serif text-xl italic border-0 bg-transparent focus-visible:ring-0 shadow-none" />
                </div>
                <p className="text-xs text-gray-500 font-semibold">{tf.signatureNote}</p>
              </div>
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
