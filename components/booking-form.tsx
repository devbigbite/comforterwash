"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { getAuthenticatedProfile, createOptionalAccount } from "@/app/actions/customer-auth"
import { CheckCircle2 } from "lucide-react"
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
import { getComforterPromo, getDeliveryFeeSettings, getTipsEnabled } from "@/app/actions/settings"
import { getPricingConfig } from "@/app/actions/pricing"
import { getServiceOptions, type ServiceOption } from "@/app/actions/service-options"
import { calcDeliveryFee, calcTip, TIP_PRESETS, type TipOption, type DeliveryFeeConfig } from "@/lib/checkout-fees"
import { isOnOrAfterMinPickup } from "@/lib/pickup-cutoff"
import { isPickupDay, isDeliveryDay, getEarliestRouteDelivery, getTimeWindowsForDate, type Route, type TimeWindow } from "@/lib/route-availability"
import { getActiveRoutes } from "@/app/actions/routes"
import { AddressAutocomplete } from "@/components/address-autocomplete"

// ── Pricing ─────────────────────────────────────────────────────────────────
// Defaults — overwritten on mount from Supabase
let PROMO_PRICE_CENTS = 3300

let SIZE_CENTS = { twin: 2900, full: 3300, queen: 3800, king: 4300 }

function buildSizes() {
  return [
    { id: "twin",  label: "Twin",  note: "Up to 50\"×70\"",  cents: SIZE_CENTS.twin },
    { id: "full",  label: "Full",  note: "Up to 54\"×75\"",  cents: SIZE_CENTS.full },
    { id: "queen", label: "Queen", note: "Up to 60\"×80\"",  cents: SIZE_CENTS.queen },
    { id: "king",  label: "King",  note: "Up to 108\"×90\"", cents: SIZE_CENTS.king },
  ]
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

type SizeId = "twin" | "full" | "queen" | "king"
type Quantities = Record<SizeId, number>

// getEarliestDelivery is now route-aware — defined inside the component
// using the activeRoutes state. This placeholder is kept for reference only.

// ── Sub-components ───────────────────────────────────────────────────────────
function DateStrip({
  label, sublabel, selected, onSelect, isAvailable, tomorrow,
}: {
  label: string; sublabel?: string; selected: Date | undefined
  onSelect: (d: Date) => void; isAvailable: (d: Date) => boolean; tomorrow: string
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dates = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i + 1); return d
  })
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const dayHint = (d: Date) => {
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    return diff === 1 ? tomorrow : ""
  }
  return (
    <div>
      {label && (
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-bold text-[#0D2240] text-sm">{label}</span>
          {sublabel && <span className="text-xs text-gray-400">{sublabel}</span>}
        </div>
      )}
      <div className="overflow-x-auto pb-1 -mx-1 scrollbar-thin">
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

// ── Main component ───────────────────────────────────────────────────────────
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

  const [step, setStep] = useState<1 | 2 | 3 | 4 | "payment">(1)
  const [promoActive, setPromoActive] = useState(false)
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set())
  const [activeRoutes, setActiveRoutes] = useState<Route[]>([])

  const [quantities, setQuantities] = useState<Quantities>({ twin: 0, full: 0, queen: 1, king: 0 })

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "",
    pickupStreet: "", pickupCity: "", pickupState: "FL", pickupZip: "",
    sameAddress: true,
    deliveryStreet: "", deliveryCity: "", deliveryState: "FL", deliveryZip: "",
    pickupDate: undefined as Date | undefined,
    deliveryDate: undefined as Date | undefined,
    pickupTimeWindow: "",
    deliveryTimeWindow: "",
    detergentId:    "" as string,
    selectedExtras: {} as Record<string, boolean>,
    signature: "",
    agreedToTerms: false,
    smsConsent: false,
  })

  // ── Auth gate state ───────────────────────────────────────────────────────
  const [emailCheckState, setEmailCheckState] = useState<"idle" | "otp_sent" | "verified">("idle")
  const [otpCode, setOtpCode] = useState("")
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState("")
  const [showAccountPrompt, setShowAccountPrompt] = useState(false)
  const [accountCreating, setAccountCreating] = useState(false)
  const [accountCreated, setAccountCreated] = useState(false)

  // Auth method picker
  const [authMethod, setAuthMethod] = useState<"" | "email" | "phone">("") // "" = panel shown, not chosen
  const [authPanelDismissed, setAuthPanelDismissed] = useState(false)
  const [phoneForAuth, setPhoneForAuth] = useState("")
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState("")
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false)
  const [phoneOtpError, setPhoneOtpError] = useState("")

  async function handleGoogleAuth() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/book/comforter-wash` },
    })
  }

  async function sendPhoneOtp() {
    const phone = phoneForAuth.replace(/\D/g, "")
    if (phone.length < 10) { setPhoneOtpError("Enter a valid US phone number."); return }
    setPhoneOtpLoading(true); setPhoneOtpError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ phone: `+1${phone}`, options: { shouldCreateUser: false } })
    if (error) { setPhoneOtpError("Phone not found. Try a different method."); setPhoneOtpLoading(false); return }
    setPhoneOtpSent(true); setPhoneOtpLoading(false)
  }

  async function verifyPhoneOtp() {
    const phone = phoneForAuth.replace(/\D/g, "")
    setPhoneOtpLoading(true); setPhoneOtpError("")
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ phone: `+1${phone}`, token: phoneOtpCode, type: "sms" })
    if (error) { setPhoneOtpError("Invalid or expired code."); setPhoneOtpLoading(false); return }
    const profile = await getAuthenticatedProfile()
    if (profile) {
      setFormData(p => ({
        ...p,
        name:  profile.fullName  || p.name,
        email: profile.fullName ? p.email : p.email,
        phone: profile.phone     || p.phone,
        pickupStreet: profile.savedAddress ? profile.savedAddress.split(",")[0]?.trim() || p.pickupStreet : p.pickupStreet,
      }))
    }
    setEmailCheckState("verified"); setPhoneOtpLoading(false)
  }

  async function sendEmailOtp() {
    const email = formData.email.trim()
    if (!email) return
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (!error) setEmailCheckState("otp_sent")
    else setOtpError("No account found for that email. Continue as guest.")
  }

  async function handleEmailBlur() {
    const email = formData.email.trim()
    if (!email || emailCheckState !== "idle") return
    sendEmailOtp()
  }

  async function verifyOtp() {
    setOtpLoading(true)
    setOtpError("")
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: formData.email.trim(),
      token: otpCode,
      type: "email",
    })
    if (error) {
      setOtpError("Invalid or expired code. Try again.")
      setOtpLoading(false)
      return
    }
    // Pre-fill profile data
    const profile = await getAuthenticatedProfile()
    if (profile) {
      setFormData(p => ({
        ...p,
        name:  profile.fullName  || p.name,
        phone: profile.phone     || p.phone,
        pickupStreet: profile.savedAddress ? profile.savedAddress.split(",")[0]?.trim() || p.pickupStreet : p.pickupStreet,
      }))
    }
    setEmailCheckState("verified")
    setOtpCode("")
    setOtpLoading(false)
  }

  async function handleCreateAccount() {
    setAccountCreating(true)
    await createOptionalAccount(formData.email, formData.name, formData.phone)
    setAccountCreating(false)
    setAccountCreated(true)
  }

  const [promo, setPromo] = useState<{ code: string; discountCents: number } | null>(null)
  const [tipOption, setTipOption] = useState<TipOption>("none")
  const [tipsEnabled, setTipsEnabled] = useState(true)
  const [customTipCents, setCustomTipCents] = useState(0)
  const [feeConfig, setFeeConfig] = useState<DeliveryFeeConfig>({ comforterCents: 0, washFoldCents: 0, washOnlyCents: 0 })
  const [comforterSizes, setComforterSizes] = useState(buildSizes())
  const [promoPriceCents, setPromoPriceCents] = useState(PROMO_PRICE_CENTS)
  const [detergentOptions, setDetergentOptions] = useState<ServiceOption[]>([])
  const [extraOptions, setExtraOptions] = useState<ServiceOption[]>([])

  useEffect(() => {
    import("@/app/actions/holidays").then(m => m.getExcludedDates()).then(dates => setExcludedDates(new Set(dates)))
    getActiveRoutes().then(setActiveRoutes)
    getComforterPromo().then(setPromoActive)
    getDeliveryFeeSettings().then(s => setFeeConfig(s))
    getTipsEnabled().then(setTipsEnabled)
    getPricingConfig().then(cfg => {
      PROMO_PRICE_CENTS = cfg.comforterPromoCents
      SIZE_CENTS = { twin: cfg.comforterTwinCents, full: cfg.comforterFullCents, queen: cfg.comforterQueenCents, king: cfg.comforterKingCents }
      setPromoPriceCents(cfg.comforterPromoCents)
      setComforterSizes(buildSizes())
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

  // ── Pricing math ─────────────────────────────────────────────────────────
  const totalCount = Object.values(quantities).reduce((a, b) => a + b, 0)

  const subtotalCents = promoActive
    ? totalCount * promoPriceCents
    : comforterSizes.reduce((acc, s) => acc + quantities[s.id as SizeId] * s.cents, 0)

  const discountCents      = promo ? Math.min(promo.discountCents, subtotalCents) : 0
  const afterDiscountCents = Math.max(0, subtotalCents - discountCents)
  const deliveryFeeCents   = calcDeliveryFee(feeConfig, "comforter_wash")
  const tipCents           = calcTip(tipOption, customTipCents, afterDiscountCents)
  const totalCents         = afterDiscountCents + deliveryFeeCents + tipCents
  const totalDisplay       = (totalCents / 100).toFixed(2)

  // ── Date helpers ─────────────────────────────────────────────────────────
  const isExcluded = (d: Date) => excludedDates.has(d.toISOString().split("T")[0])

  const isPickupAvailable = (d: Date) => {
    if (isExcluded(d) || !isOnOrAfterMinPickup(d)) return false
    if (activeRoutes.length === 0) {
      // No routes yet — fall back to Mon/Tue/Wed
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

  const handlePickupSelect = (date: Date) => {
    setFormData(p => ({ ...p, pickupDate: date, deliveryDate: getEarliestRouteDelivery(date, activeRoutes) }))
  }

  // ── Counter helpers ──────────────────────────────────────────────────────
  const setQty = (id: SizeId, delta: number) => {
    setQuantities(q => ({ ...q, [id]: Math.max(0, q[id] + delta) }))
  }

  // ── Step guards ──────────────────────────────────────────────────────────
  const canStep1 = totalCount > 0 && !!formData.pickupDate && !!formData.deliveryDate && !!formData.pickupTimeWindow && !!formData.deliveryTimeWindow
  const canStep4 = formData.agreedToTerms && formData.smsConsent && formData.signature.trim().length > 0

  // ── Summary line items ───────────────────────────────────────────────────
  const selectedSizes = comforterSizes.filter(s => quantities[s.id as SizeId] > 0)

  const selectedDetergent   = detergentOptions.find(d => d.id === formData.detergentId)
  const selectedExtrasList  = extraOptions.filter(e => formData.selectedExtras[e.id])
  const addOnsSummary = [
    selectedDetergent && selectedDetergent.id !== detergentOptions[0]?.id ? selectedDetergent.name : null,
    ...selectedExtrasList.map(e => e.name),
  ].filter(Boolean).join(", ") || selectedDetergent?.name || tf.standard

  const sizesMetadata = comforterSizes
    .filter(s => quantities[s.id as SizeId] > 0)
    .map(s => `${s.label}:${quantities[s.id as SizeId]}`)
    .join(",")

  const CONTACT_FIELDS = [
    { label: tf.email,    key: "email", placeholder: "jane@example.com", type: "email" },
    { label: tf.fullName, key: "name",  placeholder: "Jane Smith",       type: "text" },
    { label: tf.phone,    key: "phone", placeholder: "(407) 555-0100",   type: "tel" },
  ]

  function buildAddr(street: string, city: string, state: string, zip: string) {
    return `${street}, ${city}, ${state} ${zip}`.trim()
  }
  const pickupAddrFull = !!formData.pickupStreet && !!formData.pickupCity && !!formData.pickupState && !!formData.pickupZip
  const deliveryAddrFull = formData.sameAddress || (!!formData.deliveryStreet && !!formData.deliveryCity && !!formData.deliveryState && !!formData.deliveryZip)
  const canStep3 = !!formData.name && !!formData.email && !!formData.phone && pickupAddrFull && deliveryAddrFull

  // ── Payment screen ────────────────────────────────────────────────────────
  if (step === "payment") {
    return (
      <Card className="shadow-lg border-0 ring-1 ring-gray-100 overflow-hidden">
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5">
            <h3 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide mb-3">{tb.bookingSummary}</h3>
            {[
              { label: tf.labelName,     value: formData.name },
              { label: tf.labelPickup,   value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${formData.pickupTimeWindow}` : "" },
              { label: tf.labelDelivery, value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${formData.deliveryTimeWindow}` : "" },
              { label: tf.pickupAddressLabel, value: buildAddr(formData.pickupStreet, formData.pickupCity, formData.pickupState, formData.pickupZip) },
              ...(!formData.sameAddress ? [{ label: tf.deliveryAddressLabel, value: buildAddr(formData.deliveryStreet, formData.deliveryCity, formData.deliveryState, formData.deliveryZip) }] : []),
              { label: tf.labelAddOns,   value: addOnsSummary },
            ].map(row => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-400 shrink-0">{row.label}</span>
                <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
              </div>
            ))}
            {/* Per-size breakdown */}
            {selectedSizes.map(s => {
              const qty = quantities[s.id as SizeId]
              const linePrice = promoActive ? qty * promoPriceCents : qty * s.cents
              return (
                <div key={s.id} className="flex justify-between gap-4 text-sm">
                  <span className="text-gray-400 shrink-0">
                    {s.label} × {qty}
                    {promoActive && <span className="ml-1 text-[#E8726A] text-[10px] font-bold">PROMO</span>}
                  </span>
                  <span className="font-medium text-[#0D2240]">${(linePrice / 100).toFixed(2)}</span>
                </div>
              )
            })}
            {discountCents > 0 && (
              <div className="flex justify-between gap-4 text-green-600 text-sm">
                <span>{tf.promo} ({promo!.code})</span>
                <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
              </div>
            )}
            {deliveryFeeCents > 0 && (
              <div className="flex justify-between gap-4 text-gray-600 text-sm">
                <span>Delivery fee</span>
                <span className="font-semibold">${(deliveryFeeCents / 100).toFixed(2)}</span>
              </div>
            )}
            {tipCents > 0 && (
              <div className="flex justify-between gap-4 text-gray-600 text-sm">
                <span>Tip</span>
                <span className="font-semibold">${(tipCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
              <span className="text-[#0D2240]">{tf.total}</span>
              <span className="text-[#E8726A]">${totalDisplay}</span>
            </div>
          </div>

          <Checkout
            amountCents={totalCents}
            label={`Comforter Wash × ${totalCount}`}
            manualCapture={false}
            onSuccess={() => { if (emailCheckState !== "verified") setShowAccountPrompt(true) }}
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
              serviceType: "comforter_wash",
              numComforters: String(totalCount),
              numBags: String(totalCount),
              comforterSizes: sizesMetadata,
              flatRatePromo: promoActive.toString(),
              detergent: selectedDetergent?.name ?? "Standard",
              extras: selectedExtrasList.map(e => e.name).join(", "),
              promoCode: promo?.code ?? "",
              promoDiscountCents: String(discountCents),
              deliveryFeeCents: String(deliveryFeeCents),
              tipCents: String(tipCents),
            }}
          />

          {/* Post-payment: invite new customer to create an account */}
          {showAccountPrompt && !accountCreated && (
            <div className="rounded-2xl border-2 border-[#0D2240]/15 bg-[#fdf6f5] p-5 space-y-3">
              <div>
                <p className="font-bold text-[#0D2240] text-sm">Save your info for next time?</p>
                <p className="text-xs text-gray-500 mt-1">We&apos;ll create a free account so you can re-order without re-entering everything.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-10 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]"
                  disabled={accountCreating}
                  onClick={handleCreateAccount}
                >
                  {accountCreating ? "Creating…" : "Yes, create my account"}
                </Button>
                <Button variant="outline" className="h-10 text-sm text-gray-400" onClick={() => setShowAccountPrompt(false)}>
                  No thanks
                </Button>
              </div>
            </div>
          )}
          {accountCreated && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-700 font-semibold">Account created! Check your email for a sign-in link.</p>
            </div>
          )}

          <button className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors" onClick={() => setStep(4)}>
            {tf.backToReview}
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-0 ring-1 ring-gray-100 overflow-hidden">
      <CardContent className="pt-6">

        {/* Progress indicator */}
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

        {/* ── STEP 1: Service + Dates ── */}
        {step === 1 && (
          <div className="space-y-6">

            {/* Promo banner */}
            {promoActive && (
              <div className="rounded-2xl bg-[#E8726A] text-white px-4 py-3 flex items-center gap-3">
                <span className="text-2xl shrink-0">🏷️</span>
                <div>
                  <p className="font-extrabold text-sm leading-tight">Limited-Time Promotion</p>
                  <p className="text-white/80 text-xs">Every comforter — any size — just <strong className="text-white">${(promoPriceCents / 100).toFixed(0)}</strong></p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tb.selectSize}</h3>
              <p className="text-sm text-gray-400">{tb.selectSizeNote}</p>
            </div>

            {/* Per-size tiles with individual counters */}
            <div className="grid grid-cols-2 gap-3">
              {comforterSizes.map((s) => {
                const qty = quantities[s.id as SizeId]
                const isSelected = qty > 0
                const origPrice = `$${(s.cents / 100).toFixed(0)}`
                const promoSavings = s.cents > promoPriceCents

                return (
                  <div key={s.id}
                    className={cn(
                      "rounded-2xl border-2 p-4 transition-all",
                      isSelected ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-200 bg-white"
                    )}>
                    {/* Size label + price */}
                    <div className="flex items-start justify-between mb-1">
                      <span className={cn("font-extrabold text-sm", isSelected ? "text-[#0D2240]" : "text-gray-700")}>{s.label}</span>
                      <div className="text-right">
                        {promoActive ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-xs line-through text-red-400 font-semibold">{origPrice}</span>
                            <span className="font-extrabold text-sm text-[#E8726A]">${(promoPriceCents / 100).toFixed(0)}</span>
                            {promoSavings && (
                              <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1 py-0.5 rounded">SAVE</span>
                            )}
                          </div>
                        ) : (
                          <span className={cn("font-extrabold text-sm", isSelected ? "text-[#E8726A]" : "text-gray-400")}>{origPrice}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 block mb-3">{s.note}</span>

                    {/* Per-tile counter */}
                    <div className="flex items-center justify-between">
                      <button type="button"
                        onClick={() => setQty(s.id as SizeId, -1)}
                        disabled={qty <= 0}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 font-bold text-lg flex items-center justify-center transition-colors",
                          qty > 0
                            ? "border-[#0D2240] text-[#0D2240] hover:bg-[#0D2240] hover:text-white"
                            : "border-gray-200 text-gray-300 cursor-not-allowed"
                        )}>
                        −
                      </button>
                      <span className={cn("text-2xl font-extrabold tabular-nums min-w-[2rem] text-center",
                        isSelected ? "text-[#0D2240]" : "text-gray-300")}>
                        {qty}
                      </span>
                      <button type="button"
                        onClick={() => setQty(s.id as SizeId, 1)}
                        className="w-8 h-8 rounded-full border-2 border-[#0D2240] text-[#0D2240] font-bold text-lg flex items-center justify-center hover:bg-[#0D2240] hover:text-white transition-colors">
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total line */}
            {totalCount > 0 && (
              <div className="bg-[#fdf6f5] rounded-xl p-4 flex items-center justify-between">
                <div className="text-sm text-[#0D2240]/60 font-medium">
                  {selectedSizes.map(s => `${quantities[s.id as SizeId]}× ${s.label}`).join(", ")}
                </div>
                <span className="text-2xl font-extrabold text-[#E8726A]">${(subtotalCents / 100).toFixed(2)}</span>
              </div>
            )}

            {totalCount === 0 && (
              <p className="text-xs text-center text-gray-400">Add at least one comforter to continue</p>
            )}

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

            {/* Dates */}
            <div className="space-y-6 border-t border-gray-100 pt-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-[#E8726A] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <h4 className="font-bold text-[#0D2240] text-sm">{tb.pickupDateTitle}</h4>
                  <span className="text-xs text-gray-400">— {tb.pickupDaysNote}</span>
                </div>
                <p className="text-xs text-gray-400 mb-4 ml-6">{tb.pickupWhen}</p>
                <DateStrip label="" selected={formData.pickupDate} onSelect={handlePickupSelect} isAvailable={isPickupAvailable} tomorrow={tf.tomorrow} />
                {formData.pickupDate && (
                  <TimeSlotPicker
                    label={tf.availableTimeSlots}
                    value={formData.pickupTimeWindow}
                    onChange={v => setFormData(p => ({ ...p, pickupTimeWindow: v }))}
                    windows={getTimeWindowsForDate(formData.pickupDate, activeRoutes, "pickup")}
                  />
                )}
              </div>

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
                  <DateStrip label="" selected={formData.deliveryDate} onSelect={d => setFormData(p => ({ ...p, deliveryDate: d }))} isAvailable={isDeliveryAvailable} tomorrow={tf.tomorrow} />
                  {formData.deliveryDate && (
                    <TimeSlotPicker
                      label={tf.availableTimeSlots}
                      value={formData.deliveryTimeWindow}
                      onChange={v => setFormData(p => ({ ...p, deliveryTimeWindow: v }))}
                      windows={getTimeWindowsForDate(formData.deliveryDate, activeRoutes, "delivery")}
                    />
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
              <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">{tb.customizeWash}</h3>
              <p className="text-sm text-gray-400">{tb.addOnsOptional}</p>
            </div>

            {detergentOptions.length > 0 && (
              <div>
                <h4 className="font-bold text-[#0D2240] text-sm mb-3">{tf.detergentPreference}</h4>
                <div className="space-y-2">
                  {detergentOptions.map(opt => (
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
                  {extraOptions.map(addon => (
                    <label key={addon.id}
                      className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                        formData.selectedExtras[addon.id] ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white hover:border-gray-200")}>
                      <Checkbox
                        checked={!!formData.selectedExtras[addon.id]}
                        onCheckedChange={c => setFormData(p => ({ ...p, selectedExtras: { ...p.selectedExtras, [addon.id]: c as boolean } }))}
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
              <p className="text-sm text-gray-400">{tf.contactInfoSubtitle}</p>
            </div>

            <div className="space-y-4">
              {CONTACT_FIELDS.map(({ label, key, placeholder, type }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="font-semibold text-[#0D2240] text-sm">{label}</Label>
                  <Input type={type} placeholder={placeholder}
                    value={(formData as Record<string, unknown>)[key] as string}
                    onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                    onBlur={key === "email" ? handleEmailBlur : undefined}
                    className="h-12 border-gray-200 focus:border-[#E8726A] text-sm" />

                  {/* ── Auth section — shown only for recognized (returning) customers ── */}
                  {key === "email" && emailCheckState === "otp_sent" && (

                    <div className="rounded-xl bg-[#f8fafc] border border-gray-100 p-4 space-y-3 mt-1">

                      {/* OTP entry — shown when email was recognized */}
                      {emailCheckState === "otp_sent" && (
                        <>
                          <p className="text-sm font-semibold text-[#0D2240]">
                            👋 Welcome back! Enter the 6-digit code we sent to <span className="text-[#E8726A]">{formData.email}</span>
                          </p>
                          <div className="flex gap-2">
                            <Input
                              value={otpCode}
                              onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              placeholder="000000" inputMode="numeric" maxLength={6}
                              className="font-mono text-center text-lg tracking-widest h-11 border-gray-200 focus:border-[#E8726A] w-36"
                            />
                            <button type="button" onClick={verifyOtp}
                              disabled={otpCode.length < 6 || otpLoading}
                              className="flex-1 bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors px-4">
                              {otpLoading ? "Verifying…" : "Sign in →"}
                            </button>
                          </div>
                          {otpError && <p className="text-xs text-red-500">{otpError}</p>}
                          <button type="button" onClick={() => setEmailCheckState("idle")}
                            className="text-xs text-gray-400 underline">
                            Continue without signing in
                          </button>
                          <div className="relative flex items-center gap-2 py-1">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="text-xs text-gray-400">or sign in with</span>
                            <div className="flex-1 border-t border-gray-200" />
                          </div>
                        </>
                      )}

                      {/* Phone OTP entry */}
                      {authMethod === "phone" && !phoneOtpSent && (
                        <div className="space-y-2">
                          <Input type="tel" placeholder="(407) 555-0100"
                            value={phoneForAuth}
                            onChange={e => setPhoneForAuth(e.target.value)}
                            className="h-11 border-gray-200 focus:border-[#E8726A] text-sm" />
                          {phoneOtpError && <p className="text-xs text-red-500">{phoneOtpError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setAuthMethod("")}
                              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-400 transition-colors">
                              Back
                            </button>
                            <button type="button" onClick={sendPhoneOtp} disabled={phoneOtpLoading}
                              className="flex-[2] h-10 rounded-xl bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white text-sm font-bold transition-colors">
                              {phoneOtpLoading ? "Sending…" : "Send code →"}
                            </button>
                          </div>
                        </div>
                      )}

                      {authMethod === "phone" && phoneOtpSent && (
                        <div className="space-y-2">
                          <p className="text-sm text-[#0D2240]">Enter the code sent to <strong>{phoneForAuth}</strong></p>
                          <div className="flex gap-2">
                            <Input value={phoneOtpCode}
                              onChange={e => setPhoneOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              placeholder="000000" inputMode="numeric" maxLength={6}
                              className="font-mono text-center text-lg tracking-widest h-11 border-gray-200 focus:border-[#E8726A] w-36" />
                            <button type="button" onClick={verifyPhoneOtp}
                              disabled={phoneOtpCode.length < 6 || phoneOtpLoading}
                              className="flex-1 bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors">
                              {phoneOtpLoading ? "Verifying…" : "Sign in →"}
                            </button>
                          </div>
                          {phoneOtpError && <p className="text-xs text-red-500">{phoneOtpError}</p>}
                        </div>
                      )}

                      {/* 3 auth buttons — always shown unless phone flow is active */}
                      {authMethod !== "phone" && (
                        <div className="space-y-2">
                          <button type="button" onClick={handleGoogleAuth}
                            className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl border border-gray-200 bg-white hover:border-[#0D2240] transition-colors text-sm font-semibold text-[#0D2240]">
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continue with Google
                          </button>
                          <button type="button" onClick={() => setAuthMethod("phone")}
                            className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl border border-gray-200 bg-white hover:border-[#0D2240] transition-colors text-sm font-semibold text-[#0D2240]">
                            📱 Continue with Phone
                          </button>
                          <button type="button" onClick={sendEmailOtp} disabled={!formData.email.includes("@")}
                            className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl border border-gray-200 bg-white hover:border-[#0D2240] disabled:opacity-40 transition-colors text-sm font-semibold text-[#0D2240]">
                            ✉️ Continue with Email
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Verified badge */}
                  {key === "email" && emailCheckState === "verified" && (
                    <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2 mt-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <p className="text-sm text-green-700 font-semibold">Signed in — your info was pre-filled.</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Pickup address */}
              <div className="space-y-2">
                <Label className="font-semibold text-[#0D2240] text-sm">{tf.pickupAddressLabel}</Label>
                <AddressAutocomplete
                  value={formData.pickupStreet}
                  onChange={street => setFormData(p => ({ ...p, pickupStreet: street }))}
                  onPlaceSelect={parts => setFormData(p => ({ ...p, pickupStreet: parts.street, pickupCity: parts.city, pickupState: parts.state, pickupZip: parts.zip }))}
                />
                <div className="grid gap-2 min-w-0" style={{ gridTemplateColumns: "2fr 1fr 2fr" }}>
                  <Input placeholder="City" value={formData.pickupCity}
                    onChange={e => setFormData(p => ({ ...p, pickupCity: e.target.value }))}
                    className="min-w-0 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                  <Input placeholder="ST" maxLength={2} value={formData.pickupState}
                    onChange={e => setFormData(p => ({ ...p, pickupState: e.target.value.toUpperCase() }))}
                    className="min-w-0 h-10 border-gray-200 focus:border-[#E8726A] text-sm text-center uppercase" />
                  <Input placeholder="Zip" value={formData.pickupZip}
                    onChange={e => setFormData(p => ({ ...p, pickupZip: e.target.value }))}
                    className="min-w-0 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                </div>
              </div>

              {/* Same address toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                <Checkbox checked={formData.sameAddress} onCheckedChange={c => setFormData(p => ({ ...p, sameAddress: c as boolean }))} />
                <span className="text-sm text-gray-700 font-medium">{tf.sameAddressLabel}</span>
              </label>

              {/* Delivery address (shown when different) */}
              {!formData.sameAddress && (
                <div className="space-y-2">
                  <Label className="font-semibold text-[#0D2240] text-sm">{tf.deliveryAddressLabel}</Label>
                  <AddressAutocomplete
                    value={formData.deliveryStreet}
                    onChange={street => setFormData(p => ({ ...p, deliveryStreet: street }))}
                    onPlaceSelect={parts => setFormData(p => ({ ...p, deliveryStreet: parts.street, deliveryCity: parts.city, deliveryState: parts.state, deliveryZip: parts.zip }))}
                  />
                  <div className="grid gap-2 min-w-0" style={{ gridTemplateColumns: "2fr 1fr 2fr" }}>
                    <Input placeholder="City" value={formData.deliveryCity}
                      onChange={e => setFormData(p => ({ ...p, deliveryCity: e.target.value }))}
                      className="min-w-0 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                    <Input placeholder="ST" maxLength={2} value={formData.deliveryState}
                      onChange={e => setFormData(p => ({ ...p, deliveryState: e.target.value.toUpperCase() }))}
                      className="min-w-0 h-10 border-gray-200 focus:border-[#E8726A] text-sm text-center uppercase" />
                    <Input placeholder="Zip" value={formData.deliveryZip}
                      onChange={e => setFormData(p => ({ ...p, deliveryZip: e.target.value }))}
                      className="min-w-0 h-10 border-gray-200 focus:border-[#E8726A] text-sm" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(2)}>{tf.back}</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]" disabled={!canStep3} onClick={() => setStep(4)}>
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

            <div className="rounded-2xl bg-[#fdf6f5] p-5 space-y-2.5 text-sm">
              {[
                { label: tf.labelPickup,    value: formData.pickupDate ? `${format(formData.pickupDate, "EEE, MMM d")} · ${formData.pickupTimeWindow}` : "" },
                { label: tf.labelDelivery,  value: formData.deliveryDate ? `${format(formData.deliveryDate, "EEE, MMM d")} · ${formData.deliveryTimeWindow}` : "" },
                { label: tf.pickupAddressLabel,  value: buildAddr(formData.pickupStreet, formData.pickupCity, formData.pickupState, formData.pickupZip) },
                ...(!formData.sameAddress ? [{ label: tf.deliveryAddressLabel, value: buildAddr(formData.deliveryStreet, formData.deliveryCity, formData.deliveryState, formData.deliveryZip) }] : []),
                { label: tf.labelAddOns,    value: addOnsSummary },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-gray-400 shrink-0">{row.label}</span>
                  <span className="font-medium text-[#0D2240] text-right">{row.value}</span>
                </div>
              ))}
              {/* Per-size breakdown */}
              {selectedSizes.map(s => {
                const qty = quantities[s.id as SizeId]
                const linePrice = promoActive ? qty * promoPriceCents : qty * s.cents
                return (
                  <div key={s.id} className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0 flex items-center gap-1.5">
                      {s.label} × {qty}
                      {promoActive && <span className="text-[9px] bg-[#E8726A]/10 text-[#E8726A] font-bold px-1 rounded">$33 ea</span>}
                    </span>
                    <span className="font-medium text-[#0D2240]">${(linePrice / 100).toFixed(2)}</span>
                  </div>
                )
              })}
              {discountCents > 0 && (
                <div className="flex justify-between gap-4 text-green-600">
                  <span>{tf.promo} ({promo!.code})</span>
                  <span className="font-semibold">−${(discountCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#0D2240]/10 pt-2.5 flex justify-between font-extrabold text-base">
                <span className="text-[#0D2240]">{tf.total}</span>
                <span className="text-[#E8726A]">${totalDisplay}</span>
              </div>
            </div>

            <PromoCodeField
              serviceType="comforter_wash"
              subtotalCents={subtotalCents}
              onApply={(code, dc) => setPromo({ code, discountCents: dc })}
              onRemove={() => setPromo(null)}
            />

            {/* Tip selector */}
            {tipsEnabled && <div className="rounded-2xl border border-gray-200 p-4">
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
            </div>}

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

            {/* ── Required agreements + signature ── */}
            <div className="rounded-2xl border-2 border-[#E8726A]/25 bg-[#fdf6f5]/60 p-4 space-y-3">
              {/* Terms */}
              <label className={`flex items-start gap-3 cursor-pointer rounded-xl border-2 p-3 transition-all ${formData.agreedToTerms ? "border-green-300 bg-green-50" : "border-dashed border-gray-300 bg-white hover:border-[#E8726A]/50"}`}>
                <Checkbox checked={formData.agreedToTerms} onCheckedChange={c => setFormData(p => ({ ...p, agreedToTerms: c as boolean }))} className="mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700 leading-relaxed">
                  {tf.agreeTerms}
                  {!formData.agreedToTerms && <span className="ml-1.5 text-[#E8726A] font-bold text-[11px]">← required</span>}
                </span>
              </label>

              {/* SMS consent */}
              <label className={`flex items-start gap-3 cursor-pointer rounded-xl border-2 p-3 transition-all ${formData.smsConsent ? "border-green-300 bg-green-50" : "border-dashed border-gray-300 bg-white hover:border-[#E8726A]/50"}`}>
                <Checkbox checked={formData.smsConsent} onCheckedChange={c => setFormData(p => ({ ...p, smsConsent: c as boolean }))} className="mt-0.5 shrink-0" />
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
                    onChange={e => setFormData(p => ({ ...p, signature: e.target.value }))}
                    className="h-13 font-serif text-xl italic border-0 bg-transparent focus-visible:ring-0 shadow-none" />
                </div>
                <p className="text-xs text-gray-500 font-semibold">{tf.signatureNote}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12 text-sm" onClick={() => setStep(3)}>{tf.back}</Button>
              <Button className="flex-[2] h-12 text-sm font-bold bg-[#0D2240] hover:bg-[#1a3a5c]" disabled={!canStep4} onClick={() => setStep("payment")}>
                {tf.proceedToPayment}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
