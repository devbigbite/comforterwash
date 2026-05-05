"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import type { TranslationKeys } from "@/lib/translations/en"

type HeroTr = TranslationKeys["hero"]

const SLIDE_COUNT = 3

export default function HeroCarousel({ tr }: { tr?: HeroTr }) {
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

  // Slide configs — static layout props, translated text from tr
  const slides = [
    {
      id: 0,
      type: "full" as const,
      headline: tr?.slide1Headline ?? "Laundry Service That Feels Like Family",
      subline: tr?.slide1Sub ?? "Free pickup & delivery · Wash, fold & comforter cleaning · Orlando FL",
      cta: tr?.slide1Cta ?? "Schedule a Pickup",
      overlay: "from-[#0D2240]/80 via-[#0D2240]/50 to-transparent",
      objectPos: "object-center",
    },
    {
      id: 1,
      type: "steps" as const,
      panels: [
        { step: "1", label: tr?.slide2Order ?? "ORDER", desc: tr?.slide2OrderDesc ?? "Schedule your pickup in seconds", objectPos: "object-left", accentColor: "#a78bfa" },
        { step: "2", label: tr?.slide2Pickup ?? "WE PICK UP", desc: tr?.slide2PickupDesc ?? "We pick up your laundry right from your door", objectPos: "object-center", accentColor: "#38bdf8" },
        { step: "3", label: tr?.slide2Deliver ?? "WE DELIVER", desc: tr?.slide2DeliverDesc ?? "Fresh, clean & folded delivered to you", objectPos: "object-right", accentColor: "#38bdf8" },
      ],
    },
    {
      id: 2,
      type: "full" as const,
      headline: tr?.slide3Headline ?? "We Come to You. You Enjoy Life.",
      subline: tr?.slide3Sub ?? "Professional wash & fold starting at $2.50/lb · Comforters from $33",
      cta: tr?.slide3Cta ?? "See Pricing",
      overlay: "from-[#E8726A]/70 via-[#0D2240]/60 to-[#0D2240]/80",
      objectPos: "object-top",
    },
  ]

  const slide = slides[active]

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "460px" }}>
      {/* Background image */}
      <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: transitioning ? 0 : 1 }}>
        <Image
          src="/hero-banner.jpg"
          alt="WashFold Orlando"
          fill
          className={`object-cover ${slide.type === "full" ? slide.objectPos : "object-center"}`}
          priority
        />
      </div>

      {/* Slide content */}
      <div className="relative z-10 w-full h-full transition-opacity duration-700" style={{ minHeight: "460px", opacity: transitioning ? 0 : 1 }}>

        {/* Full-width text slide */}
        {slide.type === "full" && (
          <div className={`absolute inset-0 bg-gradient-to-r ${slide.overlay} flex items-center`}>
            <div className="mx-auto max-w-7xl px-8 w-full">
              <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.25em] mb-3">WashFold Orlando</p>
              <h1 className="text-white font-extrabold text-4xl md:text-5xl lg:text-6xl leading-tight max-w-2xl mb-4 drop-shadow-lg">
                {slide.headline}
              </h1>
              <p className="text-white/75 text-base md:text-lg max-w-xl mb-8">{slide.subline}</p>
              <a href="#services" className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3.5 rounded-full uppercase tracking-wide transition-colors shadow-lg">
                {slide.cta}
              </a>
            </div>
          </div>
        )}

        {/* 3-panel steps slide */}
        {slide.type === "steps" && (
          <div className="absolute inset-0 grid grid-cols-3">
            {slide.panels.map((panel, i) => (
              <div key={i} className="relative overflow-hidden">
                <Image src="/hero-banner.jpg" alt={panel.label} fill className={`object-cover ${panel.objectPos}`} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />
                <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="flex items-center justify-center w-9 h-9 rounded-full text-base font-extrabold border-2 shrink-0"
                      style={{ borderColor: panel.accentColor, color: panel.accentColor }}>
                      {panel.step}
                    </span>
                    <span className="text-white font-extrabold text-base md:text-lg uppercase tracking-wide drop-shadow">
                      {panel.label}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm leading-snug ml-12">{panel.desc}</p>
                </div>
                {i < 2 && (
                  <div className="absolute top-0 right-0 bottom-0 w-px opacity-40"
                    style={{ background: `linear-gradient(to bottom, transparent, ${panel.accentColor}, transparent)` }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2.5 z-20">
        {slides.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}
            className="transition-all duration-300 rounded-full"
            style={{ width: i === active ? "24px" : "8px", height: "8px", background: i === active ? "#E8726A" : "rgba(255,255,255,0.5)" }} />
        ))}
      </div>

      {/* Arrows */}
      <button onClick={() => goTo((active - 1 + SLIDE_COUNT) % SLIDE_COUNT)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors" aria-label="Previous">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button onClick={() => goTo((active + 1) % SLIDE_COUNT)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors" aria-label="Next">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </section>
  )
}
