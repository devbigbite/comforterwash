import { ZipChecker } from "@/components/zip-checker"
import Image from "next/image"
import Link from "next/link"

function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#0D2240" />
      <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
        stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M10 29 Q13 24 16 29 Q19 34 22 29 Q25 24 28 29 Q31 34 34 29"
        stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.25" />
    </svg>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white font-sans">

      {/* ── Top utility bar ────────────────────────────────────────────── */}
      <div className="bg-[#0D2240] text-white/70 text-xs">
        <div className="mx-auto max-w-7xl px-4 h-9 flex items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-[#E8726A]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              (407) 555-0100
            </span>
            <span className="hidden sm:inline text-white/30">|</span>
            <span className="hidden sm:inline">Mon–Fri &nbsp;8:00AM – 6:00PM</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link href="/account" className="hover:text-white transition-colors">My Account</Link>
          </div>
        </div>
      </div>

      {/* ── Main header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 h-18 flex items-center gap-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Logo size={42} />
            <div className="leading-tight">
              <span className="block text-[#0D2240] font-extrabold text-xl tracking-tight leading-none">
                Wash<span className="text-[#E8726A]">Fold</span>
              </span>
              <span className="block text-[#0D2240]/40 text-[10px] font-semibold uppercase tracking-widest">Orlando</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {[
              { label: "Services", href: "#services" },
              { label: "How It Works", href: "#how" },
              { label: "Service Areas", href: "#areas" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map((n) => (
              <a key={n.label} href={n.href} className="px-3.5 py-2 text-sm font-medium text-[#0D2240]/60 hover:text-[#E8726A] transition-colors rounded-lg hover:bg-orange-50">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex-1" />
          <a href="#services" className="shrink-0 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-full transition-colors uppercase tracking-wide shadow-sm">
            Schedule Pickup
          </a>
        </div>
      </header>

      {/* ── Hero — warm lifestyle, family-forward ─────────────────────── */}
      <section className="relative overflow-hidden bg-[#fdf6f3]" style={{ minHeight: "560px" }}>
        {/* Warm photo — prominent, not dark */}
        <div className="absolute inset-0">
          <Image
            src="/sweet-sleep.jpg"
            alt="Fresh clean laundry — WashFold Orlando"
            fill
            className="object-cover object-center opacity-45"
            priority
          />
          {/* Warm gradient from left — text readable, photo visible on right */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#fdf6f3]/95 via-[#fdf6f3]/75 to-[#fdf6f3]/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#fdf6f3]/60 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 lg:py-28 flex flex-col items-start justify-center" style={{ minHeight: "560px" }}>
          <div className="max-w-xl">
            {/* Warm eyebrow */}
            <p className="text-[#E8726A] font-bold text-sm uppercase tracking-[0.2em] mb-4">
              Orlando&apos;s Trusted Laundry Service
            </p>
            {/* Big warm headline */}
            <h1 className="text-5xl lg:text-6xl font-extrabold text-[#0D2240] leading-tight tracking-tight mb-5">
              Laundry That<br />
              <span className="text-[#E8726A]">Fits Your Life.</span>
            </h1>
            {/* Personal, family-warm subtitle */}
            <p className="text-[#0D2240]/70 text-lg leading-relaxed mb-8 max-w-md">
              We pick up, wash, fold, and deliver — so your family has fresh clothes
              without the hassle. No trips, no waiting, no stress.
            </p>
            {/* CTAs */}
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href="#services"
                className="inline-flex items-center gap-2 bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold text-base px-8 py-4 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Book a Pickup
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#how"
                className="inline-flex items-center gap-2 bg-white/90 hover:bg-white text-[#0D2240] font-bold text-base px-7 py-4 rounded-full transition-all border border-gray-200 shadow-sm"
              >
                See how it works
              </a>
            </div>
            {/* Social proof */}
            <div className="mt-10 flex items-center gap-5">
              <div className="flex -space-x-2">
                {["#E8726A", "#0D2240", "#c25a52", "#1a3a5c"].map((c, i) => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: c }}>
                    {["M", "S", "J", "K"][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[#0D2240]/60 text-xs font-medium">Loved by 200+ Orlando families</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Service selector ───────────────────────────────────────────── */}
      <section id="services" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">Our Services</p>
            <h2 className="text-3xl font-extrabold text-[#0D2240] mb-3">What Can We Wash For You?</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">We handle the laundry — you get that time back with your family.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Card 1: Comforter Wash */}
            <Link
              href="/book/comforter-wash"
              className="group relative overflow-hidden rounded-3xl border-2 border-gray-100 hover:border-[#E8726A] transition-all hover:shadow-xl cursor-pointer bg-white"
            >
              <div className="relative h-56 bg-[#0D2240] overflow-hidden">
                <Image
                  src="/sweet-sleep.jpg"
                  alt="Comforter wash service"
                  fill
                  className="object-cover opacity-60 group-hover:opacity-75 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D2240]/80 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="bg-[#E8726A] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
                    Flat Rate
                  </span>
                </div>
                <div className="absolute top-4 right-4 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
                  🛏️
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Comforter Wash</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  Bulky comforters professionally washed and returned fresh. Any size, flat rate — no surprises.
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-extrabold text-[#E8726A]">$29</span>
                    <span className="text-gray-400 text-sm ml-1">/ comforter</span>
                  </div>
                  <span className="text-[#E8726A] font-bold text-sm group-hover:translate-x-1 transition-transform inline-block">
                    Book now →
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Any size", "Free bag", "72-hr turnaround", "Free delivery"].map((t) => (
                    <span key={t} className="text-[10px] font-semibold uppercase tracking-wide bg-[#fdf6f3] text-[#0D2240]/50 px-2.5 py-1 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>

            {/* Card 2: Wash & Fold */}
            <Link
              href="/book/wash-fold"
              className="group relative overflow-hidden rounded-3xl border-2 border-gray-100 hover:border-[#E8726A] transition-all hover:shadow-xl cursor-pointer bg-white"
            >
              <div className="relative h-56 bg-[#1a3a5c] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a5c] to-[#0D2240]" />
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <span className="text-[120px]">👕</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D2240]/80 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="bg-[#E8726A] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
                    Per Pound
                  </span>
                </div>
                <div className="absolute top-4 right-4 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
                  👕
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Wash &amp; Fold</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  Drop off your family&apos;s clothes dirty, get them back sorted, washed, dried, and neatly folded.
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-extrabold text-[#E8726A]">$2.50</span>
                    <span className="text-gray-400 text-sm ml-1">/ lb</span>
                  </div>
                  <span className="text-[#E8726A] font-bold text-sm group-hover:translate-x-1 transition-transform inline-block">
                    Book now →
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["$20 minimum", "Sorted & folded", "72-hr turnaround", "Free delivery"].map((t) => (
                    <span key={t} className="text-[10px] font-semibold uppercase tracking-wide bg-[#fdf6f3] text-[#0D2240]/50 px-2.5 py-1 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why families love us ────────────────────────────────────────── */}
      <section className="bg-[#0D2240] px-4 py-16 overflow-hidden relative">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-[#E8726A] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-[#E8726A] translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">Why Families Choose Us</p>
            <h2 className="text-3xl font-extrabold text-white">More Time for What Matters</h2>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              { icon: "⏱️", title: "Save 4+ Hours", desc: "Every week back with your family" },
              { icon: "🛡️", title: "Fully Insured", desc: "Your clothes are protected" },
              { icon: "♻️", title: "Eco-Friendly", desc: "Responsible detergents only" },
              { icon: "📱", title: "Live Tracking", desc: "Know where your order is" },
            ].map((t) => (
              <div key={t.title} className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl border border-white/10">
                  {t.icon}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{t.title}</p>
                  <p className="text-white/50 text-xs mt-0.5">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="bg-[#fdf6f3] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">Real Families</p>
            <h2 className="text-3xl font-extrabold text-[#0D2240]">What Our Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                quote: "I have three kids and laundry was eating my weekends. WashFold changed everything — I get my Sundays back now.",
                name: "Maria S.",
                label: "Mom of 3 · Lake Nona",
              },
              {
                quote: "The comforter wash is incredible. My king-size comforter came back fluffy and smelling amazing. Way cheaper than the laundromat.",
                name: "James T.",
                label: "Customer · Orlando",
              },
              {
                quote: "They're always on time, the clothes are perfectly folded, and the tracking link is so reassuring. Highly recommend.",
                name: "Keisha R.",
                label: "Repeat Customer · Dr. Phillips",
              },
            ].map((r) => (
              <div key={r.name} className="bg-white rounded-2xl p-6 shadow-sm border border-[#e8d5cc]">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[#0D2240]/70 text-sm leading-relaxed mb-4 italic">&ldquo;{r.quote}&rdquo;</p>
                <div>
                  <p className="text-[#0D2240] font-bold text-sm">{r.name}</p>
                  <p className="text-[#E8726A] text-xs">{r.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section id="how" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">Simple as 1-2-3</p>
          <h2 className="text-3xl font-extrabold text-[#0D2240] mb-12">Laundry Done For You</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { n: "01", icon: "📅", title: "You Book Online", desc: "Pick your service, pickup day, and time window — done in under 2 minutes." },
              { n: "02", icon: "🚚", title: "We Come to You", desc: "Our team picks up right at your door. No driving, no waiting in lines." },
              { n: "03", icon: "✨", title: "Fresh at Your Door", desc: "72 hours later, clean and folded — delivered back to your home." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-4 rounded-2xl p-8 border-2 border-gray-100 hover:border-[#E8726A] transition-colors group">
                <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] group-hover:bg-[#E8726A]/10 flex items-center justify-center text-3xl transition-colors">{s.icon}</div>
                <span className="text-[10px] font-bold text-[#E8726A] uppercase tracking-[0.2em]">{s.n}</span>
                <h3 className="font-extrabold text-[#0D2240] text-lg">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <a href="#services" className="inline-flex items-center gap-2 bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold text-base px-8 py-4 rounded-full transition-all shadow-md hover:shadow-lg">
              Get Started Today
            </a>
          </div>
        </div>
      </section>

      {/* ── ZIP checker ────────────────────────────────────────────────── */}
      <section id="areas" className="bg-[#0D2240] px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">Service Areas</p>
          <h2 className="text-2xl font-extrabold text-white mb-2">Do We Come to Your Door?</h2>
          <p className="text-white/50 text-sm mb-7">Enter your ZIP code to confirm pickup is available in your neighborhood.</p>
          <ZipChecker />
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#fdf6f3] px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">Transparent Pricing</p>
            <h2 className="text-3xl font-extrabold text-[#0D2240] mb-2">No Surprises, Ever</h2>
            <p className="text-gray-400 text-sm">Pickup and delivery always included. What you see is what you pay.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm border-2 border-[#e8d5cc] hover:border-[#E8726A] transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">🛏️</div>
              <h3 className="font-extrabold text-[#0D2240] text-xl mb-1">Comforter Wash</h3>
              <p className="text-gray-400 text-sm mb-4">Any size · fully washed &amp; delivered</p>
              <p className="text-5xl font-extrabold text-[#E8726A] mb-1">$29</p>
              <p className="text-gray-400 text-xs mb-6">per comforter</p>
              <Link href="/book/comforter-wash" className="block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-5 py-3 rounded-full transition-colors">
                Book Now
              </Link>
            </div>
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm border-2 border-gray-100 hover:border-[#E8726A] transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">👕</div>
              <h3 className="font-extrabold text-[#0D2240] text-xl mb-1">Wash &amp; Fold</h3>
              <p className="text-gray-400 text-sm mb-4">$20 minimum · sorted &amp; folded</p>
              <p className="text-5xl font-extrabold text-[#E8726A] mb-1">$2.50<span className="text-2xl">/lb</span></p>
              <p className="text-gray-400 text-xs mb-6">per pound of laundry</p>
              <Link href="/book/wash-fold" className="block bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-sm px-5 py-3 rounded-full transition-colors">
                Book Now
              </Link>
            </div>
          </div>
          <p className="text-[#0D2240]/40 text-center text-xs mt-6">Free pickup &amp; delivery included with all services · No hidden fees</p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">FAQ</p>
            <h2 className="text-3xl font-extrabold text-[#0D2240]">Common Questions</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "What's the difference between the two services?", a: "Comforter Wash is specifically for comforters — we wash and deliver them at a flat $29 each. Wash & Fold is for regular clothes charged by weight at $2.50/lb." },
              { q: "What days do you do pickups?", a: "Pickups and deliveries happen Monday through Wednesday in two time windows: 9AM–1PM or 3PM–7PM." },
              { q: "How does the Wash & Fold weight work?", a: "You estimate your weight when booking, and we weigh your laundry at pickup. We'll confirm the final price after weighing. $20 minimum applies." },
              { q: "What if I'm not home?", a: "No problem! Leave your laundry in a bag outside. Our driver will collect it and send you a text confirmation." },
              { q: "Do you service my ZIP code?", a: "Use the checker above to see if we're in your area. We're currently in parts of Orlando and expanding fast." },
              { q: "Can I track my order?", a: "Yes! Once your order is picked up you'll receive a tracking link via text so you can follow every step of the process." },
            ].map((item) => (
              <details key={item.q} className="group border border-gray-200 rounded-2xl overflow-hidden bg-[#fdf6f3]">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-[#0D2240] hover:bg-[#faeee8] transition-colors list-none text-sm">
                  {item.q}
                  <span className="ml-4 text-[#E8726A] text-lg group-open:rotate-45 transition-transform inline-block shrink-0">+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed bg-white border-t border-gray-100">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────── */}
      <section className="bg-[#E8726A] px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-extrabold text-white mb-3">Ready for Fresh Laundry?</h2>
          <p className="text-white/80 text-base mb-8 leading-relaxed">
            Join hundreds of Orlando families who&apos;ve said goodbye to laundry day for good.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/book/comforter-wash" className="bg-white text-[#E8726A] font-extrabold px-8 py-4 rounded-full hover:bg-[#0D2240] hover:text-white transition-all shadow-md">
              Wash My Comforter — $29
            </Link>
            <Link href="/book/wash-fold" className="bg-[#0D2240] text-white font-extrabold px-8 py-4 rounded-full hover:bg-[#1a3a5c] transition-all shadow-md">
              Wash &amp; Fold — $2.50/lb
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-[#0D2240] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Logo size={32} />
                <span className="text-white font-extrabold text-lg">
                  Wash<span className="text-[#E8726A]">Fold</span>{" "}
                  <span className="text-white/30 text-sm font-normal">Orlando</span>
                </span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                Professional laundry pickup &amp; delivery for Orlando families. We make clean clothes easy.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Contact</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li>(407) 555-0100</li>
                <li>hello@washfoldorlando.com</li>
                <li>Orlando, FL</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Services</h4>
              <ul className="space-y-2">
                <li><Link href="/book/comforter-wash" className="text-white/50 text-sm hover:text-[#E8726A] transition-colors">Comforter Wash — $29</Link></li>
                <li><Link href="/book/wash-fold" className="text-white/50 text-sm hover:text-[#E8726A] transition-colors">Wash &amp; Fold — $2.50/lb</Link></li>
                <li><a href="#areas" className="text-white/50 text-sm hover:text-[#E8726A] transition-colors">Service Areas</a></li>
                <li><a href="#faq" className="text-white/50 text-sm hover:text-[#E8726A] transition-colors">FAQ</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-white/25 text-xs">
            &copy; {new Date().getFullYear()} WashFold Orlando. All rights reserved.
          </div>
        </div>
      </footer>

    </main>
  )
}
