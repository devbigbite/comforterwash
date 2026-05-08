"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import type { TranslationKeys } from "@/lib/translations/en"
import { DEFAULT_TEXT, type SiteText } from "@/lib/site-text-config"

type HeroTr = TranslationKeys["hero"]

const SLIDE_COUNT = 3

interface CarouselImages {
  slide1: string
  slide2: string
  slide3: string
}

const DEFAULT_CAROUSEL_IMAGES: CarouselImages = {
  slide1: "/hero-banner.jpg",
  slide2: "/hero-banner.jpg",
  slide3: "/hero-banner.jpg",
}

export default function HeroCarousel({
  tr,
  images = DEFAULT_CAROUSEL_IMAGES,
  text = DEFAULT_TEXT,
  lang = "en",
}: {
  tr?: HeroTr
  images?: CarouselImages
  text?: SiteText
  lang?: "en" | "es"
}) {
  const [active, setActive] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const goTo = useCallback(
    (index: number) => {
      if (transitioning || index === active) return
      setTransitioning(true)
      setTimeout(() => {
        setActive(index)
        setTransitioning(false)
      }, 350)
    },
    [active, transitioning]
  )

  const next = useCallback(() => {
    goTo((active + 1) % SLIDE_COUNT)
  }, [active, goTo])

  useEffect(() => {
    const timer = setInterval(next, 5500)
    return () => clearInterval(timer)
  }, [next])

  // Per-slide image lookup
  const slideImages = [images.slide1, images.slide2, images.slide3]

  const es = lang === "es"

  const slides = [
    {
      id: 0,
      type: "full" as const,
      headline: (es ? text.slide_1_headline_es : text.slide_1_headline) || tr?.slide1Headline || DEFAULT_TEXT.slide_1_headline,
      subline:  (es ? text.slide_1_subline_es  : text.slide_1_subline)  || tr?.slide1Sub     || DEFAULT_TEXT.slide_1_subline,
      cta:      (es ? text.slide_1_cta_es      : text.slide_1_cta)      || tr?.slide1Cta     || DEFAULT_TEXT.slide_1_cta,
      overlay: "from-[#0D2240]/80 via-[#0D2240]/50 to-transparent",
      objectPos: "object-center",
    },
    {
      id: 1,
      type: "steps" as const,
      panels: [
        { step: "1", label: (es ? text.slide_2_p1_label_es : text.slide_2_p1_label) || DEFAULT_TEXT.slide_2_p1_label, desc: (es ? text.slide_2_p1_desc_es : text.slide_2_p1_desc) || DEFAULT_TEXT.slide_2_p1_desc, accentColor: "#a78bfa" },
        { step: "2", label: (es ? text.slide_2_p2_label_es : text.slide_2_p2_label) || DEFAULT_TEXT.slide_2_p2_label, desc: (es ? text.slide_2_p2_desc_es : text.slide_2_p2_desc) || DEFAULT_TEXT.slide_2_p2_desc, accentColor: "#38bdf8" },
        { step: "3", label: (es ? text.slide_2_p3_label_es : text.slide_2_p3_label) || DEFAULT_TEXT.slide_2_p3_label, desc: (es ? text.slide_2_p3_desc_es : text.slide_2_p3_desc) || DEFAULT_TEXT.slide_2_p3_desc, accentColor: "#38bdf8" },
      ],
    },
    {
      id: 2,
      type: "full" as const,
      headline: (es ? text.slide_3_headline_es : text.slide_3_headline) || tr?.slide3Headline || DEFAULT_TEXT.slide_3_headline,
      subline:  (es ? text.slide_3_subline_es  : text.slide_3_subline)  || tr?.slide3Sub     || DEFAULT_TEXT.slide_3_subline,
      cta:      (es ? text.slide_3_cta_es      : text.slide_3_cta)      || tr?.slide3Cta     || DEFAULT_TEXT.slide_3_cta,
      overlay: "from-[#E8726A]/70 via-[#0D2240]/60 to-[#0D2240]/80",
      objectPos: "object-top",
    },
  ]

  const slide = slides[active]
  const currentImage = slideImages[active]
  const isExternal = currentImage.startsWith("http")

  return (
    <section className="relative w-full overflow-hidden bg-[#0D2240] -mb-px" style={{ minHeight: "clamp(460px, 70vw, 580px)" }}>
      {/* Background image — per slide */}
      <div className={"absolute inset-x-0 top-0 transition-opacity duration-700 " + (slide.type === "full" ? "bottom-16" : "bottom-0")} style={{ opacity: transitioning ? 0 : 1 }}>
        {slide.type === "full" && (
          <Image
            src={currentImage}
            alt="WashFold Orlando"
            fill
            className={`object-cover ${slide.objectPos}`}
            priority
            unoptimized={isExternal}
          />
        )}
      </div>

      {/* Slide content */}
      <div className="relative z-10 w-full h-full transition-opacity duration-700" style={{ minHeight: "clamp(420px, 65vw, 560px)", opacity: transitioning ? 0 : 1 }}>

        {/* Full-width text slide */}
        {slide.type === "full" && (
          <div className={`absolute inset-0 bg-gradient-to-r ${slide.overlay} flex items-center`}>
            <div className="mx-auto max-w-7xl px-5 sm:px-8 w-full">
              <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.25em] mb-2 sm:mb-3">WashFold Orlando</p>
              <h1 className="text-white font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight max-w-2xl mb-3 sm:mb-4 drop-shadow-lg">
                {slide.headline}
              </h1>
              <p className="text-white/75 text-sm sm:text-base md:text-lg max-w-xl mb-5 sm:mb-8">{slide.subline}</p>
              <a href="#services" className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 sm:px-8 py-3 sm:py-3.5 rounded-full uppercase tracking-wide transition-colors shadow-lg">
                {slide.cta}
              </a>
            </div>
          </div>
        )}

        {/* 3-panel steps slide — panoramic image spans all 3 panels */}
        {slide.type === "steps" && (
          <div className="absolute inset-0">
            <Image
              src={currentImage}
              alt="How it works"
              fill
              className="object-contain sm:object-cover object-center"
              unoptimized={isExternal}
            />
            {/* Gradient: dark at bottom for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0D2240]/90" />

            {/* Mobile: centered label above + 3 step badges row */}
            <div className="absolute inset-x-0 bottom-0 pb-12 px-4 flex flex-col items-center gap-4 sm:hidden">
              <p className="text-white font-extrabold text-xl uppercase tracking-widest drop-shadow text-center">
                How It Works
              </p>
              <div className="flex items-stretch gap-2 w-full max-w-sm">
                {slide.panels.map((panel, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-xl px-2 py-3 border border-white/10">
                    <span
                      className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-extrabold border-2 shrink-0"
                      style={{ borderColor: panel.accentColor, color: panel.accentColor }}
                    >
                      {panel.step}
                    </span>
                    <span className="text-white font-extrabold text-[11px] uppercase tracking-wide text-center leading-tight">
                      {panel.label}
                    </span>
                    <p className="text-white/70 text-[10px] leading-snug text-center">{panel.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: full-height 3-column panels */}
            <div className="absolute inset-0 hidden sm:grid grid-cols-3">
              {slide.panels.map((panel, i) => (
                <div key={i} className="relative flex flex-col justify-end p-5 md:p-7">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span
                      className="flex items-center justify-center w-9 h-9 rounded-full text-base font-extrabold border-2 shrink-0"
                      style={{ borderColor: panel.accentColor, color: panel.accentColor }}
                    >
                      {panel.step}
                    </span>
                    <span className="text-white font-extrabold text-base md:text-lg uppercase tracking-wide drop-shadow leading-tight">
                      {panel.label}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm leading-snug ml-12">{panel.desc}</p>

                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom-edge fade + solid strip guarantee */}
      <div className={"absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-[#0D2240] pointer-events-none z-10 " + (slide.type === "steps" ? "h-16" : "h-32")} />
      <div className="absolute inset-x-0 bottom-0 h-2 bg-[#0D2240] pointer-events-none z-20" />

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2.5 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            className="transition-all duration-300 rounded-full"
            style={{ width: i === active ? "24px" : "8px", height: "8px", background: i === active ? "#E8726A" : "rgba(255,255,255,0.5)" }}
          />
        ))}
      </div>

      {/* Arrows */}
      <button
        onClick={() => goTo((active - 1 + SLIDE_COUNT) % SLIDE_COUNT)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
        aria-label="Previous"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button
        onClick={() => goTo((active + 1) % SLIDE_COUNT)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
        aria-label="Next"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </section>
  )
}
