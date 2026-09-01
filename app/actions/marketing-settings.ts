"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export interface MarketingSettings {
  // Abandoned Cart Recovery
  abandonedCartEnabled: boolean
  abandonedCartDelayHours: number       // how long after an abandoned checkout to wait before texting
  abandonedCartPromoCode: string        // an existing promo_codes code to reference in the message (optional)
  abandonedCartMessage: string          // supports {name} and {code} tokens

  // Automated Re-Engagement
  reengagementEnabled: boolean
  reengagementDormantDays: number       // customers with no booking in this many days are eligible
  reengagementIntervalDays: number      // don't re-text the same customer more often than this
  reengagementMessage: string           // supports {name} token

  // Referral Program
  referralEnabled: boolean
  referralRefereeCreditCents: number    // discount the NEW customer gets for using a referral code
  referralReferrerCreditCents: number   // credit the REFERRING customer earns once the referred order is paid
  referralCreditExpiresDays: number
  referralMonthlyCapCents: number       // max referrer-bonus credit a single customer can earn per calendar month
}

const DEFAULTS: MarketingSettings = {
  abandonedCartEnabled: false,
  abandonedCartDelayHours: 2,
  abandonedCartPromoCode: "",
  abandonedCartMessage: "Hi {name}! Looks like you didn't finish booking your pickup. Come back and use code {code} for a discount on your order.",
  reengagementEnabled: false,
  reengagementDormantDays: 60,
  reengagementIntervalDays: 30,
  reengagementMessage: "Hi {name}! It's been a while — we'd love to have you back. Book your next pickup whenever works for you!",
  referralEnabled: false,
  referralRefereeCreditCents: 1000,
  referralReferrerCreditCents: 1000,
  referralCreditExpiresDays: 90,
  referralMonthlyCapCents: 5000,
}

const KEYS: Record<keyof MarketingSettings, string> = {
  abandonedCartEnabled: "mkt_abandoned_cart_enabled",
  abandonedCartDelayHours: "mkt_abandoned_cart_delay_hours",
  abandonedCartPromoCode: "mkt_abandoned_cart_promo_code",
  abandonedCartMessage: "mkt_abandoned_cart_message",
  reengagementEnabled: "mkt_reengagement_enabled",
  reengagementDormantDays: "mkt_reengagement_dormant_days",
  reengagementIntervalDays: "mkt_reengagement_interval_days",
  reengagementMessage: "mkt_reengagement_message",
  referralEnabled: "mkt_referral_enabled",
  referralRefereeCreditCents: "mkt_referral_referee_credit_cents",
  referralReferrerCreditCents: "mkt_referral_referrer_credit_cents",
  referralCreditExpiresDays: "mkt_referral_credit_expires_days",
  referralMonthlyCapCents: "mkt_referral_monthly_cap_cents",
}

const BOOL_KEYS: (keyof MarketingSettings)[] = ["abandonedCartEnabled", "reengagementEnabled", "referralEnabled"]
const NUMBER_KEYS: (keyof MarketingSettings)[] = [
  "abandonedCartDelayHours", "reengagementDormantDays", "reengagementIntervalDays",
  "referralRefereeCreditCents", "referralReferrerCreditCents", "referralCreditExpiresDays", "referralMonthlyCapCents",
]

export async function getMarketingSettings(locationIdOverride?: string): Promise<MarketingSettings> {
  try {
    const supabase = createAdminClient()
    const locationId = locationIdOverride ?? (await getLocationId())
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .eq("location_id", locationId)
      .in("key", Object.values(KEYS))

    const map: Record<string, string> = {}
    for (const row of data ?? []) map[row.key] = row.value

    const result = { ...DEFAULTS }
    for (const [field, dbKey] of Object.entries(KEYS) as [keyof MarketingSettings, string][]) {
      if (map[dbKey] === undefined) continue
      if (BOOL_KEYS.includes(field)) result[field] = (map[dbKey] === "true") as never
      else if (NUMBER_KEYS.includes(field)) result[field] = parseInt(map[dbKey], 10) as never
      else result[field] = map[dbKey] as never
    }
    return result
  } catch {
    return DEFAULTS
  }
}

export async function setMarketingSettings(config: MarketingSettings): Promise<void> {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const rows = (Object.entries(KEYS) as [keyof MarketingSettings, string][]).map(([field, dbKey]) => ({
    key: dbKey,
    value: String(config[field]),
    location_id: locationId,
    updated_at: new Date().toISOString(),
  }))
  await supabase.from("settings").upsert(rows, { onConflict: "location_id,key" })
  revalidatePath("/admin/marketing")
}
