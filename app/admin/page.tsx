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
          <a href="/admin/promos" className="text-white/60 hover:text-white text-sm transition-colors">Promotions</a>
          <a href="/admin/holidays" className="text-white/60 hover:text-white text-sm transition-colors">Holidays</a>
          <a href="/admin/reports" className="text-white/60 hover:text-white text-sm transition-colors">Reports</a>
          <a href="/admin/pricing" className="text-white/60 hover:text-white text-sm transition-colors">Pricing</a>
          <a href="/admin/facilities" className="text-white/60 hover:text-white text-sm transition-colors">Facilities</a>
          <a href="/admin/zip-codes" className="text-white/60 hover:text-white text-sm transition-colors">Areas</a>
          <a href="/operator" className="text-white/60 hover:text-white text-sm transition-colors">Operator →</a>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <TruckIcon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="today">
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="today" className="gap-2">
              Today
              {(todayPickups.length + todayDeliveries.length) > 0 && (
                <span className="bg-[#1e3a8a] text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-bold">
                  {todayPickups.length + todayDeliveries.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="all">All Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Schedule</CardTitle>
                <CardDescription>Pickups and deliveries for today</CardDescription>
              </CardHeader>
              <CardContent>
                <TodayView pickups={todayPickups} deliveries={todayDeliveries} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Orders</CardTitle>
                <CardDescription>Future pickups and deliveries</CardDescription>
              </CardHeader>
              <CardContent>
                <UpcomingView bookings={bookings} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Bookings</CardTitle>
                <CardDescription>Full order history — click a row to update status</CardDescription>
              </CardHeader>
              <CardContent>
                <BookingsTable bookings={bookings} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
