import { getBookings } from "@/app/actions/bookings"
import { BookingsTable } from "@/components/admin/bookings-table"
import { TodayView } from "@/components/admin/today-view"
import { UpcomingView } from "@/components/admin/upcoming-view"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, TruckIcon, CheckCircle2, Clock, LogOut } from "lucide-react"
import { logoutAction } from "./login/actions"

export const dynamic = "force-dynamic"

export default async function AdminDashboard() {
  const bookings = await getBookings()

  const today = new Date().toISOString().split("T")[0]

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending" || b.status === "confirmed").length,
    inProgress: bookings.filter((b) => b.status === "picked_up" || b.status === "in_progress").length,
    completed: bookings.filter((b) => b.status === "delivered").length,
  }

  const todayPickups = bookings.filter((b) => b.pickup_date === today && b.status !== "cancelled")
  const todayDeliveries = bookings.filter((b) => b.delivery_date === today && b.status !== "cancelled")

  return (
    <div className="min-h-screen bg-[#f8faff]">
      {/* Header */}
      <header className="bg-[#0D2240] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="24" fill="#0D2240" />
            <circle cx="24" cy="24" r="22" fill="#142d52" />
            <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
              stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
          <span className="text-white font-extrabold text-lg tracking-tight">
            Wash<span className="text-[#E8726A]">Fold</span>
            <span className="ml-1.5 text-white/40 text-xs font-semibold uppercase tracking-widest">Admin</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/admin/search" className="text-white/60 hover:text-white text-sm transition-colors">Search</a>
          <a href="/admin/workers" className="text-white/60 hover:text-white text-sm transition-colors">Workers</a>
          <a href="/admin/subscriptions" className="text-white/60 hover:text-white text-sm transition-colors">Subscriptions</a>
          <a href="/admin/routes" className="text-white/60 hover:text-white text-sm transition-colors">Routes</a>
          <a href="/admin/promos" className="text-white/60 hover:text-white text-sm transition-colors">Promos</a>
          <a href="/admin/holidays" className="text-white/60 hover:text-white text-sm transition-colors">Holidays</a>
          <a href="/admin/reports" className="text-white/60 hover:text-white text-sm transition-colors">Reports</a>
          <a href="/admin/pricing" className="text-white/60 hover:text-white text-sm transition-colors">Pricing</a>
          <a href="/admin/settings" className="text-white/60 hover:text-white text-sm transition-colors">Promotions</a>
          <a href="/admin/facilities" className="text-white/60 hover: