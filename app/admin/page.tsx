import { getBookings } from "@/app/actions/bookings"
import { BookingsTable } from "@/components/admin/bookings-table"
import { TodayView } from "@/components/admin/today-view"
import { UpcomingView } from "@/components/admin/upcoming-view"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, TruckIcon, CheckCircle2, Clock } from "lucide-react"

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
    <>
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
    </>
  )
}
