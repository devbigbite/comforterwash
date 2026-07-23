import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { cookies } from "next/headers"
import { LangProvider } from "@/components/lang-provider"
import { SiteNav } from "@/components/site-nav"
import type { Locale } from "@/lib/i18n"
import { getBranding } from "@/lib/location"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
})

// Per-tenant page title/description — falls back to the original WashFold
// Orlando copy if a tenant hasn't set a tagline yet.
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding()
  const tagline = b.tagline ?? "Comforter Wash & Delivery | $33 Any Size"
  return {
    title: `${b.business_name} – ${tagline}`,
    description:
      "Professional comforter washing with free pickup & delivery. $33 per comforter, any size. 72-hour turnaround. Schedule your pickup online — Mon through Wed.",
    keywords: "comforter cleaning, comforter wash delivery, laundry pickup",
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Layouts in the App Router never receive searchParams (only page.tsx
  // does) — reading it here always resolved to undefined, so this used to
  // silently default to "en" no matter what URL was loaded. Cookies, unlike
  // searchParams, ARE available in layouts, and are the mechanism the
  // EN/ES toggle now writes to (see app/actions/site-lang.ts).
  const cookieStore = await cookies()
  const initialLocale: Locale = cookieStore.get("wf_locale")?.value === "es" ? "es" : "en"
  const branding = await getBranding()

  return (
    <html
      lang={initialLocale}
      className={inter.variable}
      style={{ "--brand-primary": branding.primary_color, "--brand-accent": branding.accent_color } as React.CSSProperties}
    >
      <body className="font-sans antialiased">
        <LangProvider initialLocale={initialLocale}>
          <SiteNav businessName={branding.business_name ?? undefined} />
          {children}
        </LangProvider>
        <Analytics />
      </body>
    </html>
  )
}
