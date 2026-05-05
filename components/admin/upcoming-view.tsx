"use client"

import { format, parseISO } from "date-fns"
import { MapPin, Phone, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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
  total_amount: number
  status: string
}

interface UpcomingViewProps {
  bookings: Booking[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  picked_up: "bg-purple-100 text-purple-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  out_for_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}

function groupByDate(bookings: Booking[], dateKey: "pickup_date" | "delivery_date") {
  const groups: Record<string, Booking[]> = {}
  for (const b of bookings) {
    const date = b[dateKey]
    if (!groups[date]) groups[date] = []
    groups[date].push(b)
  }
  return groups
}

function BookingRow({ booking, type }: { booking: Booking; type: "pickup" | "delivery" }) {
  const timeWindow = type === "pickup" ? booking.pickup_time_window : booking.delivery_time_window
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-800 text-sm">{booking.customer_name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[booking.status]}`}>
            {booking.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{booking.customer_address}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0 text-xs text-gray-500">
        <div className="font-medium">{timeWindow}</div>
        <div className="flex items-center justify-end gap-1 mt-0.5 text-gray-400">
          <Package className="h-3 w-3" />
          <span>{booking.num_comforters} comforter{booking.num_comforters !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  )
}

export function UpcomingView({ bookings }: UpcomingViewProps) {
  const today = new Date().toISOString().split("T")[0]

  // Get upcoming pickups and deliveries (strictly after today)
  const upcomingPickups = bookings.filter(
    (b) => b.pickup_date > today && !["cancelled", "delivered"].includes(b.status)
  )
  const upcomingDeliveries = bookings.filter(
    (b) => b.delivery_date > today && !["cancelled", "delivered"].includes(b.status)
  )

  const pickupsByDate = groupByDate(upcomingPickups, "pickup_date")
  const deliveriesByDate = groupByDate(upcomingDeliveries, "delivery_date")

  // Merge all unique future dates
  const allDates = Array.from(
    new Set([...Object.keys(pickupsByDate), ...Object.keys(deliveriesByDate)])
  ).sort()

  if (allDates.length === 0) {
    return <p className="text-sm text-gray-400 italic">No upcoming orders</p>
  }

  return (
    <div className="space-y-8">
      {allDates.map((date) => {
        const pickups = pickupsByDate[date] || []
        const deliveries = deliveriesByDate[date] || []
        const label = format(parseISO(date), "EEEE, MMMM d")

        return (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-extrabold text-[#1e3a8a]">{label}</h3>
              <div className="flex gap-1.5">
                {pickups.length > 0 && (
                  <Badge variant="outline" className="text-xs">🚚 {pickups.length} pickup{pickups.length !== 1 ? "s" : ""}</Badge>
                )}
                {deliveries.length > 0 && (
                  <Badge variant="outline" className="text-xs">✨ {deliveries.length} delivery{deliveries.length !== 1 ? "s" : ""}</Badge>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {pickups.length > 0 && (
                <div className="px-4 pt-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pickups</p>
                  {pickups.map((b) => <BookingRow key={b.id} booking={b} type="pickup" />)}
                </div>
              )}
              {deliveries.length > 0 && (
                <div className="px-4 pt-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Deliveries</p>
                  {deliveries.map((b) => <BookingRow key={b.id} booking={b} type="delivery" />)}
                </div>
              )}
              <div className="pb-1" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
