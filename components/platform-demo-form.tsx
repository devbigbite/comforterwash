"use client"

import { useRef, useState, useTransition } from "react"
import { requestPlatformDemo } from "@/app/actions/platform-contact"
import { useLang } from "@/components/lang-provider"

const STRINGS = {
  en: {
    doneTitle: "Request received!",
    doneSub: "Check your email inbox — your customer landing page and admin dashboard are already live for you to explore.",
    name: "Your Name",
    email: "Email",
    phone: "Phone",
    business: "Business Name",
    about: "Tell us about your business",
    aboutPlaceholder: "Home-based, small facility, how many orders a week, etc.",
    sending: "Sending…",
    submit: "Request a Demo",
  },
  es: {
    doneTitle: "¡Solicitud recibida!",
    doneSub: "Revisa tu correo electrónico — tu página de aterrizaje y tu panel de administración ya están listos para explorar.",
    name: "Tu Nombre",
    email: "Correo Electrónico",
    phone: "Teléfono",
    business: "Nombre del Negocio",
    about: "Cuéntanos sobre tu negocio",
    aboutPlaceholder: "Casero, planta pequeña, cuántos pedidos por semana, etc.",
    sending: "Enviando…",
    submit: "Solicitar una Demo",
  },
}

export function PlatformDemoForm() {
  const { locale } = useLang()
  const s = STRINGS[locale] ?? STRINGS.en
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await requestPlatformDemo(fd)
      if (res?.error) setError(res.error)
      else { setDone(true); formRef.current?.reset() }
    })
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-[#0D2240] font-extrabold text-xl mb-2">{s.doneTitle}</p>
        <p className="text-gray-400 text-sm">{s.doneSub}</p>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 flex flex-col gap-4">
      <input type="hidden" name="preferred_language" value={locale} />
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{s.name} <span className="text-[#E8726A]">*</span></label>
        <input name="name" required placeholder="Jane Smith"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]" />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{s.email} <span className="text-[#E8726A]">*</span></label>
        <input name="email" type="email" required placeholder="jane@example.com"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{s.phone}</label>
          <input name="phone" type="tel" placeholder="(407) 555-0100"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{s.business}</label>
          <input name="business" placeholder="Sunshine Laundry Co."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{s.about}</label>
        <textarea name="message" rows={3} placeholder={s.aboutPlaceholder}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#E8726A]/40 focus:border-[#E8726A]" />
      </div>

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

      <button
        type="submit" disabled={pending}
        className="bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-60 text-white font-bold text-sm px-8 py-3.5 rounded-full transition-colors w-full mt-1"
      >
        {pending ? s.sending : s.submit}
      </button>
    </form>
  )
}
