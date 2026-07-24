"use server"

import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { getConnectStatusForLocation, createConnectOnboardingLink, refreshConnectStatusForLocation, type ConnectStatus } from "@/lib/stripe-connect"
import { revalidatePath } from "next/cache"

export type { ConnectStatus }

export async function getMyConnectStatus(): Promise<ConnectStatus> {
  const locationId = await getLocationId()
  return getConnectStatusForLocation(locationId)
}

export async function startMyConnectOnboarding(): Promise<{ url?: string; error?: string }> {
  await requireAdmin()
  const locationId = await getLocationId()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://comforterwash.com"
  const returnUrl = `${siteUrl}/admin/branding?stripe_connect=return`
  const refreshUrl = `${siteUrl}/admin/branding?stripe_connect=refresh`

  try {
    const { url } = await createConnectOnboardingLink(locationId, returnUrl, refreshUrl)
    return { url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to start Stripe onboarding" }
  }
}

export async function refreshMyConnectStatus(): Promise<ConnectStatus> {
  await requireAdmin()
  const locationId = await getLocationId()
  const status = await refreshConnectStatusForLocation(locationId)
  revalidatePath("/admin/branding")
  return status
}
