"use client"

import { useState } from "react"

interface Bag {
  id: string
  bag_number: number
  label_code: string
}

const COLOR_MAP: Record<string, { label: string; hex: string }> = {
  red:     { label: "Red",      hex: "#ef4444" },
  blue:    { label: "Blue",     hex: "#3b82f6" },
  sky:     { label: "Sky Blue", hex: "#38bdf8" },
  green:   { label: "Green",    hex: "#22c55e" },
  lime:    { label: "Lime",     hex: "#84cc16" },
  pink:    { label: "Pink",     hex: "#f472b6" },
  hotpink: { label: "Hot Pink", hex: "#ec4899" },
  orange:  { label: "Orange",   hex: "#f97316" },
  yellow:  { label: "Yellow",   hex: "#eab308" },
  purple:  { label: "Purple",   hex: "#a855f7" },
}

interface Props {
  orderCode: string
  customerName: string
  customerAddress: string
  bags: Bag[]
  colorKey?: string | null
}

export default function LabelReference({ orderCode, customerName, customerAddress, bags, colorKey }: Props) {
  const color = colorKey ? COLOR_MAP[colorKey] : null
  const [fullscreen, setFullscreen] = useState(false)
  const [activeBag, setActiveBag] = useState(0)

  if (fullscreen) {
    const bag = bags[activeBag]
    return (
      <div className="fixed inset-0 z-50 bg-[#0D2240] flex flex-col items-center justify-center px-8">
        <p className="absolute top-5 right-5 text-white/30 text-xs uppercase tracking-widest cursor-pointer"
          onClick={() => setFullscreen(false)}>Tap to close</p>

        <p className="text-white/40 text-sm font-semibold uppercase tracking-widest mb-1">{customerName}</p>
        <p className="text-white/30 text-xs mb-8 text-center">{customerAddress}</p>

        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.3em] mb-3">Write on this bag</p>

        {/* Order code */}
        <p className="text-white font-black font-mono tracking-widest"
          style={{ fontSize: "clamp(3rem, 14vw, 5.5rem)", lineHeight: 1 }}>
          {orderCode}
        </p>

        {/* Bag number */}
        <p className="text-[#E8726A] font-black font-mono mt-3"
          style={{ fontSize: "clamp(2rem, 10vw, 4rem)", lineHeight: 1 }}>
          {bag ? `B${bag.bag_number}` : ""}
        </p>

        <p className="mt-3 text-white/30 text-xs text-center">
          {bag?.label_code ?? ""}
        </p>

        {/* Color key */}
        {color && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-white/30 text-[10px] uppercase tracking-widest">Color sticker</p>
            <span className="w-14 h-14 rounded-2xl ring-4 ring-white/20 shadow-lg"
              style={{ background: color.hex }} />
            <p className="font-black text-white text-lg tracking-wide">{color.label.toUpperCase()}</p>
          </div>
        )}

        {/* Bag navigation */}
        {bags.length > 1 && (
          <div className="mt-10 flex items-center gap-4">
            <button
              onClick={() => setActiveBag(i => Math.max(0, i - 1))}
              disabled={activeBag === 0}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white font-extrabold text-xl flex items-center justify-center transition-colors">
              ←
            </button>
            <p className="text-white/50 text-sm font-bold">
              Bag {activeBag + 1} of {bags.length}
            </p>
            <button
              onClick={() => setActiveBag(i => Math.min(bags.length - 1, i + 1))}
              disabled={activeBag === bags.length - 1}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white font-extrabold text-xl flex items-center justify-center transition-colors">
              →
            </button>
          </div>
        )}

        <p className="mt-10 text-white/20 text-xs text-center">
          Write order code + bag number on the color sticker
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#0D2240] rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            Label all {bags.length} bag{bags.length !== 1 ? "s" : ""}
          </p>
          <p className="text-white font-black font-mono text-3xl tracking-widest leading-none">{orderCode}</p>
          {/* Per-bag codes */}
          <div className="flex flex-wrap gap-2 mt-2">
            {bags.map(bag => (
              <span key={bag.id}
                className="text-[#E8726A] font-bold font-mono text-sm bg-white/10 rounded-lg px-2 py-0.5">
                {orderCode} · B{bag.bag_number}
              </span>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-1.5 truncate">{customerName}</p>
          {color && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-4 h-4 rounded-full ring-1 ring-white/20 shrink-0"
                style={{ background: color.hex }} />
              <span className="text-white/50 text-[10px] font-bold uppercase tracking-wide">{color.label} sticker</span>
            </div>
          )}
        </div>
        <button
          onClick={() => { setActiveBag(0); setFullscreen(true) }}
          className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-white/10 hover:bg-white/20 transition-colors gap-1"
          aria-label="Fullscreen label view"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
          <span className="text-white/40 text-[9px] font-bold uppercase tracking-wide">Full</span>
        </button>
      </div>
    </div>
  )
}
