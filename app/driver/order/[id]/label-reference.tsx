"use client"

import { useState } from "react"

interface Bag {
  id: string
  bag_number: number
  label_code: string
}

interface Props {
  orderCode: string
  customerName: string
  customerAddress: string
  bags: Bag[]
}

export default function LabelReference({ orderCode, customerName, customerAddress, bags }: Props) {
  const [fullscreen, setFullscreen] = useState(false)

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-[#0D2240] flex flex-col items-center justify-center px-8 cursor-pointer"
        onClick={() => setFullscreen(false)}
      >
        {/* Dismiss hint */}
        <p className="absolute top-5 right-5 text-white/30 text-xs uppercase tracking-widest">Tap to close</p>

        {/* Customer confirmation */}
        <p className="text-white/40 text-sm font-semibold uppercase tracking-widest mb-1">{customerName}</p>
        <p className="text-white/30 text-xs mb-10 text-center">{customerAddress}</p>

        {/* Order code — huge */}
        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.3em] mb-2">Order Code</p>
        <p className="text-white font-black font-mono tracking-widest mb-12"
          style={{ fontSize: "clamp(3rem, 15vw, 6rem)", lineHeight: 1 }}>
          {orderCode}
        </p>

        {/* Per-bag codes */}
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {bags.map((bag) => (
            <div key={bag.id} className="flex items-center justify-between bg-white/10 rounded-2xl px-6 py-4">
              <span className="text-white/50 font-bold text-sm">Bag {bag.bag_number}</span>
              <span className="text-white font-black font-mono text-2xl tracking-wider">{bag.label_code}</span>
            </div>
          ))}
        </div>

        <p className="mt-12 text-white/20 text-xs text-center">
          Write code on each bag with sharpie · one code per bag
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#0D2240] rounded-2xl overflow-hidden shadow-sm">
      {/* Compact view */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-0.5">Write on bags</p>
          <p className="text-white font-black font-mono text-3xl tracking-widest leading-none">{orderCode}</p>
          <p className="text-white/30 text-xs mt-1 truncate">{customerName} · {bags.length} bag{bags.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setFullscreen(true)}
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

      {/* Bag codes strip */}
      <div className="border-t border-white/10 px-5 py-3 flex flex-wrap gap-2">
        {bags.map((bag) => (
          <div key={bag.id} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5">
            <span className="text-white/30 text-[10px] font-bold">B{bag.bag_number}</span>
            <span className="text-white font-black font-mono text-sm tracking-wider">{bag.label_code}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
