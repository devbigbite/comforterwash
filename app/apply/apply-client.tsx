"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { submitApplication } from "@/app/actions/workers"
import { getIcAgreement } from "@/app/actions/ic-agreements"

// ── Translations ──────────────────────────────────────────────────────────────

const T = {
  en: {
    hiring:        "We're Hiring",
    hero_title:    "Join the WashFold Team",
    hero_sub:      "Wash & fold, drive deliveries, or both. Flexible hours, competitive pay, and weekly direct deposit via Stripe.",
    back:          "← Back to site",
    role_driver_title: "Driver",
    role_driver_sub:   "Pickup & delivery routes. Pay per order + mileage.",
    role_op_title: "Washing Operator",
    role_op_sub:   "Wash & fold at partner facilities. Paid hourly + mileage.",
    role_both_title: "Both",
    role_both_sub:   "Do both roles for maximum earning flexibility.",
    your_info:     "Your Information",
    name_label:    "Full Name",
    email_label:   "Email Address",
    phone_label:   "Phone Number",
    address_label: "Your Address",
    role_label:    "I want to work as...",
    role_driver:   "Driver",
    role_op:       "Washing Operator",
    role_both:     "Washing Operator / Driver",
    role_driver_sub2: "Pickup & delivery",
    role_op_sub2:     "Wash & fold at facilities",
    role_both_sub2:   "Both roles — max flexibility",
    vehicle:       "Yes, I have a reliable vehicle for deliveries",
    exp_label:     "Relevant Experience",
    exp_optional:  "(optional)",
    exp_placeholder: "Tell us about any relevant experience — delivery, laundry, customer service, etc.",
    ic_title:      "Independent Contractor Agreement",
    ic_sub:        "read and sign to continue",
    ic_scroll:     "⬇ Scroll to the bottom to read the full agreement",
    ic_agree:      "I have read and agree to the Independent Contractor Agreement above. I understand I am an independent contractor, not an employee.",
    ic_sign_label: "Sign below — type your full legal name",
    ic_signed:     "Agreement signed as",
    err_role:      "Please select a role.",
    err_ic:        "Please read and sign the Independent Contractor Agreement.",
    submit:        "Submit Application →",
    submitting:    "Submitting…",
    fine_print:    "By submitting you agree to a background check as part of our onboarding process. Pay is issued weekly via Stripe direct deposit.",
    success_title: "Application Received!",
    success_sub:   "Thanks for applying to join the WashFold Orlando team. We'll review your application and reach out within 2–3 business days.",
    back_home:     "Back to Home",
  },
  es: {
    hiring:        "Estamos Contratando",
    hero_title:    "Únete al Equipo de WashFold",
    hero_sub:      "Lava y dobla, haz entregas, o ambas cosas. Horario flexible, pago competitivo y depósito directo semanal vía Stripe.",
    back:          "← Volver al sitio",
    role_driver_title: "Conductor",
    role_driver_sub:   "Rutas de recogida y entrega. Pago por orden + millas.",
    role_op_title: "Operador de Lavandería",
    role_op_sub:   "Lavar y doblar en instalaciones asociadas. Pago por hora + millas.",
    role_both_title: "Ambos",
    role_both_sub:   "Ambos roles para máxima flexibilidad de ingresos.",
    your_info:     "Tu Información",
    name_label:    "Nombre Completo",
    email_label:   "Correo Electrónico",
    phone_label:   "Número de Teléfono",
    address_label: "Tu Dirección",
    role_label:    "Quiero trabajar como...",
    role_driver:   "Conductor",
    role_op:       "Operador de Lavandería",
    role_both:     "Operador de Lavandería / Conductor",
    role_driver_sub2: "Recogida y entrega",
    role_op_sub2:     "Lavar y doblar en instalaciones",
    role_both_sub2:   "Ambos roles — máxima flexibilidad",
    vehicle:       "Sí, tengo un vehículo confiable para entregas",
    exp_label:     "Experiencia Relevante",
    exp_optional:  "(opcional)",
    exp_placeholder: "Cuéntanos sobre tu experiencia relevante — entregas, lavandería, servicio al cliente, etc.",
    ic_title:      "Acuerdo de Contratista Independiente",
    ic_sub:        "lee y firma para continuar",
    ic_scroll:     "⬇ Desplázate hasta el final para leer el acuerdo completo",
    ic_agree:      "He leído y acepto el Acuerdo de Contratista Independiente anterior. Entiendo que soy un contratista independiente, no un empleado.",
    ic_sign_label: "Firma abajo — escribe tu nombre legal completo",
    ic_signed:     "Acuerdo firmado como",
    err_role:      "Por favor selecciona un rol.",
    err_ic:        "Por favor lee y firma el Acuerdo de Contratista Independiente.",
    submit:        "Enviar Solicitud →",
    submitting:    "Enviando…",
    fine_print:    "Al enviar, aceptas una verificación de antecedentes como parte de nuestro proceso de incorporación. El pago se realiza semanalmente mediante depósito directo vía Stripe.",
    success_title: "¡Solicitud Recibida!",
    success_sub:   "Gracias por aplicar para unirte al equipo de WashFold Orlando. Revisaremos tu solicitud y nos comunicaremos en 2–3 días hábiles.",
    back_home:     "Volver al Inicio",
  },
} as const

