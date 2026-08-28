import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import { cookies } from "next/headers"
import { LangProvider } from "@/components/lang-provider"
import { SiteNav } from "@/components/site-nav"
import type { Locale } from "@/lib/i18n"
import { getBranding, getLocationId, WASHFOLD_DEMO_LOCATION_ID } from "@/lib/location"
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
  const isDemo = !!cookieStore.get("demo_location_id")?.value
  // The WashFoldDemo *tenant* itself (browsed directly, not via the ?as=
  // impersonation cookie above) — a prospect landing on washfoldclean.com
  // should be told this is a sandbox and pointed at the real, live site.
  const isDemoTenant = (await getLocationId()) === WASHFOLD_DEMO_LOCATION_ID

  return (
    <html
      lang={initialLocale}
      className={inter.variable}
      style={{ "--brand-primary": branding.primary_color, "--brand-accent": branding.accent_color } as React.CSSProperties}
    >
      <body className="font-sans antialiased">
        {branding.fb_pixel_id && (
          <>
            <Script id="fb-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${branding.fb_pixel_id}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${branding.fb_pixel_id}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
        <LangProvider initialLocale={initialLocale}>
          {isDemo && (
            <div className="sticky top-0 z-[60] bg-[#0D2240] text-white text-sm font-semibold text-center py-2 px-4">
              👋 You're viewing the WashFoldClean Demo — no real orders or payments happen here.{" "}
              <a href="/demo/exit" className="underline underline-offset-2 hover:opacity-80">
                Exit Demo
              </a>
            </div>
          )}
          {!isDemo && isDemoTenant && (
            <div className="sticky top-0 z-[60] bg-[#0D2240] text-white text-lg font-semibold text-center py-3 px-4">
              This site is a demo. To schedule live service, visit{" "}
              <a href="https://washfoldorlando.com" className="underline underline-offset-2 hover:opacity-80">
                washfoldorlando.com
              </a>
            </div>
          )}
          <SiteNav businessName={branding.business_name ?? undefined} logoUrl={branding.logo_url} landingTemplate={branding.landing_page_template} />
          {children}
        </LangProvider>
        <Analytics />
      </body>
    </html>
  )
}
