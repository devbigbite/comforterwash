import { BookingForm } from "@/components/booking-form"
import { ZipChecker } from "@/components/zip-checker"
import Image from "next/image"
import Link from "next/link"

// ── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#0D2240" />
      {/* W wave mark */}
      <path
        d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
        stroke="#E8726A"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10 29 Q13 24 16 29 Q19 34 22 29 Q25 24 28 29 Q31 34 34 29 Q36 26 38 29"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.25"
      />
    </svg>
  )
}

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { label: "Services", href: "#services" },
  { label: "How It Works", href: "#how" },
  { label: "Service Areas", href: "#areas" },
  { label: "Pricing", href: "#book" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-white font-sans">

      {/* ── Top utility bar ───────────────────────────────────────────────── */}
      <div className="bg-[#0D2240] text-white/70 text-xs">
        <div className="mx-auto max-w-7xl px-4 h-8 flex items-center justify-end gap-5">
          <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
          <Link href="/account" className="hover:text-white transition-colors">My Account</Link>
        </div>
      </div>

      {/* ── Main header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 h-20 flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Logo size={40} />
            <div className="leading-tight">
              <span className="block text-[#0D2240] font-extrabold text-lg tracking-tight leading-none">
                Wash<span className="text-[#E8726A]">Fold</span>
              </span>
              <span className="block text-[#0D2240]/40 text-[10px] font-semibold uppercase tracking-widest">Orlando</span>
            </div>
          </Link>

          {/* Contact info */}
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
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#E8726A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Orlando, FL</span>
            </div>
          </div>

          <div className="flex-1" />

          <a
            href="#book"
            className="shrink-0 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-colors uppercase tracking-wide shadow-sm"
          >
            Schedule a Pickup
          </a>
        </div>

        {/* Navigation */}
        <nav className="border-t border-gray-100 hidden md:block">
          <div className="mx-auto max-w-7xl px-4">
            <ul className="flex items-center gap-0">
              {NAV.map((n) => (
                <li key={n.label}>
                  <a
                    href={n.href}
                    className="block px-4 py-3 text-sm font-medium text-[#0D2240]/70 hover:text-[#E8726A] hover:bg-gray-50 transition-colors"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D2240]">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#E8726A]/15 border border-[#E8726A]/30 rounded-full px-4 py-1.5 mb-7">
                <span className="text-[#E8726A] text-sm">★★★★★</span>
                <span className="text-white/70 text-sm">Trusted by <strong className="text-white">500+ Orlando families</strong></span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
                Your Comforter,<br />
                <span className="text-[#E8726A]">Washed &amp; Delivered</span><br />
                <span className="text-white/60">Back to Your Door.</span>
              </h1>
              <p className="text-white/60 text-xl mb-10 leading-relaxed max-w-lg">
                Free pickup &amp; delivery across Orlando. Professional wash in 72 hours.{" "}
                <span className="text-white font-semibold">$29 flat — any size comforter.</span>
              </p>
              <div className="flex flex-wrap gap-2.5 mb-10">
                {["✓  Free Pickup & Delivery", "✓  72-Hour Turnaround", "✓  $29 Any Size", "✓  Live SMS Updates"].map((b) => (
                  <span key={b} className="bg-white/8 text-white/80 text-sm px-4 py-2 rounded-full font-medium border border-white/10">
                    {b}
                  </span>
                ))}
              </div>
              <a
                href="#book"
                className="inline-flex items-center gap-2 bg-[#E8726A] hover:bg-[#d45f57] text-white font-extrabold text-base px-8 py-4 rounded-xl transition-all shadow-lg shadow-[#E8726A]/25"
              >
                Schedule My Pickup →
              </a>
            </div>
            <div className="hidden lg:flex justify-center relative">
              <div className="absolute -inset-10 bg-[#E8726A]/10 rounded-3xl blur-3xl" />
              <Image
                src="/sweet-sleep.jpg"
                alt="Fresh clean comforter"
                width={580}
                height={440}
                className="relative rounded-2xl shadow-2xl w-full object-cover"
                priority
              />
              <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl px-5 py-4 shadow-2xl">
                <p className="text-3xl font-extrabold text-[#0D2240] leading-none">$29</p>
                <p className="text-xs font-bold text-[#E8726A] uppercase tracking-wider mt-1">Per Comforter</p>
              </div>
              <div className="absolute -top-3 -right-3 bg-[#E8726A] text-white rounded-2xl px-4 py-2 shadow-xl text-sm font-bold">
                72-hr turnaround
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 80L60 68C120 56 240 32 360 24C480 16 600 24 720 30C840 36 960 38 1080 34C1200 30 1320 18 1380 12L1440 6V80H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── ZIP code checker ──────────────────────────────────────────────── */}
      <section id="areas" className="bg-white px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold text-[#0D2240] mb-2">Do We Serve Your Area?</h2>
          <p className="text-gray-400 text-sm mb-7">Enter your ZIP code to confirm we pick up in your neighborhood.</p>
          <ZipChecker />
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section id="how" className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-extrabold text-[#0D2240] mb-2">How WashFold Works</h2>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-12">Three steps, zero hassle</p>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { n: "01", icon: "📅", title: "Book Online", desc: "Pick your pickup date and how many comforters — takes under 2 minutes." },
              { n: "02", icon: "🚚", title: "We Pick Up", desc: "Our driver comes to your door in your chosen time window. No waiting around." },
              { n: "03", icon: "✨", title: "Delivered Fresh", desc: "72 hours later, your comforter is clean, bagged, and back at your door." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E8726A]/10 to-[#E8726A]/20 flex items-center justify-center text-3xl">
                  {s.icon}
                </div>
                <span className="text-[10px] font-bold text-[#E8726A] uppercase tracking-[0.2em]">{s.n}</span>
                <h3 className="font-extrabold text-[#0D2240] text-lg">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services strip ────────────────────────────────────────────────── */}
      <section id="services" className="bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: "🛡️", label: "Fully Insured" },
              { icon: "♻️", label: "Eco-Friendly Wash" },
              { icon: "🎁", label: "Free Laundry Bag" },
              { icon: "💬", label: "Real-Time SMS" },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-2.5 bg-[#f7f8fb] rounded-2xl p-6 text-center border border-gray-100 hover:border-[#E8726A]/30 transition-colors">
                <span className="text-2xl">{t.icon}</span>
                <span className="text-xs font-bold text-[#0D2240] uppercase tracking-wide">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing callout ───────────────────────────────────────────────── */}
      <section className="bg-[#E8726A] px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-white/80 text-sm uppercase tracking-widest font-bold mb-2">Simple, transparent pricing</p>
          <h2 className="text-5xl font-extrabold text-white mb-3">$29 <span className="text-2xl font-bold text-white/70">per comforter</span></h2>
          <p className="text-white/75 text-base mb-8 max-w-md mx-auto">
            Any size. Free pickup & delivery. No hidden fees, no surprises.
          </p>
          <a
            href="#book"
            className="inline-flex items-center gap-2 bg-white text-[#E8726A] font-extrabold text-base px-8 py-4 rounded-xl hover:bg-[#0D2240] hover:text-white transition-all shadow-lg"
          >
            Book Now →
          </a>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold text-[#0D2240] mb-8 text-center">Common Questions</h2>
          <div className="space-y-4">
            {[
              { q: "What size comforters do you wash?", a: "We wash all sizes — twin, full, queen, and king — all at the same flat $29 rate." },
              { q: "How long does it take?", a: "We pick up your comforter and have it back to you within 72 hours (3 days)." },
              { q: "What days do you do pickups and deliveries?", a: "Pickups and deliveries happen Monday through Wednesday in two time windows: 9AM–1PM or 3PM–7PM." },
              { q: "What if I'm not home?", a: "Leave your comforter in a bag outside your door. Our driver will pick it up and text you when it's collected." },
              { q: "Do you service my area?", a: "Use the ZIP code checker above to confirm we serve your neighborhood. We're currently in select Orlando zip codes and expanding." },
            ].map((item) => (
              <details key={item.q} className="group border border-gray-100 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-[#0D2240] hover:bg-[#f7f8fb] transition-colors list-none">
                  {item.q}
                  <span className="ml-4 text-[#E8726A] text-lg group-open:rotate-45 transition-transform inline-block">+</span>
                </summary>
                <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Booking form ──────────────────────────────────────────────────── */}
      <section id="book" className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-extrabold text-[#0D2240]">Schedule Your Pickup</h2>
            <p className="mt-2 text-gray-400 text-sm">
              Mon–Wed pickup &amp; delivery · 72-hour turnaround · $29 per comforter
            </p>
          </div>
          <BookingForm />
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-[#0D2240] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Logo size={32} />
                <span className="text-white font-extrabold text-lg tracking-tight">
                  Wash<span className="text-[#E8726A]">Fold</span>{" "}
                  <span className="text-white/30 text-sm font-normal">Orlando</span>
                </span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                Professional comforter cleaning with free pickup &amp; delivery in Orlando, FL.
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
              <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Quick Links</h4>
              <ul className="space-y-2">
                {NAV.map((n) => (
                  <li key={n.label}>
                    <a href={n.href} className="text-white/50 text-sm hover:text-[#E8726A] transition-colors">{n.label}</a>
                  </li>
                ))}
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
