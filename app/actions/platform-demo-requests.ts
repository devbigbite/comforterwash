"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

// Platform-wide (not tenant-scoped) — every "Request a Demo" submission from
// the /platform promo site lands here, regardless of which tenant's hostname
// happened to serve the page. Only the super admin (platform owner) can see
// this list.

// Standard SaaS sales pipeline. "demo_viewed" and "negotiating" are set
// manually by whoever's working the lead today — there's no page-view
// tracking wired up yet to set demo_viewed automatically.
export type DemoRequestStatus = "new" | "contacted" | "demo_viewed" | "negotiating" | "won" | "lost"

export const DEMO_REQUEST_STAGES: { value: DemoRequestStatus; label: string }[] = [
  { value: "new",         label: "New" },
  { value: "contacted",   label: "Contacted" },
  { value: "demo_viewed", label: "Demo Viewed" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won",         label: "Won" },
  { value: "lost",        label: "Lost" },
]

export interface PlatformDemoRequest {
  id: string
  name: string
  email: string
  phone: string | null
  business: string | null
  message: string | null
  status: DemoRequestStatus
  lost_reason: string | null
  follow_up_count: number
  last_follow_up_sent_at: string | null
  created_at: string
  updated_at: string
  demo_email_sent_at: string | null
  demo_location_id: string | null
  demo_slug: string | null
}

export async function getPlatformDemoRequests(): Promise<PlatformDemoRequest[]> {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("platform_demo_requests")
    .select("*, locations(slug)")
    .order("created_at", { ascending: false })
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    demo_slug: (row.locations as { slug?: string } | null)?.slug ?? null,
  })) as PlatformDemoRequest[]
}

// lostReason is only meaningful (and only stored) when status === "lost" —
// passing it for any other status is ignored so a stale reason from a
// previous "lost" classification never lingers on the record.
export async function setDemoRequestStatus(id: string, status: DemoRequestStatus, lostReason?: string) {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  await supabase
    .from("platform_demo_requests")
    .update({
      status,
      lost_reason: status === "lost" ? (lostReason?.trim() || null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  revalidatePath("/super-admin/demo-requests")
}