type Lang = keyof typeof T

// ── IC Agreement fallback text per role ───────────────────────────────────────
const IC_AGREEMENT = {
  driver: `INDEPENDENT CONTRACTOR AGREEMENT — DRIVER

This Independent Contractor Agreement ("Agreement") is entered into between WashFold Orlando ("Company") and the individual identified below ("Contractor").

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee of the Company. Contractor shall have no authority to act on behalf of or bind the Company in any manner.

2. SERVICES
Contractor agrees to perform pickup and delivery services for laundry orders as assigned through the Company's platform. Contractor sets their own schedule and accepts or declines jobs at their discretion.

3. COMPENSATION
Contractor will be compensated on a per-order and per-mile basis at rates set by the Company and communicated prior to acceptance of shifts. Payment is issued weekly via Stripe direct deposit to the Contractor's connected bank account.

4. EXPENSES & EQUIPMENT
Contractor is responsible for all expenses related to their vehicle, including fuel, insurance, maintenance, and registration. Contractor must maintain valid driver's license and personal auto insurance.

5. TAXES
As an independent contractor, Contractor is solely responsible for all federal, state, and local taxes on income earned. The Company will issue a Form 1099-NEC for earnings of $600 or more in a calendar year.

6. BACKGROUND CHECK
Contractor consents to a background check as a condition of onboarding.

7. CONFIDENTIALITY
Contractor agrees to keep all customer information, route details, and business information confidential.

8. TERMINATION
Either party may terminate this Agreement at any time with no notice required.

9. GOVERNING LAW
This Agreement is governed by the laws of the State of Florida.`,

  operator: `INDEPENDENT CONTRACTOR AGREEMENT — WASHING OPERATOR

This Independent Contractor Agreement ("Agreement") is entered into between WashFold Orlando ("Company") and the individual identified below ("Contractor").

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee of the Company. Contractor shall have no authority to act on behalf of or bind the Company in any manner.

2. SERVICES
Contractor agrees to perform washing and folding services at designated partner laundry facilities as assigned through the Company's platform. Contractor sets their own schedule and accepts or declines jobs at their discretion.

3. COMPENSATION
Contractor will be compensated on an hourly and per-mile basis at rates set by the Company and communicated prior to acceptance of shifts. Payment is issued weekly via Stripe direct deposit to the Contractor's connected bank account.

4. EXPENSES
Contractor is responsible for transportation to and from assigned facilities. Mileage reimbursement is included in the per-mile compensation rate.

5. TAXES
As an independent contractor, Contractor is solely responsible for all federal, state, and local taxes on income earned. The Company will issue a Form 1099-NEC for earnings of $600 or more in a calendar year.

6. BACKGROUND CHECK
Contractor consents to a background check as a condition of onboarding.

7. CONFIDENTIALITY
Contractor agrees to keep all customer information and business information confidential.

8. TERMINATION
Either party may terminate this Agreement at any time with no notice required.

9. GOVERNING LAW
This Agreement is governed by the laws of the State of Florida.`,

  combo: `INDEPENDENT CONTRACTOR AGREEMENT — WASHING OPERATOR / DRIVER

This Independent Contractor Agreement ("Agreement") is entered into between WashFold Orlando ("Company") and the individual identified below ("Contractor").

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee of the Company. Contractor shall have no authority to act on behalf of or bind the Company in any manner.

2. SERVICES
Contractor agrees to perform both (a) pickup and delivery services for laundry orders and (b) washing and folding services at designated partner laundry facilities, as assigned through the Company's platform. Contractor sets their own schedule and accepts or declines jobs at their discretion.

3. COMPENSATION
Contractor will be compensated on a per-order, per-mile, and hourly basis depending on the type of shift accepted, at rates set by the Company and communicated prior to acceptance. Payment is issued weekly via Stripe direct deposit to the Contractor's connected bank account.

4. EXPENSES & EQUIPMENT
Contractor is responsible for all expenses related to their vehicle, including fuel, insurance, maintenance, and registration. Contractor must maintain valid driver's license and personal auto insurance.

5. TAXES
As an independent contractor, Contractor is solely responsible for all federal, state, and local taxes on income earned. The Company will issue a Form 1099-NEC for earnings of $600 or more in a calendar year.

6. BACKGROUND CHECK
Contractor consents to a background check as a condition of onboarding.

7. CONFIDENTIALITY
Contractor agrees to keep all customer information, route details, and business information confidential.

8. TERMINATION
Either party may terminate this Agreement at any time with no notice required.

9. GOVERNING LAW
This Agreement is governed by the laws of the State of Florida.`,
}

