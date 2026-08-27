"use client"

import { useState, useEffect } from "react"
import { CorporateLanding } from "@/components/landing-corporate"
import { OperatorLanding } from "@/components/landing-operator"
import { getOperatorLandingProfile, type LandingPageTemplate } from "@/app/actions/branding"

// Thin dispatcher: fetches the tenant's chosen homepage layout
// (locations.landing_page_template, set on /admin/branding) and renders
// the matching template. null-until-loaded avoids flashing the wrong
// template on first paint — same pattern used inside each template for
// its own settings-backed content.
export default function Home() {
  const [template, setTemplate] = useState<LandingPageTemplate | null>(null)

  useEffect(() => {
    getOperatorLandingProfile().then(p => setTemplate(p.landing_page_template))
  }, [])

  if (template === null) return null
  if (template === "operator") return <OperatorLanding />
  return <CorporateLanding />
}
