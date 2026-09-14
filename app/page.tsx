import { CorporateLanding } from "@/components/landing-corporate"
import { OperatorLanding } from "@/components/landing-operator"
import { getOperatorLandingProfile } from "@/app/actions/branding"
import { getSiteImages } from "@/app/actions/settings"

// Server component: fetches the tenant's chosen homepage layout
// (locations.landing_page_template, set on /admin/branding) and, for the
// corporate template, the tenant's configured hero/site images -- both
// resolved before the first paint so the client component below never
// has to render a generic default image (or nothing at all) first and
// then swap in the real one a moment later. That swap was the "jump" of
// two different hero photos users reported flashing on load.
export default async function Home() {
  const profile = await getOperatorLandingProfile()

  if (profile.landing_page_template === "operator") {
    return <OperatorLanding />
  }

  const images = await getSiteImages()
  return <CorporateLanding initialImages={images} />
}