type Role = "driver" | "operator" | "combo" | null

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#0D2240" />
      <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
        stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

const ROLE_LABELS: Record<NonNullable<Role>, string> = {
  driver:   "Driver",
  operator: "Washing Operator",
  combo:    "Washing Operator / Driver",
}

export function ApplyClient() {
  const searchParams = useSearchParams()
  const lang: Lang = searchParams.get("lang") === "es" ? "es" : "en"
  const t = T[lang]

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [selectedRole, setSelectedRole] = useState<Role>(null)

  // IC agreement signing state
  const [icRead, setIcRead]           = useState(false)
  const [icAgreed, setIcAgreed]       = useState(false)
  const [icSignature, setIcSignature] = useState("")
  const [icText, setIcText]           = useState<string | null>(null)

  // Load IC text from DB when role or lang changes; fall back to hardcoded
  useEffect(() => {
    if (!selectedRole) return
    setIcText(null)
    getIcAgreement(selectedRole, lang).then((text) => {
      setIcText(text ?? IC_AGREEMENT[selectedRole])
    })
  }, [selectedRole, lang])

  // Reset IC state whenever role changes
  function pickRole(role: Role) {
    setSelectedRole(role)
    setIcRead(false)
    setIcAgreed(false)
    setIcSignature("")
  }

  const icValid = icAgreed && icSignature.trim().length > 1

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedRole) {
      setErrorMsg(t.err_role)
      setStatus("error")
      return
    }
    if (!icValid) {
      setErrorMsg(t.err_ic)
      setStatus("error")
      return
    }
    setStatus("submitting")
    const fd = new FormData(e.currentTarget)
    fd.set(`role_${selectedRole}`, "on")
    fd.set("ic_signature", icSignature.trim())
    fd.set("ic_role", ROLE_LABELS[selectedRole])
    const result = await submitApplication(fd)
    if (result.success) {
      setStatus("success")
    } else {
      setErrorMsg(result.error ?? "Something went wrong.")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
          <h1 className="text-2xl font-extrabold text-[#0D2240] mb-2">{t.success_title}</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">{t.success_sub}</p>
          <Link href="/" className="inline-block bg-[#0D2240] text-white font-bold px-8 py-3 rounded-full text-sm uppercase tracking-wide hover:bg-[#1a3a5c] transition-colors">
            {t.back_home}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#0D2240] font-extrabold text-lg">
            <Logo />
            Wash<span className="text-[#E8726A]">Fold</span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
            {t.back}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#0D2240] py-10 text-center px-4">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-3">
          <span className="text-white font-bold text-sm uppercase tracking-wide">{t.hiring}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">{t.hero_title}</h1>
        <p className="text-white/60 text-sm max-w-md mx-auto">{t.hero_sub}</p>
      </div>

      <div className="mx-auto max-w-xl px-4 py-10">

        {/* Role highlights */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl mb-2">🚐</div>
            <h3 className="font-extrabold text-[#0D2240] text-xs uppercase tracking-wide mb-1">{t.role_driver_title}</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">{t.role_driver_sub}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl mb-2">🧺</div>
            <h3 className="font-extrabold text-[#0D2240] text-xs uppercase tracking-wide mb-1">{t.role_op_title}</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">{t.role_op_sub}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl mb-2">🚐🧺</div>
            <h3 className="font-extrabold text-[#0D2240] text-xs uppercase tracking-wide mb-1">{t.role_both_title}</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">{t.role_both_sub}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="font-extrabold text-[#0D2240] text-lg">{t.your_info}</h2>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">{t.name_label} *</label>
              <input name="name" required placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">{t.email_label} *</label>
              <input name="email" type="email" required placeholder="jane@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">{t.phone_label} *</label>
              <input name="phone" type="tel" required placeholder="(407) 555-0100"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">{t.address_label} *</label>
              <input name="address" required placeholder="123 Oak St, Orlando FL 32827"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>

            {/* Role selection */}
            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-3">{t.role_label} *</label>
              <div className="space-y-2">
                {([
                  { key: "driver",   emoji: "🚐",   label: t.role_driver, sub: t.role_driver_sub2 },
                  { key: "operator", emoji: "🧺",   label: t.role_op,     sub: t.role_op_sub2 },
                  { key: "combo",    emoji: "🚐🧺", label: t.role_both,   sub: t.role_both_sub2 },
                ] as const).map((r) => (
                  <label key={r.key}
                    className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${
                      selectedRole === r.key
                        ? "border-[#E8726A] bg-[#fdf6f3]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => pickRole(r.key)}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      selectedRole === r.key ? "bg-[#E8726A] border-[#E8726A]" : "border-gray-300"
                    }`}>
                      {selectedRole === r.key && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="text-base">{r.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#0D2240]">{r.label}</p>
                      <p className="text-xs text-gray-400">{r.sub}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Vehicle checkbox — shown if driver or combo */}
            {(selectedRole === "driver" || selectedRole === "combo") && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="has_vehicle" className="w-4 h-4 accent-[#E8726A]" />
                  <span className="text-sm text-gray-600">{t.vehicle}</span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">
                {t.exp_label} <span className="text-gray-400 font-normal normal-case">{t.exp_optional}</span>
              </label>
              <textarea name="experience" rows={3}
                placeholder={t.exp_placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8726A] resize-none" />
            </div>
          </div>

          {/* ── IC Agreement ── shown once a role is selected */}
          {selectedRole && (
            <div className="bg-white rounded-2xl shadow-sm border-2 border-[#0D2240]/20 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📄</span>
                <div>
                  <h2 className="font-extrabold text-[#0D2240] text-base">{t.ic_title}</h2>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[selectedRole]} — {t.ic_sub}</p>
                </div>
              </div>

              {/* Scrollable agreement text */}
              <div
                onScroll={(e) => {
                  const el = e.currentTarget
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setIcRead(true)
                }}
                className="h-52 overflow-y-auto border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-mono"
              >
                {icText === null
                  ? <span className="text-gray-400 italic">Loading agreement…</span>
                  : icText}
                <div className="h-4" />
              </div>

              {!icRead && (
                <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
                  {t.ic_scroll}
                </p>
              )}

              {icRead && (
                <>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={icAgreed}
                      onChange={(e) => setIcAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#E8726A] shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-snug">{t.ic_agree}</span>
                  </label>

                  {icAgreed && (
                    <div>
                      <label className="block text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-1.5">
                        {t.ic_sign_label} *
                      </label>
                      <input
                        type="text"
                        value={icSignature}
                        onChange={(e) => setIcSignature(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full border-b-2 border-gray-300 focus:border-[#E8726A] bg-transparent px-0 py-2 text-lg italic text-[#0D2240] focus:outline-none placeholder:text-gray-300 font-serif"
                        style={{ fontFamily: "Georgia, serif" }}
                      />
                      {icSignature.trim().length > 1 && (
                        <p className="text-xs text-green-600 font-semibold mt-1.5 flex items-center gap-1">
                          ✓ {t.ic_signed} &ldquo;{icSignature.trim()}&rdquo; — {new Date().toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting" || (selectedRole !== null && !icValid)}
            className="w-full bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold py-4 rounded-xl text-sm uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {status === "submitting" ? t.submitting : t.submit}
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">{t.fine_print}</p>
        </form>
      </div>
    </main>
  )
}
