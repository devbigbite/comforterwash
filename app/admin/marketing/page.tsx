import { requireAdmin } from "@/lib/auth-guard"
import { getMarketingSettings } from "@/app/actions/marketing-settings"
import { getSmsCampaigns } from "@/app/actions/sms-campaigns"
import { getReferralStats } from "@/app/actions/referrals"
import { MarketingClient } from "./marketing-client"

export default async function MarketingPage() {
  await requireAdmin()
  const [settings, campaigns, referralStats] = await Promise.all([
    getMarketingSettings(),
    getSmsCampaigns(),
    getReferralStats(),
  ])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Marketing</h1>
        <p className="text-sm text-gray-400">
          SMS campaigns, abandoned-cart recovery, automated re-engagement, and your referral program — all in one place.
        </p>
      </div>
      <MarketingClient initialSettings={settings} initialCampaigns={campaigns} referralStats={referralStats} />
    </div>
  )
}
