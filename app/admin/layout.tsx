import type React from "react"
import { AdminHeader } from "@/components/admin/admin-header"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f0f4fa]">
      <AdminHeader />
      {children}
    </div>
  )
}
