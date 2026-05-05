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
            <span className="hidden sm:inline">{tr.common.hours}</span>
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
            {tr.common.schedulePickup}
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
                unit: tr.services.perComforter,
              },
              {
                href: "/book/wash-fold",
                icon: "👕",
                title: tr.services.washFoldTitle,
                desc: tr.services.washFoldDesc,
                price: tr.pricing.washFoldPrice,
                unit: tr.services.washFoldUnit,
              },
              {
                href: "/book/wash-only",
                icon: "🧺",
                title: tr.services.washOnlyTitle,
                desc: tr.services.washOnlyDesc,
                price: "$1.99",
                unit: tr.services.washOnlyUnit,
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
                      {tr.services.details}
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
            {tr.why.body1}
          </p>
          <p className="text-[#0D2240]/60 text-base leading-relaxed max-w-2xl mx-auto">
            {tr.why.body2}
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
              <p className="text-white/80 text-xs font-bold uppercase tracking-[0.2em] mb-2">{tr.why.photoTag}</p>
              <h3 className="text-white font-extrabold text-3xl leading-tight mb-4">
                {tr.why.photoHeadline.split("\n").map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br />}</span>
                ))}
              </h3>
              <a href="#services" className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-3 rounded-full transition-colors uppercase tracking-wide">
                {tr.why.photoCta}
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
