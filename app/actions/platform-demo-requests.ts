"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

// Platform-wide (not tenant-scoped) — every "Request a Demo" submission from
// the /platform promo site lands here, regardless of which tenant's hostname
// happened to serve the page. Only the super admin (platform owner) can see
// this list.

export interface PlatformDemoRequest {
  id: string
  name: string
  email: string
  phone: string | null
  business: string | null
  message: string | null
  status: "new" | "contacted" | "closed"
  created_at: string
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

export async function setDemoRequestStatus(id: string, status: "new" | "contacted" | "closed") {
  await requireSuperAdmin()
  const supabase = createAdminClient()
  await supabase
    .from("platform_demo_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
  revalidatePath("/super-admin/demo-requests")
}
