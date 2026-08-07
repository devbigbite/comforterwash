"use client"
import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"

type NavLink = { href: string; label: string; external?: boolean }

// Tap/click-to-open dropdown for the admin header nav — the old version
// opened purely on CSS :hover, which works on desktop but is unreliable on
// touch screens (no real hover state, so it's tap-then-tap-again at best).
// Solo/home-based operators are the ones most likely to be on a phone
// mid-route, so this needs to work cleanly on tap: click the label to
// toggle, click anywhere outside to close, click a link to navigate.
export function NavDropdown({ label, items, accent }: { label: string; items: NavLink[]; accent?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onOutside)
    document.addEventListener("touchstart", onOutside)
    return () => {
      document.removeEventListener("mousedown", onOutside)
      document.removeEventListener("touchstart", onOutside)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          accent
            ? `flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                open ? "bg-[#E8726A] text-white" : "bg-[#E8726A]/15 text-[#E8726A] hover:bg-[#E8726A]/25"
              }`
            : "flex items-center gap-1 text-white/60 hover:text-white text-sm font-medium transition-colors py-1 whitespace-nowrap"
        }
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-2 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 min-w-[170px] overflow-hidden">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm transition-colors whitespace-nowrap ${
                  item.external
                    ? "text-gray-400 hover:text-[#E8726A] hover:bg-[#E8726A]/5"
                    : "text-[#0D2240] hover:text-[#E8726A] hover:bg-[#E8726A]/5"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
