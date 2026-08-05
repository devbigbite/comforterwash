import Link from "next/link"
import { createCommercialAccountSelfServe } from "@/app/actions/commercial-accounts"
import { CommercialSignupForm } from "./signup-form"
import { getBranding } from "@/lib/location"

export async function generateMetadata() {
  const branding = await getBranding()
  return {
    title: `Open a Commercial Account — ${branding.business_name || "WashFoldClean"}`,
  }
}

export default async function CommercialSignupPage() {
  const branding = await getBranding()
  const businessName = branding.business_name || "WashFoldClean"

  return (
    <div className="min-h-screen bg-[#f7f8fb] py-10 px-4">
      <div className="mx-auto max-w-xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="text-3xl mb-3">🏢</div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Open a Commercial Account</h1>
            <p className="text-sm text-gray-400 mt-1">
              {businessName} · Recurring pickup &amp; delivery for your business
            </p>
          </div>
          <p className="text-sm text-gray-500 mb-6 text-center leading-relaxed">
            Tell us about your business below. On the next step you&apos;ll review and sign a short service agreement and add a card on file — your card is only charged after each order is weighed, never up front.
          </p>
          <CommercialSignupForm action={createCommercialAccountSelfServe} />
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/commercial" className="text-[#E8726A] hover:underline">← Back to Commercial Services</Link>
        </p>
      </div>
    </div>
  )
}
