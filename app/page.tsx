"use client"

import { ZipChecker } from "@/components/zip-checker"
import HeroCarousel from "@/components/hero-carousel"
import Image from "next/image"
import Link from "next/link"
import { useLang } from "@/components/lang-provider"
import { LangToggle } from "@/components/lang-toggle"

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
  const { translations: tr } = useLang()
  return (
    <main className="min-h-screen bg-white font-sans">

      {/* ── Top utility bar ────────────────────────────────────────────── */}
      <div className="bg-[#0D2240] text-white/70 text-xs">
        <div className="mx-auto max-w-7xl px-4 h-9 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-[#E8726A]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              (407) 555-0100
            </span>
            <span className="hidden sm:inline text-white/30">|</span>
            <span className="hidden sm:inline">Mon–Wed · 8AM – 6PM</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-white transition-colors">{tr.common.signIn}</Link>
            <Link href="/account" className="hover:text-white transition-colors">{tr.common.myAccount}</Link>
            <LangToggle />
          </div>
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
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
              { label: tr.nav.pickupDelivery, href: "#services" },
              { label: tr.nav.howItWorks, href: "#how" },
              { label: tr.nav.pricing, href: "#pricing" },
              { label: tr.nav.serviceAreas, href: "#areas" },
              { label: tr.nav.faq, href: "#faq" },
            ].map((n) => (
              <a key={n.label} href={n.href} className="px-3 py-2 text-sm font-semibold text-[#0D2240]/60 hover:text-[#E8726A] transition-colors rounded-lg hover:bg-orange-50 uppercase tracking-wide text-xs">
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

      {/* ── Hero — scrolling carousel ───────────────────────────────────── */}
      <HeroCarousel tr={tr.hero} />

      {/* ── Our Services — immediately after hero ──────────────────────── */}
      <section id="services" className="bg-[#0D2240] px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-wide text-center mb-2">{tr.services.heading}</h2>
          <div className="w-16 h-0.5 bg-[#E8726A] mx-auto mb-8" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                href: "/book/comforter-wash",
                icon: "🛏️",
                title: tr.services.comforterTitle,
                desc: tr.services.comforterDesc,
                price: "$33",
                unit: tr.services.perComforter ?? "per comforter",
              },
              {
                href: "/book/wash-fold",
                icon: "👕",
                title: tr.services.washFoldTitle,
                desc: tr.services.washFoldDesc,
                price: "$2.50",
                unit: tr.services.washFoldUnit,
              },
              {
                href: "/book/wash-only",
                icon: "🧺",
                title: "Wash Only",
                desc: "Clothes washed & dried, returned clean in a bag — unfolded. Perfect if you prefer to fold your own.",
                price: "$1.99",
                unit: "/ lb",
              },
            ].map((svc) => (
              <Link
                key={svc.title}
                href={svc.href}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#E8726A] rounded-2xl p-6 flex gap-5 items-start transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shrink-0">{svc.icon}</div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-white uppercase tracking-wide text-sm mb-1">{svc.title}</h3>
                  <p className="text-white/50 text-xs leading-relaxed mb-3">{svc.desc}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[#E8726A] font-extrabold text-xl">{svc.price}</span>
                      <span className="text-white/40 text-xs ml-1">{svc.unit}</span>
                    </div>
                    <span className="text-[#E8726A] text-xs font-bold uppercase tracking-wide group-hover:translate-x-1 transition-transform inline-block">
                      Book Now »
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ──────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-extrabold text-[#0D2240] uppercase tracking-wide mb-3">
            {tr.why.heading}
          </h2>
          <p className="text-[#E8726A] font-bold text-sm uppercase tracking-[0.2em] mb-5">
            {tr.why.subheading}
          </p>
          <p className="text-[#0D2240]/60 text-base leading-relaxed max-w-2xl mx-auto mb-5">
            At WashFold Orlando, we understand the demands of your busy family life. We&apos;re dedicated to providing top-notch laundry services that cater to your unique needs — serving Orlando and surrounding areas with professional wash &amp; fold and comforter washing, all designed with your convenience in mind.
          </p>
          <p className="text-[#0D2240]/60 text-base leading-relaxed max-w-2xl mx-auto">
            Our private facility ensures a clean, controlled environment for your garments. With free pickup and delivery every time, we make laundry day effortless — giving you more time for what truly matters.
          </p>
        </div>

        {/* Van / lifestyle photo */}
        <div className="mx-auto max-w-4xl mt-10 rounded-3xl overflow-hidden shadow-lg relative" style={{ height: "320px" }}>
          <Image
            src="/sweet-sleep.jpg"
            alt="WashFold Orlando pickup and delivery"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D2240]/60 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center px-10">
            <div className="max-w-sm">
              <p className="text-white/80 text-xs font-bold uppercase tracking-[0.2em] mb-2">Pick Up &amp; Delivery</p>
              <h3 className="text-white font-extrabold text-3xl leading-tight mb-4">
                We Come to You.<br />You Enjoy Life.
              </h3>
              <a href="#services" className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-3 rounded-full transition-colors uppercase tracking-wide">
                Schedule a Pickup
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 Simple Steps ─────────────────────────────────────────────── */}
      <section id="how" className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold text-[#0D2240] uppercase tracking-wide text-center mb-2">
            {tr.steps.heading}
          </h2>
          <p className="text-center text-gray-400 text-sm mb-10">{tr.steps.subheading}</p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
            {[
              {
                icon: (
                  <svg className="w-10 h-10 text-[#0D2240]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                title: "Schedule a Pick Up",
                desc: "Choose the options that best suit you and your laundry needs — takes less than 2 minutes.",
                cta: "Schedule a Pickup »",
                href: "#services",
              },
              {
                icon: (
                  <svg className="w-10 h-10 text-[#0D2240]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                ),
                title: "Bag Your Dirty Laundry",
                desc: "Set your laundry outside the morning of your scheduled pickup — we take it from there.",
                cta: "Prepare Your Laundry »",
                href: "#how",
              },
              {
                icon: (
                  <svg className="w-10 h-10 text-[#0D2240]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Enjoy Your Free Time",
                desc: "Your laundry will be returned clean, folded, and delivered within 72 hours.",
                cta: "Schedule a Pickup »",
                href: "#services",
              },
            ].map((s) => (
              <div key={s.title} className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center text-center gap-4 hover:border-[#E8726A] hover:shadow-md transition-all">
                <div className="w-16 h-16 rounded-full border-2 border-[#0D2240]/20 flex items-center justify-center">
                  {s.icon}
                </div>
                <h3 className="font-extrabold text-[#0D2240] text-base uppercase tracking-wide">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{s.desc}</p>
                <a href={s.href} className="text-[#0D2240] font-bold text-xs uppercase tracking-wide hover:text-[#E8726A] transition-colors">
                  {s.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Full-width CTA */}
          <a
            href="#services"
            className="block w-full border-2 border-[#E8726A] text-[#E8726A] hover:bg-[#E8726A] hover:text-white font-extrabold text-base uppercase tracking-widest text-center py-5 rounded-2xl transition-all"
          >
            Schedule a Pickup
          </a>
        </div>
      </section>

      {/* ── Special Offers ─────────────────────────────────────────────── */}
      <section className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold text-[#0D2240] uppercase tracking-wide text-center mb-2">
            {tr.offers.heading}
          </h2>
          <p className="text-center text-gray-400 text-sm mb-10 max-w-xl mx-auto">
            Laundry day has never looked this good. At WashFold Orlando, we believe convenience should come with rewards.
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                image: "/sweet-sleep.jpg",
                overlay: "bg-[#0D2240]/60",
                badge: "15% OFF",
                title: "15% Off Your First Order",
                desc: "New to WashFold? Try us out and save big while experiencing the joy of laundry freedom. (Discount applied automatically)",
              },
              {
                image: "/sweet-sleep.jpg",
                overlay: "bg-[#E8726A]/50",
                badge: "FREE",
                title: "Free Premium Laundry Bag",
                desc: "We'll deliver your first order in a custom WashFold Orlando bag — yours to keep!",
              },
              {
                image: "/sweet-sleep.jpg",
                overlay: "bg-[#1a3a5c]/60",
                badge: "ALWAYS",
                title: "Always Free Pickup & Delivery",
                desc: "No gimmicks. No hidden fees. Just clean laundry, delivered free to your door every time.",
              },
            ].map((offer) => (
              <div key={offer.title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-44 overflow-hidden">
                  <Image src={offer.image} alt={offer.title} fill className="object-cover" />
                  <div className={`absolute inset-0 ${offer.overlay}`} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-extrabold text-4xl drop-shadow-lg">{offer.badge}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-extrabold text-[#0D2240] uppercase tracking-wide text-sm mb-2">{offer.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{offer.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ZIP checker ────────────────────────────────────────────────── */}
      <section id="areas" className="bg-[#0D2240] px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.2em] mb-2">Service Areas</p>
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-wide mb-2">Do We Come to Your Door?</h2>
          <p className="text-white/50 text-sm mb-7">Enter your ZIP code to confirm pickup is available in your neighborhood.</p>
          <ZipChecker />
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold text-[#0D2240] uppercase tracking-wide text-center mb-2">{tr.pricing.heading}</h2>
          <div className="w-16 h-0.5 bg-[#E8726A] mx-auto mb-10" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="border-2 border-gray-100 hover:border-[#E8726A] rounded-3xl p-8 text-center transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">🛏️</div>
              <h3 className="font-extrabold text-[#0D2240] uppercase tracking-wide text-base mb-1">Comforter Wash</h3>
              <p className="text-gray-400 text-sm mb-4">Any size · fully washed &amp; delivered</p>
              <p className="text-5xl font-extrabold text-[#E8726A] mb-1">$33</p>
              <p className="text-gray-400 text-xs mb-6">per comforter</p>
              <Link href="/book/comforter-wash" className="block border-2 border-[#E8726A] text-[#E8726A] hover:bg-[#E8726A] hover:text-white font-bold text-sm px-5 py-3 rounded-full transition-all uppercase tracking-wide">
                Book Now
              </Link>
            </div>
            <div className="border-2 border-gray-100 hover:border-[#E8726A] rounded-3xl p-8 text-center transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">👕</div>
              <h3 className="font-extrabold text-[#0D2240] uppercase tracking-wide text-base mb-1">Wash &amp; Fold</h3>
              <p className="text-gray-400 text-sm mb-4">20 lb minimum · sorted &amp; folded</p>
              <p className="text-5xl font-extrabold text-[#E8726A] mb-1">$2.50<span className="text-2xl">/lb</span></p>
              <p className="text-gray-400 text-xs mb-6">from $2.25/lb with subscription</p>
              <Link href="/book/wash-fold" className="block bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-sm px-5 py-3 rounded-full transition-colors uppercase tracking-wide">
                Book Now
              </Link>
            </div>
            <div className="border-2 border-gray-100 hover:border-[#E8726A] rounded-3xl p-8 text-center transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">🧺</div>
              <h3 className="font-extrabold text-[#0D2240] uppercase tracking-wide text-base mb-1">Wash Only</h3>
              <p className="text-gray-400 text-sm mb-4">20 lb minimum · returned clean, unfolded</p>
              <p className="text-5xl font-extrabold text-[#E8726A] mb-1">$1.99<span className="text-2xl">/lb</span></p>
              <p className="text-gray-400 text-xs mb-6">per pound of laundry</p>
              <Link href="/book/wash-only" className="block border-2 border-[#0D2240] text-[#0D2240] hover:bg-[#0D2240] hover:text-white font-bold text-sm px-5 py-3 rounded-full transition-all uppercase tracking-wide">
                Book Now
              </Link>
            </div>
          </div>
          <p className="text-[#0D2240]/30 text-center text-xs mt-6 uppercase tracking-wide">Free pickup &amp; delivery included · No hidden fees</p>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold text-[#0D2240] uppercase tracking-wide text-center mb-2">{tr.testimonials.heading}</h2>
          <div className="w-16 h-0.5 bg-[#E8726A] mx-auto mb-10" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              { quote: "I have three kids and laundry was eating my weekends. WashFold changed everything — I get my Sundays back now.", name: "Maria S.", label: "Mom of 3 · Lake Nona" },
              { quote: "The comforter wash is incredible. My king-size comforter came back fluffy and smelling amazing. Way cheaper than the laundromat.", name: "James T.", label: "Customer · Orlando" },
              { quote: "They're always on time, the clothes are perfectly folded, and the tracking link is so reassuring. Highly recommend.", name: "Keisha R.", label: "Repeat Customer · Dr. Phillips" },
            ].map((r) => (
              <div key={r.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[#0D2240]/70 text-sm leading-relaxed mb-4 italic">&ldquo;{r.quote}&rdquo;</p>
                <p className="text-[#0D2240] font-bold text-sm">{r.name}</p>
                <p className="text-[#E8726A] text-xs">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold text-[#0D2240] uppercase tracking-wide text-center mb-2">Common Questions</h2>
          <div className="w-16 h-0.5 bg-[#E8726A] mx-auto mb-10" />
          <div className="space-y-3">
            {[
              { q: "What's the difference between the services?", a: "Comforter Wash is for comforters — flat $33 each, any size. Wash & Fold is for regular clothes: washed, dried, and folded at $2.50/lb (or $2.25/lb with a weekly/biweekly subscription). Wash Only is a lower-cost option at $1.99/lb — clothes are washed and returned clean in a bag, unfolded." },
              { q: "What days do you do pickups?", a: "Pickups and deliveries happen Monday through Wednesday in two time windows: 9AM–1PM or 3PM–7PM." },
              { q: "How does the Wash & Fold weight work?", a: "You estimate your weight when booking, and we weigh your laundry at pickup. We'll confirm the final price after weighing. 20 lb minimum applies." },
              { q: "What if I'm not home?", a: "No problem! Leave your laundry in a bag outside. Our driver will collect it and send you a text confirmation." },
              { q: "Can I track my order?", a: "Yes! Once your order is picked up you'll receive a tracking link via text so you can follow every step of the process." },
            ].map((item) => (
              <details key={item.q} className="group border border-gray-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-bold text-[#0D2240] hover:bg-[#fdf6f3] transition-colors list-none text-sm uppercase tracking-wide">
                  {item.q}
                  <span className="ml-4 text-[#E8726A] text-lg group-open:rotate-45 transition-transform inline-block shrink-0">+</span>
                </summary>
                <div className="px-5 pb-4 pt-1 text-sm text-gray-500 leading-relaxed border-t border-gray-100">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-[#0D2240] px-4 pt-14 pb-8">
        <div className="mx-auto max-w-4xl">

          {/* Contact icons — Crawford style */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 mb-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#E8726A]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Give Us a Call</p>
              <a href="tel:4075550100" className="text-white font-extrabold text-lg hover:text-[#E8726A] transition-colors">(407) 555-0100</a>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#E8726A]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Find Us on Social</p>
              <div className="flex items-center gap-3">
                <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#E8726A] flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#E8726A] flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#E8726A]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Send Us a Note</p>
              <a href="mailto:hello@washfoldorlando.com" className="border border-[#E8726A] text-[#E8726A] hover:bg-[#E8726A] hover:text-white font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all">
                Contact Us
              </a>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo size={28} />
              <span className="text-white font-extrabold">Wash<span className="text-[#E8726A]">Fold</span> <span className="text-white/30 text-sm font-normal">Orlando</span></span>
            </div>
            <div className="flex gap-5 text-white/40 text-xs">
              <Link href="/book/comforter-wash" className="hover:text-[#E8726A] transition-colors">Comforter Wash</Link>
              <Link href="/book/wash-fold" className="hover:text-[#E8726A] transition-colors">Wash &amp; Fold</Link>
              <Link href="/book/wash-only" className="hover:text-[#E8726A] transition-colors">Wash Only</Link>
              <a href="#areas" className="hover:text-[#E8726A] transition-colors">Service Areas</a>
              <a href="#faq" className="hover:text-[#E8726A] transition-colors">FAQ</a>
            </div>
            <p className="text-white/25 text-xs">&copy; {new Date().getFullYear()} WashFold Orlando</p>
          </div>
        </div>
      </footer>

    </main>
  )
}
