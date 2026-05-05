import { getUpcomingDates } from "@/app/actions/bookings"
import { RouteCalendar } from "@/components/admin/route-calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RoutesPage() {
  const upcomingDates = await getUpcomingDates()

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center gap-4">
          <MapPin className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold text-primary">Route Management</h1>
            <p className="text-muted-foreground">Plan and organize pickup and delivery routes</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily Routes</CardTitle>
            <CardDescription>View pickups and deliveries organized by date and time window</CardDescription>
          </CardHeader>
          <CardContent>
            <RouteCalendar upcomingDates={upcomingDates} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
