import type React from "react"
import { headers } from "next/headers"
import { AdminHeader } from "@/components/admin/admin-header"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // /admin/login must never wear the full admin-dashboard chrome — the nav
  // bar (and impersonation banner) pushed the actual sign-in card, and the
  // legacy-password "wfo" link in its footer, below the fold on ordinary
  // screens. x-pathname is set by middleware.ts alongside x-location-id.
  const h = await headers()
  const isLoginPage = h.get("x-pathname") === "/admin/login"

  if (isLoginPage) {
    return <div className="min-h-screen bg-[#f0f4fa]">{children}</div>
  }

  return (
    <div className="min-h-screen bg-[#f0f4fa]">
      <ImpersonationBanner />
      <AdminHeader />
      {children}
    </div>
  )
}
