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
}: {
  tr?: HeroTr
  images?: CarouselImages
  text?: SiteText
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

  const slides = [
    {
      id: 0,
      type: "full" as const,
      headline: text.slide_1_headline || tr?.slide1Headline || DEFAULT_TEXT.slide_1_headline,
      subline:  text.slide_1_subline  || tr?.slide1Sub     || DEFAULT_TEXT.slide_1_subline,
      cta:      text.slide_1_cta      || tr?.slide1Cta     || DEFAULT_TEXT.slide_1_cta,
      overlay: "from-[#0D2240]/80 via-[#0D2240]/50 to-transparent",
      objectPos: "object-center",
    },
    {
      id: 1,
      type: "steps" as const,
      panels: [
        { step: "1", label: text.slide_2_p1_label || DEFAULT_TEXT.slide_2_p1_label, desc: text.slide_2_p1_desc || DEFAULT_TEXT.slide_2_p1_desc, accentColor: "#a78bfa" },
        { step: "2", label: text.slide_2_p2_label || DEFAULT_TEXT.slide_2_p2_label, desc: text.slide_2_p2_desc || DEFAULT_TEXT.slide_2_p2_desc, accentColor: "#38bdf8" },
        { step: "3", label: text.slide_2_p3_label || DEFAULT_TEXT.slide_2_p3_label, desc: text.slide_2_p3_desc || DEFAULT_TEXT.slide_2_p3_desc, accentColor: "#38bdf8" },
      ],
    },
    {
      id: 2,
      type: "full" as const,
      headline: text.slide_3_headline || tr?.slide3Headline || DEFAULT_TEXT.slide_3_headline,
      subline:  text.slide_3_subline  || tr?.slide3Sub     || DEFAULT_TEXT.slide_3_subline,
      cta:      text.slide_3_cta      || tr?.slide3Cta     || DEFAULT_TEXT.slide_3_cta,
      overlay: "from-[#E8726A]/70 via-[#0D2240]/60 to-[#0D2240]/80",
      objectPos: "object-top",
    },
  ]

  const slide = slides[active]
  const currentImage = slideImages[active]
  const isExternal = currentImage.startsWith("http")

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "clamp(380px, 55vw, 560px)" }}>
      {/* Background image — per slide */}
      <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: transitioning ? 0 : 1 }}>
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
      <div className="relative z-10 w-full h-full transition-opacity duration-700" style={{ minHeight: "clamp(380px, 55vw, 560px)", opacity: transitioning ? 0 : 1 }}>

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
              className="object-cover object-center"
              unoptimized={isExternal}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/75" />
            <div className="absolute inset-0 grid grid-cols-3">
              {slide.panels.map((panel, i) => (
                <div key={i} className="relative flex flex-col justify-end p-3 sm:p-5 md:p-7">
                  <div className="flex items-center gap-1.5 sm:gap-3 mb-1">
                    <span
                      className="flex items-center justify-center w-6 h-6 sm:w-9 sm:h-9 rounded-full text-xs sm:text-base font-extrabold border-2 shrink-0"
                      style={{ borderColor: panel.accentColor, color: panel.accentColor }}
                    >
                      {panel.step}
                    </span>
                    <span className="text-white font-extrabold text-xs sm:text-base md:text-lg uppercase tracking-wide drop-shadow leading-tight">
                      {panel.label}
                    </span>
                  </div>
                  <p className="text-white/80 text-[10px] sm:text-sm leading-snug sm:ml-12 hidden sm:block">{panel.desc}</p>
                  {i < 2 && (
                    <div
                      className="absolute top-0 right-0 bottom-0 w-px opacity-40"
                      style={{ background: `linear-gradient(to bottom, transparent, ${panel.accentColor}, transparent)` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
