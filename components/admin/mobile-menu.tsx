"use client"

import { useState, useEffect } from "react"
import { LogOut, Menu, X } from "lucide-react"
import { logoutAction } from "@/app/admin/login/actions"
import { AdminLangToggle } from "@/components/admin/admin-lang-toggle"
import { AdminViewToggle } from "@/components/admin/admin-view-toggle"

type NavLink = { href: string; label: string; external?: boolean }
type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "dropdown"; label: string; items: NavLink[] }

// Full admin nav crammed into one horizontal row (logo, ~7 dropdowns, Act As,
// Simple/Advanced, language, sign out) is unusable on a phone — it either
// wraps into a multi-line mess or forces horizontal scrolling, and every tap
// target shrinks. Below md, all of that collapses into this hamburger +
// full-screen drawer instead: one thumb-sized button, then a single column
// of big tap targets. Desktop keeps the existing inline header untouched.
export function MobileMenu({
  navItems,
  actAsItems,
  lang,
  viewMode,
}: {
  navItems: NavItem[]
  actAsItems: NavLink[]
  lang: "en" | "es"
  viewMode: "simple" | "advanced"
}) {
  const [open, setOpen] = useState(false)

  // Lock background scroll while the drawer is open — standard mobile-menu
  // behavior, otherwise the page behind scrolls along with the drawer.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  const es = lang === "es"

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={es ? "Abrir menú" : "Open menu"}
        className="flex items-center justify-center w-10 h-10 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-[#0D2240] flex flex-col">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <span className="text-white font-extrabold text-base tracking-tight">
              Wash<span className="text-[#E8726A]">Fold</span>
              <span className="ml-1.5 text-white/30 text-[10px] font-semibold uppercase tracking-widest">Admin</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={es ? "Cerrar menú" : "Close menu"}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">

            {/* Act As — kept visually distinct, top of the drawer since it's
                the highest-value mobile action (an admin jumping straight
                into driver/operator duties on their phone). */}
            <div className="mb-6">
              <p className="text-[#E8726A] text-[11px] font-bold uppercase tracking-widest mb-2">
                {es ? "🎭 Actuar Como" : "🎭 Act As"}
              </p>
              <div className="space-y-1">
                {actAsItems.map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-base px-4 py-3 transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Main nav */}
            <nav className="space-y-1">
              {navItems.map((item, i) =>
                item.type === "link" ? (
                  <a
                    key={i}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block text-white/80 hover:text-white font-semibold text-base px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <details key={i} className="group">
                    <summary className="cursor-pointer list-none flex items-center justify-between text-white/80 hover:text-white font-semibold text-base px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                      {item.label}
                      <span className="text-white/30 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="pl-4 pb-1">
                      {item.items.map(sub => (
                        <a
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpen(false)}
                          className={`block text-sm px-4 py-2.5 rounded-lg transition-colors ${
                            sub.external ? "text-white/40 hover:text-[#E8726A]" : "text-white/60 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  </details>
                )
              )}
            </nav>

            {/* Preferences */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <AdminViewToggle mode={viewMode} lang={lang} />
              <AdminLangToggle lang={lang} />
            </div>
          </div>

          {/* Sign out — pinned to bottom, big tap target */}
          <div className="px-5 py-4 border-t border-white/10 shrink-0">
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 text-white/60 hover:text-white text-sm font-semibold py-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {es ? "Cerrar sesión" : "Sign out"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
