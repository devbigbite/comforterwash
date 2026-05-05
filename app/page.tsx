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

const NAV = [
  { label: "Services", href: "#services" },
  { label: "How It Works", href: "#how" },
  { label: "Service Areas", href: "#areas" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-white font-sans">

      {/* ── Top utility bar ────────────────────────────────────────────── */}
      <div className="bg-[#0D2240] text-white/70 text-xs">
        <div className="mx-auto max-w-7xl px-4 h-8 flex items-center justify-end gap-5">
          <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
          <Link href="/account" className="hover:text-white transition-colors">My Account</Link>
        </div>
      </div>

      {/* ── Main header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 h-20 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Logo size={40} />
            <div className="leading-tight">
              <span className="block text-[#0D2240] font-extrabold text-lg tracking-tight leading-none">
                Wash<span className="text-[#E8726A]">Fold</span>
              </span>
              <span className="block text-[#0D2240]/40 text-[10px] font-semibold uppercase tracking-widest">Orlando</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-6 ml-8 text-sm text-[#0D2240]/60">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#E8726A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="font-medium">(407) 555-0100</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#E8726A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Mon–Fri 8:00AM – 6:00PM</span>
            </div>
          </div>
          <div className="flex-1" />
          <a href="#services" className="shrink-0 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-colors uppercase tracking-wide shadow-sm">
            Book Now
          </a>
        </div>
        <nav className="border-t border-gray-100 hidden md:block">
          <div className="mx-auto max-w-7xl px-4">
            <ul className="flex items-center">
              {NAV.map((n) => (
                <li key={n.label}>
                  <a href={n.href} className="block px-4 py-3 text-sm font-medium text-[#0D2240]/70 hover:text-[#E8726A] hover:bg-gray-50 transition-colors">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {/* ── Hero — full-width, Cueva-style ─────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "400px" }}>
        {/* Background */}
        <div className="absolute inset-0 bg-[#0D2240]">
          <Image
            src="/sweet-sleep.jpg"
            alt="Clean fresh laundry"
            fill
            className="object-cover opacity-30 mix-blend-luminosity"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0D2240]/70 via-[#0D2240]/60 to-[#0D2240]/90" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-4 py-20 lg:py-28">
          <div className="flex justify-center mb-6">
            <Logo size={72} />
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight mb-4">
            WASHFOLD ORLANDO
          </h1>
          <p className="text-white/70 text-lg lg:text-xl max-w-xl mx-auto mb-8 leading-relaxed">
            Professional laundry pickup &amp; delivery in Orlando.<br />
            Clean clothes and comforters — back at your door.
          </p>
          <a
            href="#services"
            className="inline-flex items-center gap-2 bg-white text-[#0D2240] font-extrabold text-base px-8 py-4 rounded-2xl hover:bg-[#E8726A] hover:text-white transition-all shadow-xl"
          >
            Order Now ↓
          </a>
        </div>
      </section>

      {/* ── Service selector — the heart of the page ───────────────────── */}
      <section id="services" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-[#0D2240] mb-2">What can we wash for you?</h2>
            <p className="text-gray-400 text-sm">Select a service below to get started</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Card 1: Comforter Wash */}
            <Link
              href="/book/comforter-wash"
              className="group relative overflow-hidden rounded-3xl border-2 border-gray-100 hover:border-[#E8726A] transition-all hover:shadow-xl cursor-pointer bg-white"
            >
              {/* Image area */}
              <div className="relative h-52 bg-[#0D2240] overflow-hidden">
                <Image
                  src="/sweet-sleep.jpg"
                  alt="Comforter wash service"
                  fill
                  className="object-cover opacity-60 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500"
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

              {/* Info */}
              <div className="p-6">
                <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Comforter Wash</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  Professional washing for any size comforter. Pick up dirty, deliver clean.
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
                    <span key={t} className="text-[10px] font-semibold uppercase tracking-wide bg-[#f7f8fb] text-[#0D2240]/60 px-2.5 py-1 rounded-full">
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
              {/* Image area */}
              <div className="relative h-52 bg-[#1a3a5c] overflow-hidden">
                {/* Placeholder gradient since we don't have a clothes photo yet */}
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

              {/* Info */}
              <div className="p-6">
                <h3 className="text-xl font-extrabold text-[#0D2240] mb-1">Wash &amp; Fold</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  Clothes washed, dried, and folded. Drop off your laundry, get it back fresh.
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
                    <span key={t} className="text-[10px] font-semibold uppercase tracking-wide bg-[#f7f8fb] text-[#0D2240]/60 px-2.5 py-1 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── ZIP checker ────────────────────────────────────────────────── */}
      <section id="areas" className="bg-[#f7f8fb] px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold text-[#0D2240] mb-2">Do We Serve Your Area?</h2>
          <p className="text-gray-400 text-sm mb-7">Enter your ZIP code to confirm we pick up in your neighborhood.</p>
          <ZipChecker />
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section id="how" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-extrabold text-[#0D2240] mb-2">How It Works</h2>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-12">Three steps, zero hassle</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { n: "01", icon: "📅", title: "Book Online", desc: "Pick your service, date, and time window — takes under 2 minutes." },
              { n: "02", icon: "🚚", title: "We Pick Up", desc: "Our driver comes to your door on your chosen day and time window." },
              { n: "03", icon: "✨", title: "Delivered Fresh", desc: "72 hours later, everything is clean, folded, and back at your door." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-4 bg-[#f7f8fb] rounded-2xl p-8 border border-gray-100">
                <div className="w-16 h-16 rounded-2xl bg-[#E8726A]/10 flex items-center justify-center text-3xl">{s.icon}</div>
                <span className="text-[10px] font-bold text-[#E8726A] uppercase tracking-[0.2em]">{s.n}</span>
                <h3 className="font-extrabold text-[#0D2240] text-lg">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#E8726A] px-4 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold text-white text-center mb-8">Simple Pricing</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
              <div className="text-3xl mb-2">🛏️</div>
              <h3 className="font-extrabold text-[#0D2240] text-lg mb-1">Comforter Wash</h3>
              <p className="text-4xl font-extrabold text-[#E8726A] mb-1">$29</p>
              <p className="text-gray-400 text-sm mb-4">per comforter · any size</p>
              <Link href="/book/comforter-wash" className="block bg-[#0D2240] text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-[#1a3a5c] transition-colors">
                Book Now
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
              <div className="text-3xl mb-2">👕</div>
              <h3 className="font-extrabold text-[#0D2240] text-lg mb-1">Wash &amp; Fold</h3>
              <p className="text-4xl font-extrabold text-[#E8726A] mb-1">$2.50<span className="text-xl">/lb</span></p>
              <p className="text-gray-400 text-sm mb-4">$20 minimum · sorted &amp; folded</p>
              <Link href="/book/wash-fold" className="block bg-[#0D2240] text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-[#1a3a5c] transition-colors">
                Book Now
              </Link>
            </div>
          </div>
          <p className="text-white/60 text-center text-sm mt-6">Free pickup &amp; delivery included with all services · No hidden fees</p>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: "🛡️", label: "Fully Insured" },
              { icon: "♻️", label: "Eco-Friendly" },
              { icon: "🎁", label: "Free Laundry Bag" },
              { icon: "💬", label: "Real-Time SMS" },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-2.5 bg-[#f7f8fb] rounded-2xl p-5 text-center border border-gray-100">
                <span className="text-2xl">{t.icon}</span>
                <span className="text-xs font-bold text-[#0D2240] uppercase tracking-wide">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold text-[#0D2240] mb-8 text-center">Common Questions</h2>
          <div className="space-y-3">
            {[
              { q: "What's the difference between the two services?", a: "Comforter Wash is specifically for comforters — we wash and deliver them at a flat $29 each. Wash & Fold is for regular clothes charged by weight at $2.50/lb." },
              { q: "What days do you do pickups?", a: "Pickups and deliveries happen Monday through Wednesday in two time windows: 9AM–1PM or 3PM–7PM." },
              { q: "How does the Wash & Fold weight work?", a: "You estimate your weight when booking, and we weigh your laundry at pickup. We'll confirm the final price after weighing. $20 minimum applies." },
              { q: "What if I'm not home?", a: "Leave your laundry in a bag outside. Our driver will collect it and send you a text confirmation." },
              { q: "Do you service my ZIP code?", a: "Use the checker above to see if we're in your area. We're currently in parts of Orlando and expanding." },
            ].map((item) => (
              <details key={item.q} className="group border border-gray-200 rounded-2xl overflow-hidden bg-white">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-[#0D2240] hover:bg-[#fdf6f5] transition-colors list-none text-sm">
                  {item.q}
                  <span className="ml-4 text-[#E8726A] text-lg group-open:rotate-45 transition-transform inline-block">+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{item.a}</div>
              </details>
            ))}
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
                Professional laundry pickup &amp; delivery in Orlando, FL. Comforters and everyday clothes.
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
