"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useLang } from "@/components/lang-provider"

const Checkout = dynamic(() => import("@/components/checkout"), { ssr: false })

const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200]

const STRINGS = {
  en: {
    eyebrow: "Gift Cards",
    heroTitle: "Give the Gift of Freedom from Laundry",
    heroSub: "One less thing on their to-do list. A gift card they can use toward comforter wash, wash & fold, or wash only — no expiration, no strings attached.",
    amountLabel: "Choose an amount",
    customLabel: "Custom amount",
    recipientHeading: "Who's it for?",
    recipientName: "Recipient's Name",
    recipientEmail: "Recipient's Email",
    recipientEmailNote: "We'll email the gift card directly to them.",
    messageLabel: "Add a personal message (optional)",
    messagePlaceholder: "Enjoy a well-deserved break from laundry!",
    purchaserHeading: "Your Info",
    purchaserName: "Your Name",
    purchaserEmail: "Your Email",
    continueBtn: "Continue to Payment",
    backBtn: "← Back",
    successTitle: "Gift card sent!",
    successCode: "Redemption Code",
    successNote: "We've also emailed this code to the recipient. Save it just in case.",
    buyAnother: "Send another gift card",
    required: "Please fill in the required fields.",
  },
  es: {
    eyebrow: "Tarjetas de Regalo",
    heroTitle: "Regala la Libertad de No Lavar Ropa",
    heroSub: "Una cosa menos en su lista de pendientes. Una tarjeta de regalo que pueden usar en lavado de edredones, lavado y doblado, o solo lavado — sin vencimiento, sin condiciones.",
    amountLabel: "Elige un monto",
    customLabel: "Monto personalizado",
    recipientHeading: "¿Para quién es?",
    recipientName: "Nombre del Destinatario",
    recipientEmail: "Correo del Destinatario",
    recipientEmailNote: "Le enviaremos la tarjeta de regalo directamente por correo.",
    messageLabel: "Agrega un mensaje personal (opcional)",
    messagePlaceholder: "¡Disfruta un descanso merecido de la lavandería!",
    purchaserHeading: "Tu Información",
    purchaserName: "Tu Nombre",
    purchaserEmail: "Tu Correo",
    continueBtn: "Continuar al Pago",
    backBtn: "← Atrás",
    successTitle: "¡Tarjeta de regalo enviada!",
    successCode: "Código de Canje",
    successNote: "También enviamos este código al destinatario por correo. Guárdalo por si acaso.",
    buyAnother: "Enviar otra tarjeta de regalo",
    required: "Por favor completa los campos requeridos.",
  },
}

export default function GiftCardsPage() {
  const { locale } = useLang()
  const s = STRINGS[locale] ?? STRINGS.en

  const [amount, setAmount] = useState<number>(50)
  const [customAmount, setCustomAmount] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [message, setMessage] = useState("")
  const [purchaserName, setPurchaserName] = useState("")
  const [purchaserEmail, setPurchaserEmail] = useState("")
  const [step, setStep] = useState<"form" | "pay" | "done">("form")
  const [error, setError] = useState("")
  const [giftCardCode, setGiftCardCode] = useState<string | null>(null)

  const amountCents = Math.round((useCustom ? parseFloat(customAmount || "0") : amount) * 100)

  function handleContinue() {
    setError("")
    if (!purchaserName.trim() || !purchaserEmail.trim() || amountCents < 500) {
      setError(s.required)
      return
    }
    setStep("pay")
  }

  function reset() {
    setStep("form")
    setGiftCardCode(null)
    setRecipientName("")
    setRecipientEmail("")
    setMessage("")
    setPurchaserName("")
    setPurchaserEmail("")
    setAmount(50)
    setUseCustom(false)
    setCustomAmount("")
  }

  return (
    <main className="min-h-screen bg-white font-sans">
      {/* Hero */}
      <div className="bg-[var(--brand-primary)] px-4 py-16 text-center">
        <p className="text-[var(--brand-accent)] font-bold text-xs uppercase tracking-[0.25em] mb-3">{s.eyebrow}</p>
        <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight max-w-2xl mx-auto leading-tight">
          {s.heroTitle}
        </h1>
        <p className="text-white/60 text-base mt-5 max-w-xl mx-auto leading-relaxed">
          {s.heroSub}
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-14">
        {step === "done" && giftCardCode ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4 text-3xl">🎁</div>
            <p className="text-[var(--brand-primary)] font-extrabold text-xl mb-4">{s.successTitle}</p>
            <div className="bg-[var(--brand-primary)] rounded-2xl p-6 mb-4">
              <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1">{s.successCode}</p>
              <p className="text-[var(--brand-accent)] text-2xl font-extrabold tracking-widest font-mono">{giftCardCode}</p>
            </div>
            <p className="text-gray-400 text-sm mb-6">{s.successNote}</p>
            <button onClick={reset} className="text-sm font-bold text-[var(--brand-accent)] hover:underline">
              {s.buyAnother}
            </button>
          </div>
        ) : step === "pay" ? (
          <div>
            <button onClick={() => setStep("form")} className="text-sm font-bold text-gray-400 hover:text-[var(--brand-primary)] mb-4">
              {s.backBtn}
            </button>
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 text-center">
              <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Gift Card</p>
              <p className="text-[var(--brand-primary)] text-3xl font-extrabold">${(amountCents / 100).toFixed(2)}</p>
            </div>
            <Checkout
              amountCents={amountCents}
              label={`Gift Card — $${(amountCents / 100).toFixed(2)}`}
              metadata={{
                type: "gift_card",
                purchaserName,
                purchaserEmail,
                recipientName,
                recipientEmail,
                message,
              }}
              onSuccess={(result) => {
                if (result?.giftCardCode) setGiftCardCode(result.giftCardCode)
                setStep("done")
              }}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
            {/* Amount picker */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">{s.amountLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setAmount(a); setUseCustom(false) }}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                      !useCustom && amount === a
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]"
                        : "border-gray-100 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <input
                  type="number" min="5" step="1"
                  value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); setUseCustom(true) }}
                  onFocus={() => setUseCustom(true)}
                  placeholder={s.customLabel}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors ${
                    useCustom ? "border-[var(--brand-accent)]" : "border-gray-100"
                  }`}
                />
              </div>
            </div>

            {/* Recipient */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">{s.recipientHeading}</p>
              <div className="space-y-3">
                <input
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder={s.recipientName}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/40 focus:border-[var(--brand-accent)]"
                />
                <div>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder={s.recipientEmail}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/40 focus:border-[var(--brand-accent)]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">{s.recipientEmailNote}</p>
                </div>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{s.messageLabel}</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder={s.messagePlaceholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/40 focus:border-[var(--brand-accent)]"
              />
            </div>

            {/* Purchaser */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">{s.purchaserHeading}</p>
              <div className="space-y-3">
                <input
                  value={purchaserName}
                  onChange={e => setPurchaserName(e.target.value)}
                  placeholder={s.purchaserName + " *"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/40 focus:border-[var(--brand-accent)]"
                />
                <input
                  type="email"
                  value={purchaserEmail}
                  onChange={e => setPurchaserEmail(e.target.value)}
                  placeholder={s.purchaserEmail + " *"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/40 focus:border-[var(--brand-accent)]"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            <button
              onClick={handleContinue}
              className="w-full bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3.5 rounded-full transition-colors uppercase tracking-wide"
            >
              {s.continueBtn} — ${(amountCents / 100).toFixed(2)}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
