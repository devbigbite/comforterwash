import { cookies } from "next/headers"
import { getBranding } from "@/lib/location"
import { exitTenantAdmin } from "@/app/actions/super-admin"

// Shown only when a super admin has entered a tenant's admin via
// /super-admin's "Enter Admin" link (see enterTenantAdmin) — makes it obvious
// this isn't the platform owner's own admin session, and gives a one-click
// way back out. Not shown for a tenant's own real login, even though that
// path also relies on the same admin_location_id cookie under the hood.
export async function ImpersonationBanner() {
  const cookieStore = await cookies()
  if (cookieStore.get("super_admin_impersonating")?.value !== "1") return null

  const branding = await getBranding()

  return (
    <div className="bg-amber-400 text-amber-950 text-sm font-semibold px-4 py-2 flex items-center justify-center gap-3">
      <span>👀 Viewing {branding.business_name || "this tenant"}'s admin as Super Admin</span>
      <form action={exitTenantAdmin}>
        <button type="submit" className="underline hover:no-underline">Exit</button>
      </form>
    </div>
  )
}
