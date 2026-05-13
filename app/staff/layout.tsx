import type React from "react"
import { AdminHeader } from "@/components/admin/admin-header"

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8faff]">
      <AdminHeader />
      {children}
    </div>
  )
}
