"use client"

import Link from "next/link"
import { PlatformDemoForm } from "@/components/platform-demo-form"
import { LangToggle } from "@/components/lang-toggle"
import { useLang } from "@/components/lang-provider"

// Metadata for this route lives in app/platform/layout.tsx — client
// components can't export `metadata`.

const FEATURES: { icon: string; en: { title: string; desc: string }; es: { title: string; desc: string } }[] = [
  { icon: "🏠", en: { title: "No Laundromat Required", desc: "Built for operators who don't own a facility — run everything from home, or partner with a local laundromat as your processing facility for anything that doesn't fit a home machine. Most platforms assume you own a plant; we don't." },
    es: { title: "No Necesitas una Lavandería Propia", desc: "Diseñado para operadores que no son dueños de una planta — maneja todo desde casa, o asóciate con una lavandería local como tu instalación de procesamiento para lo que no quepa en una máquina casera. La mayoría de plataformas asumen que tienes una planta; la nuestra no." } },
  { icon: "🎨", en: { title: "Your Own Branded Site", desc: "Your business name, logo, and colors — plus a bilingual English/Spanish site out of the box." },
    es: { title: "Tu Propio Sitio de Marca", desc: "El nombre, logo y colores de tu negocio — además de un sitio bilingüe en inglés y español desde el primer día." } },
  { icon: "📅", en: { title: "Booking & Scheduling", desc: "Pickup/delivery time windows, route capacity limits, holiday blackout dates — all self-service." },
    es: { title: "Reservas y Horarios", desc: "Ventanas de recogida/entrega, límites de capacidad por ruta, días festivos bloqueados — todo autogestionable." } },
  { icon: "🧭", en: { title: "Simple or Advanced Admin", desc: "A condensed dashboard for solo operators who don't want the clutter, or the full toolset for teams running a facility." },
    es: { title: "Panel Simple o Avanzado", desc: "Un panel reducido para operadores individuales que no quieren complicaciones, o el set completo de herramientas para equipos que manejan una planta." } },
  { icon: "💳", en: { title: "Billing & Subscriptions", desc: "Stripe-powered one-time orders, recurring plans, tips, and promo codes." },
    es: { title: "Facturación y Suscripciones", desc: "Pedidos únicos y planes recurrentes con Stripe, propinas y códigos promocionales." } },
  { icon: "🚚", en: { title: "Driver Dispatch & Tracking", desc: "Optional Shipday integration for live tracking and customer notifications — useful whether you hire drivers or deliver yourself." },
    es: { title: "Despacho y Rastreo de Conductores", desc: "Integración opcional con Shipday para rastreo en vivo y notificaciones al cliente — útil si contratas conductores o entregas tú mismo." } },
  { icon: "✉️", en: { title: "Your Own Sending Domain", desc: "Send booking confirmations and receipts from your own email domain instead of a shared address." },
    es: { title: "Tu Propio Dominio de Envío", desc: "Envía confirmaciones de reserva y recibos desde tu propio dominio de correo en vez de una dirección compartida." } },
  { icon: "🔍", en: { title: "SEO-Ready Pages", desc: "Dedicated pages for each service and each ZIP code you serve, plus an auto-generated sitemap." },
    es: { title: "Páginas Listas para SEO", desc: "Páginas dedicadas para cada servicio y cada código postal que atiendes, más un mapa del sitio generado automáticamente." } },
  { icon: "🔒", en: { title: "PIN-Protected Worker Apps", desc: "Separate driver and operator apps so your team only sees what they need." },
    es: { title: "Apps de Trabajadores Protegidas con PIN", desc: "Apps separadas para conductores y operadores para que tu equipo solo vea lo que necesita." } },
  { icon: "🚪", en: { title: "Pickup, Delivery, or Walk-In", desc: "Offer full-service pickup & delivery, walk-in drop-off, or both." },
    es: { title: "Recogida, Entrega o Sin Cita Previa", desc: "Ofrece servicio completo de recogida y entrega, entrega sin cita previa, o ambos." } },
  { icon: "🏢", en: { title: "Commercial Accounts", desc: "A ready-made page for pitching hotels, gyms, spas, and Airbnbs on recurring commercial laundry." },
    es: { title: "Cuentas Comerciales", desc: "Una página lista para ofrecer a hoteles, gimnasios, spas y Airbnbs servicio de lavandería comercial recurrente." } },
  { icon: "✏️", en: { title: "Self-Service Site Content", desc: "Testimonials, promotions, FAQs, and offers — all editable from your dashboard, no code required." },
    es: { title: "Contenido del Sitio Autogestionable", desc: "Testimonios, promociones, preguntas frecuentes y ofertas — todo editable desde tu panel, sin necesidad de código." } },
]

