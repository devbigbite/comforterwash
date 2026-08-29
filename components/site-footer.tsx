"use client"

import { usePathname } from "next/navigation"

// Internal / back-office tools -- not customer- or tenant-owner-facing, so
// no "Powered by" branding here. Mirrors the pattern in site-nav.tsx's
// EXCLUDED_PREFIXES, but deliberately narrower: this footer is meant to
// show on every public-facing surface (marketing pages, booking flow,
// order tracking, the /platform pitch site, etc.) and only hide on screens
// staff/drivers/operators use to run the business.
const EXCLUDED_PREFIXES = [
  "/super-admin",
  "/staff",
  "/admin",
  "/operator",
  "/driver",
  "/partner",
]

export function SiteFooter() {
  const pathname = usePathname()
  if (EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return null

  return (
    <footer className="py-6 px-4 text-center border-t border-gray-100">
      <p className="text-xs text-gray-400">
        Powered by{" "}
        <a
          href="https://washfoldkit.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-gray-500 hover:text-[var(--brand-primary)] transition-colors"
        >
          WashFoldKit.com
        </a>
      </p>
    </footer>
  )
}
