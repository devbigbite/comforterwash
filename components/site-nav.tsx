"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLang } from "@/components/lang-provider"
import { LangToggle } from "@/components/lang-toggle"

// Renders a tenant's own uploaded logo (location.logo_url, set via
// /admin/branding) when one exists; otherwise falls back to the default
// WashFoldClean mark below — a "W" monogram folded like fabric, in the
// tenant's own brand colors — so every un-customized tenant still has a
// real, polished logo instead of a placeholder.
export function Logo({ size = 40, src }: { size?: number; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="object-contain rounded-full" style={{ width: size, height: size }} />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="var(--brand-primary)" />
      {/* Shadow fold, offset slightly for depth */}
      <path d="M11 19 L17 32 L24 21 L31 32 L37 19"
        stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.22" />
      {/* Primary "W" monogram, folded like fabric */}
      <path d="M10 17 L16 31 L24 19 L32 31 L38 17"
        stroke="var(--brand-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// Pages that have their own nav / should not show the site nav
const EXCLUDED_PREFIXES = [
  "/super-admin",
  "/staff",
  "/admin",
  "/operator",
  "/driver",
  "/partner",
  "/track",
  "/book",
]

export function SiteNav({ businessName = "WashFoldClean", logoUrl }: { businessName?: string; logoUrl?: string | null }) {
  const pathname = usePathname()
  const { translations: tr, locale } = useLang()

  if (EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return null

  // Split "WashFold Orlando" -> "WashFold" / "Orlando" so the existing
  // two-line lockup style (bold word + small-caps subtitle) still renders
  // correctly for the original business, while any other tenant's name
  // (edited via /admin/branding) degrades gracefully to the same layout.
  const [logoPrimary, ...logoRestParts] = businessName.split(" ")
  const logoRest = logoRestParts.join(" ")

  // On homepage, nav links scroll to sections; on other pages they go to /#section
  const isHome = pathname === "/"
  const href = (hash: string) => isHome ? hash : `/${hash}`

  // Preserve locale when navigating to standalone pages
  const lp = (path: string) => locale === "es" ? `${path}?lang=es` : path

  const navLinks = [
    { label: tr.nav.pickupDelivery, href: href("#services") },
    { label: tr.nav.howItWorks,     href: href("#how") },
    { label: tr.nav.pricing,        href: href("#pricing") },
    { label: tr.nav.serviceAreas,   href: lp("/service-areas") },
    { label: tr.nav.faq,            href: lp("/faq") },
    { label: tr.nav.commercial,     href: lp("/commercial") },
  ]

  return (
    <>
      {/* Top utility bar */}
      <div className="bg-[var(--brand-primary)] text-white/70 text-xs">
        <div className="mx-auto max-w-7xl px-4 h-9 flex items-center justify-between">
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
            <Logo size={42} src={logoUrl} />
            <div className="leading-tight">
              <span className="block text-[var(--brand-primary)] font-extrabold text-xl tracking-tight leading-none">
                {logoPrimary}
              </span>
              {logoRest && (
                <span className="block text-[var(--brand-primary)]/40 text-[10px] font-semibold uppercase tracking-widest">{logoRest}</span>
              )}
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            {navLinks.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="px-3 py-2 text-sm font-semibold text-[var(--brand-primary)]/60 hover:text-[var(--brand-accent)] transition-colors rounded-lg hover:bg-orange-50 uppercase tracking-wide text-xs"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex-1" />

          <a
            href={href("#services")}
            className="shrink-0 bg-[var(--brand-accent)] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-full transition-colors uppercase tracking-wide shadow-sm"
          >
            {tr.common.schedulePickup}
          </a>
        </div>
      </header>
    </>
  )
}
