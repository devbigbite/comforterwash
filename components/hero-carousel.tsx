"use client"

import Image from "next/image"
import type { TranslationKeys } from "@/lib/translations/en"
import { DEFAULT_TEXT, type SiteText } from "@/lib/site-text-config"

type HeroTr = TranslationKeys["hero"]

const DEFAULT_IMAGE = "/hero-day.jpg"
// Matches the shipped hero-day.jpg's native proportions — locking the
// container to this ratio means object-cover never has to crop the image
// (cover only crops when the box's aspect differs from the source's).
const IMAGE_ASPECT_RATIO = "1482 / 522"

export default function HeroCarousel({
  tr,
  image,
  text = DEFAULT_TEXT,
  lang = "en",
  businessName = "WashFold Orlando",
}: {
  tr?: HeroTr
  image?: string
  text?: SiteText
  lang?: "en" | "es"
  businessName?: string
}) {
  const es = lang === "es"

  const headline = (es ? text.slide_1_headline_es : text.slide_1_headline) || tr?.slide1Headline || DEFAULT_TEXT.slide_1_headline
  const subline = (es ? text.slide_1_subline_es : text.slide_1_subline) || tr?.slide1Sub || DEFAULT_TEXT.slide_1_subline
  const cta = (es ? text.slide_1_cta_es : text.slide_1_cta) || tr?.slide1Cta || DEFAULT_TEXT.slide_1_cta

  const steps = [
    { n: "1", label: (es ? text.slide_2_p1_label_es : text.slide_2_p1_label) || DEFAULT_TEXT.slide_2_p1_label, accent: "#a78bfa" },
    { n: "2", label: (es ? text.slide_2_p2_label_es : text.slide_2_p2_label) || DEFAULT_TEXT.slide_2_p2_label, accent: "#38bdf8" },
    { n: "3", label: (es ? text.slide_2_p3_label_es : text.slide_2_p3_label) || DEFAULT_TEXT.slide_2_p3_label, accent: "#34d399" },
    { n: "4", label: (es ? text.slide_2_p4_label_es : text.slide_2_p4_label) || DEFAULT_TEXT.slide_2_p4_label, accent: "#f59e0b" },
  ]

  const src = image || DEFAULT_IMAGE
  const isExternal = src.startsWith("http")

  return (
    <section className="relative w-full overflow-hidden bg-[var(--brand-primary)] -mb-px">
      {/* Single static hero image — locked to the image's own aspect ratio so
          the full photo shows with no cropping on phone/tablet widths. A max
          height keeps the banner from getting unreasonably tall on very wide
          desktop screens; only there does object-cover trim a sliver off the
          left/right edges to hold that height. */}
      <div className="relative w-full max-h-[480px]" style={{ aspectRatio: IMAGE_ASPECT_RATIO }}>
        <Image
          src={src}
          alt={businessName}
          fill
          className="object-cover object-center"
          priority
          unoptimized={isExternal}
        />

        {/* Scrim — dark top for headline, dark bottom for the step strip */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/15 to-black/75 pointer-events-none" />

        {/* Headline + subline + CTA */}
        <div className="absolute inset-x-0 top-0 px-3 sm:px-8 pt-3 sm:pt-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-[var(--brand-accent)] font-bold text-[9px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-1 sm:mb-2">{businessName}</p>
            <h1 className="text-white font-extrabold text-lg sm:text-3xl md:text-4xl lg:text-5xl leading-tight max-w-2xl mb-1 sm:mb-3" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.65)" }}>
              {headline}
            </h1>
            <p className="text-white/90 text-[11px] sm:text-base md:text-lg max-w-xl mb-2 sm:mb-4 line-clamp-2 sm:line-clamp-none" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>{subline}</p>
            <a href="/book/wash-fold" className="inline-block bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-[11px] sm:text-sm px-4 sm:px-7 py-2 sm:py-3 rounded-full uppercase tracking-wide transition-colors shadow-lg">
              {cta}
            </a>
          </div>
        </div>

        {/* 4-step strip along the bottom of the image */}
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-4">
          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center justify-end p-1.5 sm:p-4 text-center">
              <span
                className="flex items-center justify-center w-5 h-5 sm:w-8 sm:h-8 rounded-full text-[9px] sm:text-sm font-extrabold border sm:border-2 shrink-0 bg-black/30 backdrop-blur-sm mb-1 sm:mb-1.5"
                style={{ borderColor: step.accent, color: step.accent }}
              >
                {step.n}
              </span>
              <span className="text-white font-extrabold text-[8px] sm:text-xs uppercase tracking-wide leading-tight" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                {step.label}
              </span>
              {i < 3 && (
                <div
                  className="hidden sm:block absolute top-0 right-0 bottom-0 w-px opacity-40"
                  style={{ background: `linear-gradient(to bottom, transparent, ${step.accent}, transparent)` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
