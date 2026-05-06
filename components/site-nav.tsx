"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLang } from "@/components/lang-provider"
import { LangToggle } from "@/components/lang-toggle"

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#0D2240" />
      <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
        stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M10 29 Q13 24 16 29 Q19 34 22 29 Q25 24 28 29 Q31 34 34 29"
        stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.25" />
    </svg>
  )
}

// Pages that have their own nav / should not show the site nav
const EXCLUDED_PREFIXES = [
  "/admin",
  "/operator",
  "/driver",
  "/partner",
  "/track",
  "/book",
]

export function SiteNav() {
  const pathname = usePathname()
  const { translations: tr } = useLang()

  if (EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return null

  // On homepage, nav links scroll to sections; on other pages they go to /#section
  const isHome = pathname === "/"
  const href = (hash: string) => isHome ? hash : `/${hash}`

  const navLinks = [
    { label: tr.nav.pickupDelivery, href: href("#services") },
    { label: tr.nav.howItWorks,     href: href("#how") },
    { label: tr.nav.pricing,        href: href("#pricing") },
    { label: tr.nav.serviceAreas,   href: "/service-areas" },
    { label: tr.nav.faq,            href: href("#faq") },
  ]

  return (
    <>
      {/* Top utility bar */}
      <div className="bg-[#0D2240] text-white/70 text-xs">
        <div className="mx-auto max-w-7xl px-4 h-9 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-[#E8726A]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              (407) 555-0100
            </span>
            <span className="hidden sm:inline text-white/30">|</span>
            <span className="hidden sm:inline">{tr.common.hours}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-white transition-colors">{tr.common.signIn}</Link>
            <Link href="/account" className="hover:text-white transition-colors">{tr.common.myAccount}</Link>
            <LangToggle />
          </div>
        </div>
      </div>

      {/* Main nav header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 h-18 flex items-center gap-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Logo size={42} />
            <div className="leading-tight">
              <span className="block text-[#0D2240] font-extrabold text-xl tracking-tight leading-none">
                Wash<span className="text-[#E8726A]">Fold</span>
              </span>
              <span className="block text-[#0D2240]/40 text-[10px] font-semibold uppercase tracking-widest">Orlando</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            {navLinks.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="px-3 py-2 text-sm font-semibold text-[#0D2240]/60 hover:text-[#E8726A] transition-colors rounded-lg hover:bg-orange-50 uppercase tracking-wide text-xs"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex-1" />

          <a
            href={href("#services")}
            className="shrink-0 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-full transition-colors uppercase tracking-wide shadow-sm"
          >
            {tr.common.schedulePickup}
          </a>
        </div>
      </header>
    </>
  )
}
