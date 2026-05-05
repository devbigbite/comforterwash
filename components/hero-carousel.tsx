"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"

const slides = [
  {
    id: 1,
    type: "full",
    headline: "Laundry Service That Feels Like Family",
    subline: "Free pickup & delivery · Wash, fold & comforter cleaning · Orlando FL",
    cta: "Schedule a Pickup",
    overlay: "from-[#0D2240]/80 via-[#0D2240]/50 to-transparent",
    objectPos: "object-center",
  },
  {
    id: 2,
    type: "steps",
    panels: [
      {
        step: "1",
        label: "ORDER",
        desc: "Schedule your pickup in seconds",
        objectPos: "object-left",
        accentColor: "#a78bfa", // purple
      },
      {
        step: "2",
        label: "WE PICK UP",
        desc: "We pick up your laundry right from your door",
        objectPos: "object-center",
        accentColor: "#38bdf8", // blue
      },
      {
        step: "3",
        label: "WE DELIVER",
        desc: "Fresh, clean & folded delivered to you",
        objectPos: "object-right",
        accentColor: "#38bdf8", // blue
      },
    ],
  },
  {
    id: 3,
    type: "full",
    headline: "We Come to You. You Enjoy Life.",
    subline: "Professional wash & fold starting at $1.89/lb · Comforters from $29",
    cta: "See Pricing",
    overlay: "from-[#E8726A]/70 via-[#0D2240]/60 to-[#0D2240]/80",
    objectPos: "object-top",
  },
]

export default function HeroCarousel() {
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
    goTo((active + 1) % slides.length)
  }, [active, goTo])

  useEffect(() => {
    const timer = setInterval(next, 5500)
    return () => clearInterval(timer)
  }, [next])

  const slide = slides[active]

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "460px" }}>
      {/* Background image layer — fades between slides */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        <Image
          src="/sweet-sleep.jpg"
          alt="WashFold Orlando"
          fill
          className={`object-cover ${slide.type === "full" ? (slide as typeof slides[0]).objectPos : "object-center"}`}
          priority
        />
      </div>

      {/* Slide content */}
      <div
        className="relative z-10 w-full h-full transition-opacity duration-700"
        style={{ minHeight: "460px", opacity: transitioning ? 0 : 1 }}
      >
        {slide.type === "full" && (() => {
          const s = slide as typeof slides[0]
          return (
            <div className={`absolute inset-0 bg-gradient-to-r ${s.overlay} flex items-center`}>
              <div className="mx-auto max-w-7xl px-8 w-full">
                <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.25em] mb-3">
                  WashFold Orlando
                </p>
                <h1 className="text-white font-extrabold text-4xl md:text-5xl lg:text-6xl leading-tight max-w-2xl mb-4 drop-shadow-lg">
                  {s.headline}
                </h1>
                <p className="text-white/75 text-base md:text-lg max-w-xl mb-8">
                  {s.subline}
                </p>
                <a
                  href="#services"
                  className="inline-block bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-8 py-3.5 rounded-full uppercase tracking-wide transition-colors shadow-lg"
                >
                  {s.cta}
                </a>
              </div>
            </div>
          )
        })()}

        {slide.type === "steps" && (() => {
          const s = slide as typeof slides[1]
          return (
            <div className="absolute inset-0 grid grid-cols-3">
              {s.panels.map((panel, i) => (
                <div key={i} className="relative overflow-hidden">
                  <Image
                    src="/sweet-sleep.jpg"
                    alt={panel.label}
                    fill
                    className={`object-cover ${panel.objectPos}`}
                  />
                  {/* Diagonal divider effect via clip-path on overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />
                  {/* Step content pinned to bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className="flex items-center justify-center w-9 h-9 rounded-full text-base font-extrabold border-2 text-white shrink-0"
                        style={{ borderColor: panel.accentColor, color: panel.accentColor }}
                      >
                        {panel.step}
                      </span>
                      <span className="text-white font-extrabold text-base md:text-lg uppercase tracking-wide drop-shadow">
                        {panel.label}
                      </span>
                    </div>
                    <p className="text-white/80 text-sm leading-snug ml-12">{panel.desc}</p>
                  </div>
                  {/* Vertical divider line */}
                  {i < 2 && (
                    <div
                      className="absolute top-0 right-0 bottom-0 w-px opacity-40"
                      style={{ background: `linear-gradient(to bottom, transparent, ${panel.accentColor}, transparent)` }}
                    />
                  )}
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Dots navigation */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2.5 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === active ? "24px" : "8px",
              height: "8px",
              background: i === active ? "#E8726A" : "rgba(255,255,255,0.5)",
            }}
          />
        ))}
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick={() => goTo((active - 1 + slides.length) % slides.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
        aria-label="Previous slide"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        onClick={() => goTo((active + 1) % slides.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
        aria-label="Next slide"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </section>
  )
}
