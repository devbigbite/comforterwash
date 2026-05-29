import Link from "next/link"
import { CommercialForm } from "@/components/CommercialForm"

export const metadata = {
  title: "Commercial Laundry Services — WashFold Orlando",
  description:
    "Effective laundry pickup & delivery for Orlando businesses. Hotels, Airbnb hosts, gyms, spas, restaurants, medical offices and more. Get a custom quote today.",
}

const INDUSTRIES = [
  {
    icon: "🏡",
    title: "Guesthouses & Bed & Breakfast",
    desc: "Sheets, pillowcases, towels, and robes — cleaned on a reliable schedule so your rooms are always guest-ready.",
  },
  {
    icon: "🏡",
    title: "Airbnb & Short-Term Rentals",
    desc: "Turnover laundry between guests without lifting a finger. We pick up dirty linens and deliver fresh ones on your schedule.",
  },
  {
    icon: "🏋️",
    title: "Gyms & Fitness Centers",
    desc: "Towels, workout gear, and locker room linens washed to your standards. Volume pricing available.",
  },
  {
    icon: "💆",
    title: "Spas & Salons",
    desc: "Robes, towels, and treatment linens handled with care. Consistent quality your clients will notice.",
  },
  {
    icon: "🍽️",
    title: "Restaurants & Cafés",
    desc: "Table linens, aprons, chef coats, and bar rags. Keep your front and back of house looking sharp.",
  },
  {
    icon: "🏥",
    title: "Medical & Dental Offices",
    desc: "Scrubs, lab coats, and patient gowns cleaned with clinical attention to detail and hygiene.",
  },
  {
    icon: "👷",
    title: "Construction & Contractors",
    desc: "Work uniforms, safety vests, and heavy-duty gear — we handle the tough stuff so your crew stays professional.",
  },
  {
    icon: "💼",
    title: "Offices & Co-Working Spaces",
    desc: "Kitchen towels, cleaning cloths, and branded uniforms refreshed weekly without any hassle.",
  },
]

const BENEFITS = [
  {
    icon: "📅",
    title: "Flexible Schedules",
    desc: "Daily, weekly, or custom pickup & delivery windows built around your business hours.",
  },
  {
    icon: "💰",
    title: "Volume Pricing",
    desc: "The more you wash, the more you save. Custom per-pound rates for commercial accounts.",
  },
  {
    icon: "⚡",
    title: "Fast Turnaround",
    desc: "24–48 hour turnaround as standard. Rush service available for urgent needs.",
  },
  {
    icon: "🔒",
    title: "No Long-Term Contracts",
    desc: "Month-to-month service with no hidden fees. Cancel or adjust anytime.",
  },
  {
    icon: "📍",
    title: "Orlando-Based",
    desc: "Local team, local reliability. We know Orlando and we show up on time, every time.",
  },
  {
    icon: "🧺",
    title: "Dedicated Account Setup",
    desc: "We learn your preferences once — detergent, fold style, sorting — and repeat them every time.",
  },
]

const STEPS = [
  {
    num: "1",
    title: "Request a Quote",
    desc: "Tell us about your business, volume, and frequency. We'll put together a custom pricing proposal.",
  },
  {
    num: "2",
    title: "We Set Up Your Account",
    desc: "We schedule your first pickup, note your preferences, and assign a dedicated pickup window.",
  },
  {
    num: "3",
    title: "Sit Back & Let Us Handle It",
    desc: "Recurring pickup & delivery on autopilot. Clean laundry, every time, without the hassle.",
  },
]

export default function CommercialPage() {


  return (
    <main className="min-h-screen bg-[#f7f8fb]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#0D2240] px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block bg-[#E8726A]/20 text-[#E8726A] text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
            Commercial Services
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-5">
            Effective Laundry Service for<br />
            <span className="text-[#E8726A]">Orlando Businesses</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            Reliable pickup &amp; delivery laundry service for hotels, Airbnbs, gyms, spas, restaurants, and more.
            Custom pricing, flexible schedules, no contracts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#request-bid"
              className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold text-sm uppercase tracking-widest px-8 py-4 rounded-full transition-colors"
            >
              Request a Quote →
            </a>
          </div>
        </div>
      </section>

      {/* ── Industries ─────────────────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D2240] mb-3">Industries We Serve</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
              From a single Airbnb to a multi-location gym chain — if your business generates laundry, we can handle it.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INDUSTRIES.map((ind) => (
              <div
                key={ind.title}
                className="bg-[#f7f8fb] rounded-2xl p-5 border border-gray-100 hover:border-[#E8726A]/30 hover:shadow-sm transition-all"
              >
                <div className="text-3xl mb-3">{ind.icon}</div>
                <h3 className="font-extrabold text-[#0D2240] text-sm mb-1.5">{ind.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{ind.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-[#f7f8fb]">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D2240] mb-3">How It Works</h2>
            <p className="text-gray-500 text-sm">Getting started takes less than 10 minutes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-14 h-14 rounded-full bg-[#0D2240] text-white font-extrabold text-xl flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="font-extrabold text-[#0D2240] mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D2240] mb-3">Why WashFold for Business?</h2>
            <p className="text-gray-500 text-sm">We built our service around reliability — because your business depends on it.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4 p-5 rounded-2xl bg-[#f7f8fb] border border-gray-100">
                <div className="text-2xl shrink-0 mt-0.5">{b.icon}</div>
                <div>
                  <h3 className="font-extrabold text-[#0D2240] text-sm mb-1">{b.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Request a Bid Form ───────────────────────────────────────────────── */}
      <section id="request-bid" className="bg-[#0D2240] px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🧺</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Request a Bid
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Fill in your details and we&apos;ll reply within one business day with a custom quote.
            </p>
          </div>
          <CommercialForm />
        </div>
      </section>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <section className="bg-[#f7f8fb] px-4 py-8 text-center border-t border-gray-100">
        <p className="text-gray-400 text-xs">
          WashFold Orlando · Commercial Laundry Pickup &amp; Delivery ·{" "}
          <Link href="/" className="text-[#E8726A] hover:underline">Back to Home</Link>
        </p>
      </section>

    </main>
  )
}
