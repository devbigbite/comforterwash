import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { LangProvider } from "@/components/lang-provider"
import type { Locale } from "@/lib/i18n"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "WashFold Orlando – Comforter Wash & Delivery | $29 Any Size",
  description:
    "Professional comforter washing with free pickup & delivery in Orlando. $29 per comforter, any size. 72-hour turnaround. Schedule your pickup online — Mon through Wed.",
  keywords: "comforter cleaning Orlando, comforter wash delivery Orlando, laundry pickup Orlando",
}

export default function RootLayout({
  children,
  searchParams,
}: Readonly<{
  children: React.ReactNode
  searchParams?: { lang?: string }
}>) {
  const initialLocale: Locale =
    searchParams?.lang === "es" ? "es" : "en"

  return (
    <html lang={initialLocale} className={inter.variable}>
      <body className="font-sans antialiased">
        <LangProvider initialLocale={initialLocale}>
          {children}
        </LangProvider>
        <Analytics />
      </body>
    </html>
  )
}
