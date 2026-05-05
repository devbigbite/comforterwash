"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getBookingsByDate } from "@/app/actions/bookings"
import { MapPin, Phone, Package, Clock } from "lucide-react"

interface RouteCalendarProps {
  upcomingDates: string[]
}

interface Booking {
  id: string
  customer_name: string
  customer_phone: string
  customer_address: string
  pickup_date: string
  pickup_time_window: string
  delivery_date: string
  delivery_time_window: string
  num_comforters: number
  status: string
}

export function RouteCalendar({ upcomingDates }: RouteCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    upcomingDates.length > 0 ? new Date(upcomingDates[0]) : new Date(),
  )
  const [pickups, setPickups] = useState<Booking[]>([])
  const [deliveries, setDeliveries] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (selectedDate) {
      loadBookingsForDate(selectedDate)
    }
  }, [selectedDate])

  const loadBookingsForDate = async (date: Date) => {
    setIsLoading(true)
    try {
      const dateString = format(date, "yyyy-MM-dd")
      const data = await getBookingsByDate(dateString)
      setPickups(data.pickups)
      setDeliveries(data.deliveries)
    } catch (error) {
      console.error("[v0] Error loading bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const groupByTimeWindow = (bookings: Booking[], type: "pickup" | "delivery") => {
    const morning = bookings.filter((b) =>
      type === "pickup" ? b.pickup_time_window === "9am-1pm" : b.delivery_time_window === "9am-1pm",
    )
    const afternoon = bookings.filter((b) =>
      type === "pickup" ? b.pickup_time_window === "3pm-7pm" : b.delivery_time_window === "3pm-7pm",
    )
    return { morning, afternoon }
  }

  const pickupGroups = groupByTimeWindow(pickups, "pickup")
  const deliveryGroups = groupByTimeWindow(deliveries, "delivery")

  const openInMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank")
  }

  const BookingCard = ({ booking, type }: { booking: Booking; type: "pickup" | "delivery" }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{booking.customer_name}</span>
              <Badge variant="outline">{booking.num_comforters} items</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{booking.customer_phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span>{booking.customer_address}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => openInMaps(booking.customer_address)}>
            <MapPin className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Calendar */}
      <div className="flex flex-col items-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md border"
          modifiers={{
            hasBookings: upcomingDates.map((d) => new Date(d)),
          }}
          modifiersStyles={{
            hasBookings: {
              fontWeight: "bold",
              textDecoration: "underline",
            },
          }}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          {selectedDate ? format(selectedDate, "PPPP") : "Select a date"}
        </p>
      </div>

      {/* Routes for Selected Date */}
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-center text-muted-foreground">Loading routes...</p>
        ) : (
          <>
            {/* Pickups */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-primary">Pickups</h3>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <h4 className="font-medium">Morning (9:00 AM - 1:00 PM)</h4>
                    <Badge variant="secondary">{pickupGroups.morning.length}</Badge>
                  </div>
                  {pickupGroups.morning.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pickups scheduled</p>
                  ) : (
                    pickupGroups.morning.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} type="pickup" />
                    ))
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <h4 className="font-medium">Afternoon (3:00 PM - 7:00 PM)</h4>
                    <Badge variant="secondary">{pickupGroups.afternoon.length}</Badge>
                  </div>
                  {pickupGroups.afternoon.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pickups scheduled</p>
                  ) : (
                    pickupGroups.afternoon.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} type="pickup" />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Deliveries */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-primary">Deliveries</h3>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <h4 className="font-medium">Morning (9:00 AM - 1:00 PM)</h4>
                    <Badge variant="secondary">{deliveryGroups.morning.length}</Badge>
                  </div>
                  {deliveryGroups.morning.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deliveries scheduled</p>
                  ) : (
                    deliveryGroups.morning.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} type="delivery" />
                    ))
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <h4 className="font-medium">Afternoon (3:00 PM - 7:00 PM)</h4>
                    <Badge variant="secondary">{deliveryGroups.afternoon.length}</Badge>
                  </div>
                  {deliveryGroups.afternoon.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deliveries scheduled</p>
                  ) : (
                    deliveryGroups.afternoon.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} type="delivery" />
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
