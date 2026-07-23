"use client"

import { ZipChecker } from "@/components/zip-checker"
import HeroCarousel from "@/components/hero-carousel"
import { Logo } from "@/components/site-nav"
import Image from "next/image"
import Link from "next/link"
import { useLang } from "@/components/lang-provider"
import { useState, useEffect } from "react"
import { getLandingOffers, getSiteImages, getSiteText, getServicesConfig, getMonthlyPlanEnabled, type ServicesConfig } from "@/app/actions/settings"
import { getPricingConfig } from "@/app/actions/pricing"
import { getBrandingSettings } from "@/app/actions/branding"
import { PRICING_DEFAULTS } from "@/lib/pricing-defaults"
import { DEFAULT_OFFERS, type LandingOffer } from "@/lib/offers-config"
import { DEFAULT_IMAGES, type SiteImages } from "@/lib/site-images-config"
import { MessageUsModal } from "@/components/message-us-modal"
import { DEFAULT_TEXT, type SiteText } from "@/lib/site-text-config"

const OFFER_OVERLAYS = ["bg-[var(--brand-primary)]/60", "bg-[var(--brand-accent)]/50", "bg-[#1a3a5c]/60"]

export default function Home() {
  const { translations: tr, locale } = useLang()
  // null until loaded — prevents flash of disabled offers on first render
  const [offers, setOffers] = useState<LandingOffer[] | null>(null)
  const [images, setImages] = useState<SiteImages | null>(null)
  const [siteText, setSiteText] = useState<SiteText>(DEFAULT_TEXT)
  const [services, setServices] = useState<ServicesConfig | null>(null)
  const [livePricing, setLivePricing] = useState<PricingConfig>(PRICING_DEFAULTS)
  const [monthlyPlanEnabled, setMonthlyPlanEnabled] = useState(true)
  const [businessName, setBusinessName] = useState("Your Business")
  const [supportEmail, setSupportEmail] = useState("clean@washfoldorlando.com")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  useEffect(() => {
    getLandingOffers().then(setOffers)
    getSiteImages().then(setImages)
    getSiteText().then(setSiteText)
    getServicesConfig().then(setServices)
    getPricingConfig().then(setLivePricing)
    getMonthlyPlanEnabled().then(setMonthlyPlanEnabled)
    getBrandingSettings().then(b => {
      setBusinessName(b.business_name)
      if (b.support_email) setSupportEmail(b.support_email)
      setLogoUrl(b.logo_url ?? null)
    })
  }, [])
  const visibleOffers = (offers ?? []).filter(o => o.enabled)
  return (
    <main className="min-h-screen bg-white font-sans">

      {/* ── Hero + Services share one navy surface — no seam possible ─── */}
      <div className="bg-[var(--brand-primary)]">
      <HeroCarousel
        tr={tr.hero}
        images={images ? { slide1: images.slide_1, slide2: images.slide_2, slide3: images.slide_3 } : undefined}
        text={siteText}
        lang={locale}
        businessName={businessName}
      />

      {/* ── Our Services — immediately after hero ──────────────────────── */}
      <section id="services" className="px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-wide text-center mb-2">{tr.services.heading}</h2>
          <div className="w-16 h-0.5 bg-[var(--brand-accent)] mx-auto mb-8" />
          {(() => {
            const activeServices = [
              {
                key: "comforter_wash" as keyof ServicesConfig,
                href: "/book/comforter-wash",
                icon: "🛏️",
                title: tr.services.comforterTitle,
                desc: tr.services.comforterDesc,
                price: `${tr.pricing.comforterFrom} ${tr.pricing.comforterPrice}`,
                unit: tr.services.perComforter,
              },
              {
                key: "wash_fold" as keyof ServicesConfig,
                href: "/book/wash-fold",
                icon: "👕",
                title: tr.services.washFoldTitle,
                desc: tr.services.washFoldDesc,
                price: `$${(livePricing.washFoldOneTimeCents / 100).toFixed(2)}`,
                unit: `per lb · ${livePricing.washFoldMinLbs} lb min`,
              },
              {
                key: "wash_only" as keyof ServicesConfig,
                href: "/book/wash-only",
                icon: "🧺",
                title: tr.services.washOnlyTitle,
                desc: tr.services.washOnlyDesc,
                price: `$${(livePricing.washOnlyCents / 100).toFixed(2)}`,
                unit: tr.services.washOnlyUnit,
              },
            ].filter(svc => services !== null && services[svc.key])
            const gridClass =
              activeServices.length === 1
                ? "grid grid-cols-1 gap-4 max-w-sm mx-auto"
                : activeServices.length === 2
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl mx-auto"
                : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            return (
          <div className={gridClass}>
            {activeServices.map((svc) => (
              <a
                key={svc.title}
                href={svc.href}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--brand-accent)] rounded-2xl p-4 sm:p-6 flex gap-3 sm:gap-5 items-start transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shrink-0">{svc.icon}</div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-white uppercase tracking-wide text-sm mb-1">{svc.title}</h3>
                  <p className="text-white/50 text-xs leading-relaxed mb-3">{svc.desc}</p>
                  <div className="mb-3">
                    <span className="text-[var(--brand-accent)] font-extrabold text-xl">{svc.price}</span>
                    <span className="text-white/40 text-xs ml-1">{svc.unit}</span>
                  </div>
                  <span className="inline-block bg-[var(--brand-accent)] group-hover:bg-[#d45f57] text-white font-bold text-xs px-4 py-2 rounded-full uppercase tracking-wide transition-colors">
                    {tr.services.details}
                  </span>
                </div>
              </a>
            ))}
          </div>
            )
          })()}
        </div>
      </section>
      </div>{/* end navy wrapper */}

      {/* ── Why Choose Us ──────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-extrabold text-[var(--brand-primary)] uppercase tracking-wide mb-3">
            {(locale === "es" ? siteText.why_heading_es : siteText.why_heading) || tr.why.heading}
          </h2>
          <p className="text-[var(--brand-accent)] font-bold text-sm uppercase tracking-[0.2em] mb-5">
            {(locale === "es" ? siteText.why_subheading_es : siteText.why_subheading) || tr.why.subheading}
          </p>
          <p className="text-[var(--brand-primary)]/60 text-base leading-relaxed max-w-2xl mx-auto mb-5">
            {(locale === "es" ? siteText.why_body1_es : siteText.why_body1) || tr.why.body1}
          </p>
          <p className="text-[var(--brand-primary)]/60 text-base leading-relaxed max-w-2xl mx-auto">
            {(locale === "es" ? siteText.why_body2_es : siteText.why_body2) || tr.why.body2}
          </p>
        </div>

        {/* Van / lifestyle photo */}
        <div className="mx-auto max-w-4xl mt-10 rounded-3xl overflow-hidden shadow-lg relative h-48 sm:h-72 md:h-80">
          <Image
            src={images?.why_us ?? "/img-why-us.jpg"}
            alt={`${businessName} pickup and delivery`}
            fill
            className="object-cover"
            unoptimized={!!(images?.why_us?.startsWith("http"))}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-primary)]/60 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center px-5 sm:px-10">
            <div className="max-w-sm">
              <p className="text-white/80 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                {(locale === "es" ? siteText.why_photo_tag_es : siteText.why_photo_tag) || tr.why.photoTag}
              </p>
              <h3 className="text-white font-extrabold text-xl sm:text-3xl leading-tight mb-3 sm:mb-4">
                {((locale === "es" ? siteText.why_photo_headline_es : siteText.why_photo_headline) || tr.why.photoHeadline)
                  .split("\n").map((line: string, i: number) => (
                    <span key={i}>{line}{i === 0 && <br />}</span>
                  ))}
              </h3>
              <a href="#services" className="inline-block bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-3 rounded-full transition-colors uppercase tracking-wide">
                {(locale === "es" ? siteText.why_photo_cta_es : siteText.why_photo_cta) || tr.why.photoCta}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 Simple Steps ─────────────────────────────────────────────── */}
      <section id="how" className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-center mb-2">
            {tr.steps.heading}
          </h2>
          <p className="text-center text-gray-400 text-sm mb-10">{tr.steps.subheading}</p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {[
              {
                icon: (
                  <svg className="w-10 h-10 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                title: tr.steps.step1Title,
                desc: tr.steps.step1Desc,
                cta: tr.steps.step1Cta,
                href: "#services",
              },
              {
                icon: (
                  <svg className="w-10 h-10 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                ),
                title: tr.steps.step2Title,
                desc: tr.steps.step2Desc,
                cta: tr.steps.step2Cta,
                href: "#how",
              },
              {
                icon: (
                  <svg className="w-10 h-10 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: tr.steps.step3Title,
                desc: tr.steps.step3Desc,
                cta: tr.steps.step3Cta,
                href: "#services",
              },
            ].map((s) => (
              <div key={s.title} className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center text-center gap-4 hover:border-[var(--brand-accent)] hover:shadow-md transition-all">
                <div className="w-16 h-16 rounded-full border-2 border-[var(--brand-primary)]/20 flex items-center justify-center">
                  {s.icon}
                </div>
                <h3 className="font-extrabold text-[var(--brand-primary)] text-base uppercase tracking-wide">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{s.desc}</p>
                <a href={s.href} className="text-[var(--brand-primary)] font-bold text-xs uppercase tracking-wide hover:text-[var(--brand-accent)] transition-colors">
                  {s.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Full-width CTA */}
          <a
            href="#services"
            className="block w-full border-2 border-[var(--brand-accent)] text-[var(--brand-accent)] hover:bg-[var(--brand-accent)] hover:text-white font-extrabold text-base uppercase tracking-widest text-center py-5 rounded-2xl transition-all"
          >
            {tr.steps.cta}
          </a>
        </div>
      </section>

      {/* ── Special Offers ─────────────────────────────────────────────── */}
      <section className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-center mb-2">
            {tr.offers.heading}
          </h2>
          <p className="text-center text-gray-400 text-sm mb-10 max-w-xl mx-auto">
            {tr.offers.subheading}
          </p>

          <div className={`grid grid-cols-1 gap-6 ${visibleOffers.length === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : visibleOffers.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-sm mx-auto"}`}>
            {(offers ?? [])
              .map((offer, originalIdx) => ({ offer, originalIdx }))
              .filter(({ offer }) => offer.enabled)
              .map(({ offer, originalIdx }, visibleIdx) => {
                const imgKey = `offer_${originalIdx + 1}` as keyof SiteImages
                const imgSrc = (images ?? DEFAULT_IMAGES)[imgKey]
                return (
                  <div key={offer.title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative h-44 overflow-hidden">
                      <Image src={imgSrc} alt={offer.title} fill className="object-cover" unoptimized={imgSrc.startsWith("http")} />
                      <div className={`absolute inset-0 ${OFFER_OVERLAYS[visibleIdx % OFFER_OVERLAYS.length]}`} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white font-extrabold text-4xl drop-shadow-lg">{offer.badge}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-sm mb-2">{offer.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{offer.desc}</p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </section>

      {/* ── ZIP checker ────────────────────────────────────────────────── */}
      <section id="areas" className="bg-[var(--brand-primary)] px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[var(--brand-accent)] font-bold text-xs uppercase tracking-[0.2em] mb-2">{tr.nav.serviceAreas}</p>
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-wide mb-2">{tr.zip.heading}</h2>
          <p className="text-white/50 text-sm mb-7">{tr.zip.subheading}</p>
          <ZipChecker />
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-center mb-2">{tr.pricing.heading}</h2>
          <div className="w-16 h-0.5 bg-[var(--brand-accent)] mx-auto mb-10" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border-2 border-gray-100 hover:border-[var(--brand-accent)] rounded-3xl p-8 text-center transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">🛏️</div>
              <h3 className="font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-base mb-1">{tr.pricing.comforterTitle}</h3>
              <p className="text-gray-400 text-sm mb-4">{tr.pricing.comforterDesc}</p>
              <p className="text-5xl font-extrabold text-[var(--brand-accent)] mb-1"><span className="text-base font-bold mr-1">{tr.pricing.comforterFrom}</span>{tr.pricing.comforterPrice}</p>
              <p className="text-gray-400 text-xs mb-6">{tr.pricing.comforterUnit}</p>
              <Link href="/book/comforter-wash" className="block bg-[var(--brand-primary)] hover:bg-[#1a3a5c] text-white font-bold text-sm px-5 py-3 rounded-full transition-colors uppercase tracking-wide">
                {tr.pricing.cta}
              </Link>
            </div>
            <div className="border-2 border-gray-100 hover:border-[var(--brand-accent)] rounded-3xl p-8 text-center transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">👕</div>
              <h3 className="font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-base mb-1">{tr.pricing.washFoldTitle}</h3>
              <p className="text-gray-400 text-sm mb-4">{livePricing.washFoldMinLbs} lb minimum</p>
              <p className="text-5xl font-extrabold text-[var(--brand-accent)] mb-1">${(livePricing.washFoldOneTimeCents / 100).toFixed(2)}<span className="text-2xl">/lb</span></p>
              <p className="text-gray-400 text-xs mb-6">${(livePricing.washFoldSubCents / 100).toFixed(2)}/lb with weekly/biweekly subscription</p>
              <Link href="/book/wash-fold" className="block bg-[var(--brand-primary)] hover:bg-[#1a3a5c] text-white font-bold text-sm px-5 py-3 rounded-full transition-colors uppercase tracking-wide">
                {tr.pricing.cta}
              </Link>
            </div>
            <div className="border-2 border-gray-100 hover:border-[var(--brand-accent)] rounded-3xl p-8 text-center transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-[#fdf6f3] flex items-center justify-center text-3xl mx-auto mb-4">🧺</div>
              <h3 className="font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-base mb-1">{tr.pricing.washOnlyTitle}</h3>
              <p className="text-gray-400 text-sm mb-4">{livePricing.washOnlyMinLbs} lb minimum</p>
              <p className="text-5xl font-extrabold text-[var(--brand-accent)] mb-1">${(livePricing.washOnlyCents / 100).toFixed(2)}<span className="text-2xl">/lb</span></p>
              <p className="text-gray-400 text-xs mb-6">{tr.pricing.washOnlyPerLb}</p>
              <Link href="/book/wash-only" className="block bg-[var(--brand-primary)] hover:bg-[#1a3a5c] text-white font-bold text-sm px-5 py-3 rounded-full transition-colors uppercase tracking-wide">
                {tr.pricing.cta}
              </Link>
            </div>
          </div>
          <p className="text-[var(--brand-primary)]/30 text-center text-xs mt-6 uppercase tracking-wide">{tr.pricing.footerNote}</p>
        </div>
      </section>

      {/* ── Monthly Plans CTA ──────────────────────────────────────────── */}
      {monthlyPlanEnabled && <section className="bg-[var(--brand-primary)] px-4 py-12">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shrink-0">📅</div>
          <div className="flex-1">
            <h2 className="text-xl font-extrabold text-white uppercase tracking-wide mb-1">
              {(locale === "es" ? siteText.plans_heading_es : siteText.plans_heading) || "Monthly Laundry Plans"}
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              {(locale === "es" ? siteText.plans_body_es : siteText.plans_body) ||
                "Subscribe and save. Flat monthly fee with included pounds, auto-billed overage, and priority scheduling — no thinking required."}
            </p>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-extrabold text-sm uppercase tracking-widest px-7 py-3.5 rounded-full transition-colors whitespace-nowrap"
          >
            See Plans →
          </Link>
        </div>
      </section>}

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="bg-[#f7f8fb] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-center mb-2">{tr.testimonials.heading}</h2>
          <div className="w-16 h-0.5 bg-[var(--brand-accent)] mx-auto mb-10" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                quote: (locale === "es" ? siteText.t1_quote_es : siteText.t1_quote) || tr.testimonials.r1Quote,
                name:  (locale === "es" ? siteText.t1_name_es  : siteText.t1_name)  || tr.testimonials.r1Name,
                label: (locale === "es" ? siteText.t1_label_es : siteText.t1_label) || tr.testimonials.r1Label,
              },
              {
                quote: (locale === "es" ? siteText.t2_quote_es : siteText.t2_quote) || tr.testimonials.r2Quote,
                name:  (locale === "es" ? siteText.t2_name_es  : siteText.t2_name)  || tr.testimonials.r2Name,
                label: (locale === "es" ? siteText.t2_label_es : siteText.t2_label) || tr.testimonials.r2Label,
              },
              {
                quote: (locale === "es" ? siteText.t3_quote_es : siteText.t3_quote) || tr.testimonials.r3Quote,
                name:  (locale === "es" ? siteText.t3_name_es  : siteText.t3_name)  || tr.testimonials.r3Name,
                label: (locale === "es" ? siteText.t3_label_es : siteText.t3_label) || tr.testimonials.r3Label,
              },
            ].map((r) => (
              <div key={r.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[var(--brand-primary)]/70 text-sm leading-relaxed mb-4 italic">&ldquo;{r.quote}&rdquo;</p>
                <p className="text-[var(--brand-primary)] font-bold text-sm">{r.name}</p>
                <p className="text-[var(--brand-accent)] text-xs">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold text-[var(--brand-primary)] uppercase tracking-wide text-center mb-2">{tr.faq.heading}</h2>
          <div className="w-16 h-0.5 bg-[var(--brand-accent)] mx-auto mb-10" />
          <div className="space-y-3">
            {[
              { q: tr.faq.q1, a: tr.faq.a1 },
              { q: tr.faq.q2, a: tr.faq.a2 },
              { q: tr.faq.q3, a: tr.faq.a3 },
              { q: tr.faq.q4, a: tr.faq.a4 },
              { q: tr.faq.q5, a: tr.faq.a5 },
            ].map((item) => (
              <details key={item.q} className="group border border-gray-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-bold text-[var(--brand-primary)] hover:bg-[#fdf6f3] transition-colors list-none text-sm uppercase tracking-wide">
                  {item.q}
                  <span className="ml-4 text-[var(--brand-accent)] text-lg group-open:rotate-45 transition-transform inline-block shrink-0">+</span>
                </summary>
                <div className="px-5 pb-4 pt-1 text-sm text-gray-500 leading-relaxed border-t border-gray-100">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-[var(--brand-primary)] px-4 pt-14 pb-8">
        <div className="mx-auto max-w-4xl">

          {/* Contact icons */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 mb-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--brand-accent)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Message Us</p>
              <MessageUsModal
                label="Send a Message"
                className="border border-[var(--brand-accent)] text-[var(--brand-accent)] hover:bg-[var(--brand-accent)] hover:text-white font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all cursor-pointer"
              />
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--brand-accent)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">{tr.footer.social}</p>
              <div className="flex items-center gap-3">
                <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[var(--brand-accent)] flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[var(--brand-accent)] flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--brand-accent)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">{tr.footer.sendNote}</p>
              <a href={`mailto:${supportEmail}`} className="border border-[var(--brand-accent)] text-[var(--brand-accent)] hover:bg-[var(--brand-accent)] hover:text-white font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all">
                {tr.footer.contact}
              </a>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo size={28} src={logoUrl} />
              <span className="text-white font-extrabold">{businessName}</span>
            </div>
            <div className="flex gap-5 text-white/40 text-xs">
              <Link href="/services/comforter-wash" className="hover:text-[var(--brand-accent)] transition-colors">{tr.footer.comforterWash}</Link>
              <Link href="/services/wash-fold" className="hover:text-[var(--brand-accent)] transition-colors">{tr.footer.washFold}</Link>
              <Link href="/services/wash-only" className="hover:text-[var(--brand-accent)] transition-colors">{tr.footer.washOnly}</Link>
              <Link href="/service-areas" className="hover:text-[var(--brand-accent)] transition-colors">{tr.footer.serviceAreas}</Link>
              <Link href="/faq" className="hover:text-[var(--brand-accent)] transition-colors">{tr.footer.faq}</Link>
              <Link href="/apply" className="hover:text-[var(--brand-accent)] transition-colors">Employment</Link>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-white/25 text-xs">&copy; {new Date().getFullYear()} {businessName}</p>
              <span className="text-white/10 text-xs">·</span>
              <Link href="/faq" className="text-white/40 hover:text-[var(--brand-accent)] text-xs transition-colors">FAQ</Link>
              <Link href="/terms" className="text-white/40 hover:text-[var(--brand-accent)] text-xs transition-colors">Terms</Link>
              <Link href="/privacy" className="text-white/40 hover:text-[var(--brand-accent)] text-xs transition-colors">Privacy</Link>
              <span className="text-white/10 text-xs">·</span>
              <Link href="/driver" className="text-white/20 hover:text-white/50 text-xs transition-colors">Driver</Link>
              <Link href="/operator" className="text-white/20 hover:text-white/50 text-xs transition-colors">Operator</Link>
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