const INTEGRATIONS = [
  { name: "Stripe", en: "Payments & subscriptions", es: "Pagos y suscripciones" },
  { name: "Shipday", en: "Driver dispatch & tracking", es: "Despacho y rastreo de conductores" },
  { name: "Resend", en: "Transactional email", es: "Correo transaccional" },
]

const STRINGS = {
  en: {
    demoBtn: "Request a Demo",
    eyebrow: "For Home-Based & Small Laundry Operators — No Laundromat Required",
    heroTitle: "Run your laundry business on software that grows with you",
    heroSub: "A branded booking site, an admin dashboard built for one person or a full team, billing, dispatch, and everything in between — whether you wash from your own home or partner with a local laundromat as your processing facility.",
    founderNote: "We're laundry pickup & delivery operators ourselves, not a software company guessing at what this business needs — and unlike most platforms in this space, we built it for small operators who don't own a laundromat.",
    liveTitle: "See It Running Live",
    liveSub: "Explore a live sandbox running on the same platform WashFold Orlando uses every day — browse freely, nothing you do here is a real order or charge.",
    liveLink: "Open the live example ↗",
    featuresTitle: "Everything You Need, Built In",
    featuresSub: "Every tenant gets their own site and dashboard — features below are all part of the same platform.",
    integrationsTitle: "Works With Tools You Already Trust",
    integrationsSub: "No separate accounts to juggle — connect your own and you're covered.",
    demoTitle: "See it on your own business",
    demoSub: "Tell us a bit about your laundry business and we'll set up a walkthrough — whether you're running a full facility or washing out of your own home.",
    rights: "All rights reserved.",
    pricingTitle: "Simple, Straightforward Pricing",
    pricingSub: "One setup fee to get your branded site and dashboard live, then a flat monthly rate — no per-order fees, no surprises.",
    setupLabel: "One-Time Setup",
    setupNote: "Branded site, admin dashboard, and onboarding — billed once.",
    monthlyLabel: "Monthly",
    monthlyUnit: "/month",
    monthlyNote: "Keeps your site, dashboard, and support running — cancel any time.",
    pricingCta: "Get Started",
  },
  es: {
    demoBtn: "Solicitar una Demo",
    eyebrow: "Para Operadores Caseros y Pequeños — No Necesitas una Lavandería Propia",
    heroTitle: "Maneja tu negocio de lavandería con software que crece contigo",
    heroSub: "Un sitio de reservas con tu marca, un panel de administración diseñado para una persona o un equipo completo, facturación, despacho y todo lo demás — ya sea que laves desde tu propia casa o te asocies con una lavandería local como tu instalación de procesamiento.",
    founderNote: "Somos operadores de recogida y entrega de lavandería nosotros mismos, no una empresa de software adivinando lo que este negocio necesita — y a diferencia de la mayoría de plataformas, la construimos para operadores pequeños que no son dueños de una lavandería.",
    liveTitle: "Míralo Funcionando en Vivo",
    liveSub: "Explora una demostración en vivo que corre sobre la misma plataforma que usa WashFold Orlando cada día — navega libremente, nada de lo que hagas aquí es un pedido o cobro real.",
    liveLink: "Abrir el ejemplo en vivo ↗",
    featuresTitle: "Todo lo que Necesitas, Incluido",
    featuresSub: "Cada negocio tiene su propio sitio y panel — las funciones de abajo son parte de la misma plataforma.",
    integrationsTitle: "Funciona con Herramientas en las que Ya Confías",
    integrationsSub: "Sin cuentas separadas que manejar — conecta las tuyas y listo.",
    demoTitle: "Míralo en tu propio negocio",
    demoSub: "Cuéntanos un poco sobre tu negocio de lavandería y organizaremos una demostración — ya sea que manejes una planta completa o laves desde tu propia casa.",
    rights: "Todos los derechos reservados.",
    pricingTitle: "Precios Simples y Transparentes",
    pricingSub: "Una cuota de instalación única para lanzar tu sitio y panel con tu marca, luego una tarifa mensual fija — sin cargos por pedido, sin sorpresas.",
    setupLabel: "Instalación Única",
    setupNote: "Sitio con tu marca, panel de administración, y configuración inicial — se cobra una sola vez.",
    monthlyLabel: "Mensual",
    monthlyUnit: "/mes",
    monthlyNote: "Mantiene tu sitio, panel y soporte funcionando — cancela cuando quieras.",
    pricingCta: "Comenzar",
  },
}

