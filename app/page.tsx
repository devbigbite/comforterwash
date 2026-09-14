import { CorporateLanding } from "@/components/landing-corporate"
import { OperatorLanding } from "@/components/landing-operator"
import { getOperatorLandingProfile } from "@/app/actions/branding"
import { getSiteImages } from "@/app/actions/settings"
import { getPricingConfig, getWashFoldBagConfig, getWashOnlyBagConfig } from "@/app/actions/pricing"

// Server component: fetches the tenant's chosen homepage layout
// (locations.landing_page_template, set on /admin/branding) and, for the
// corporate template, the tenant's configured hero/site images and pricing
// (including per-bag config) -- all resolved before the first paint so the
// client component below never has to render generic defaults (or nothing
// at all) first and then swap in the real values a moment later. That swap
// was the "jump" of two different hero photos, and separately of the
// generic per-lb rate flashing before a tenant's real per-bag price,
// reported by users on load.
export default async function Home() {
  const profile = await getOperatorLandingProfile()

  if (profile.landing_page_template === "operator") {
    return <OperatorLanding />
  }

  const [images, pricing, washFoldBags, washOnlyBags] = await Promise.all([
    getSiteImages(),
    getPricingConfig(),
    getWashFoldBagConfig(),
    getWashOnlyBagConfig(),
  ])
  return (
    <CorporateLanding
      initialImages={images}
      initialPricing={pricing}
      initialWashFoldBags={washFoldBags}
      initialWashOnlyBags={washOnlyBags}
    />
  )
}
