import type React from "react"
import { AdminHeader } from "@/components/admin/admin-header"

export default function FacilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D2240]">
      <AdminHeader />
      {children}
    </div>
  )
}