export default function PlatformPage() {
  const { locale } = useLang()
  const s = STRINGS[locale] ?? STRINGS.en

  return (
    <main className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link href="/platform" className="flex items-center gap-2.5">
            <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#0D2240" />
              <path d="M11 19 L17 32 L24 21 L31 32 L37 19" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.22" />
              <path d="M10 17 L16 31 L24 19 L32 31 L38 17" stroke="#E8726A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="font-extrabold text-[#0D2240] text-lg tracking-tight">WashFoldClean</span>
          </Link>
          <div className="flex items-center gap-3">
            <LangToggle variant="light" />
            <a href="#demo" className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-full transition-colors uppercase tracking-wide">
              {s.demoBtn}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#0D2240] px-4 py-20 text-center">
        <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.25em] mb-3">{s.eyebrow}</p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight max-w-3xl mx-auto leading-tight">
          {s.heroTitle}
        </h1>
        <p className="text-white/60 text-base md:text-lg mt-5 max-w-xl mx-auto leading-relaxed">
          {s.heroSub}
        </p>
        <a href="#demo" className="inline-block mt-8 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-10 py-4 rounded-full uppercase tracking-wide transition-colors shadow-lg">
          {s.demoBtn}
        </a>
        <p className="text-white/40 text-xs mt-8 max-w-lg mx-auto leading-relaxed italic">
          {s.founderNote}
        </p>
      </div>

      {/* Live example */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-extrabold text-[#0D2240] text-center mb-2">{s.liveTitle}</h2>
        <p className="text-center text-sm text-gray-400 mb-8 max-w-lg mx-auto">
          {s.liveSub}
        </p>
        <div className="rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
            <span className="w-3 h-3 rounded-full bg-red-300" />
            <span className="w-3 h-3 rounded-full bg-yellow-300" />
            <span className="w-3 h-3 rounded-full bg-green-300" />
            <span className="ml-3 text-xs text-gray-400 font-mono">comforterwash.com/demo</span>
          </div>
          <iframe
            src="https://www.comforterwash.com/demo"
            title="Live example tenant site"
            className="w-full h-[520px] border-0"
            loading="lazy"
          />
        </div>
        <div className="text-center mt-4">
          <a href="https://www.comforterwash.com/demo" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#E8726A] hover:underline">
            {s.liveLink}
          </a>
        </div>
      </div>

      {/* Features */}
      <div className="bg-[#f7f8fb] py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-extrabold text-[#0D2240] text-center mb-2">{s.featuresTitle}</h2>
          <p className="text-center text-sm text-gray-400 mb-10 max-w-lg mx-auto">
            {s.featuresSub}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => {
              const ft = f[locale] ?? f.en
              return (
                <div key={ft.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="font-extrabold text-[#0D2240] text-sm mb-1.5">{ft.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{ft.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-extrabold text-[#0D2240] mb-2">{s.integrationsTitle}</h2>
        <p className="text-sm text-gray-400 mb-8">{s.integrationsSub}</p>
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          {INTEGRATIONS.map(i => (
            <div key={i.name} className="rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="font-extrabold text-[#0D2240] text-sm">{i.name}</p>
              <p className="text-[11px] text-gray-400 mt-1">{i[locale] ?? i.en}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-extrabold text-[#0D2240] mb-2">{s.pricingTitle}</h2>
        <p className="text-sm text-gray-400 mb-10 max-w-lg mx-auto">{s.pricingSub}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border-2 border-gray-100 p-8 text-center">
            <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-3">{s.setupLabel}</p>
            <p className="text-5xl font-extrabold text-[#0D2240] mb-1">$199</p>
            <p className="text-gray-400 text-xs mt-3 leading-relaxed">{s.setupNote}</p>
          </div>
          <div className="rounded-2xl border-2 border-[#E8726A] p-8 text-center relative">
            <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-3">{s.monthlyLabel}</p>
            <p className="text-5xl font-extrabold text-[#0D2240] mb-1">$99<span className="text-xl font-bold text-gray-400">{s.monthlyUnit}</span></p>
            <p className="text-gray-400 text-xs mt-3 leading-relaxed">{s.monthlyNote}</p>
          </div>
        </div>
        <a href="#demo" className="inline-block mt-10 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-10 py-4 rounded-full uppercase tracking-wide transition-colors shadow-lg">
          {s.pricingCta}
        </a>
      </div>

      {/* Demo request */}
      <div id="demo" className="bg-[#0D2240] py-16 px-4">
        <div className="max-w-3xl mx-auto grid gap-10 md:grid-cols-2 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">{s.demoTitle}</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              {s.demoSub}
            </p>
          </div>
          <PlatformDemoForm />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8 px-4 text-center">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} WashFoldClean. {s.rights}</p>
      </footer>
    </main>
  )
}
