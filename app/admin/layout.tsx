import type React from "react"
import { AdminHeader } from "@/components/admin/admin-header"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f0f4fa]">
      <ImpersonationBanner />
      <AdminHeader />
      {children}
    </div>
  )
}
