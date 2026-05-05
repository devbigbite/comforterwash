"use client"

import { format } from "date-fns"
import { MapPin, Phone, Package, Clock } from "lucide-react"
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

interface TodayViewProps {
  pickups: Booking[]
  deliveries: Booking[]
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

function StopCard({ booking, type }: { booking: Booking; type: "pickup" | "delivery" }) {
  const timeWindow = type === "pickup" ? booking.pickup_time_window : booking.delivery_time_window
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-[#1e3a8a] truncate">{booking.customer_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[booking.status]}`}>
              {booking.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{booking.customer_address}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
            <a href={`tel:${booking.customer_phone}`} className="hover:text-[#1e3a8a]">
              {booking.customer_phone}
            </a>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Package className="h-3.5 w-3.5" />
            <span>{booking.num_comforters}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">${(booking.total_amount / 100).toFixed(0)}</div>
        </div>
      </div>
    </div>
  )
}

function TimeBlock({
  window,
  stops,
  type,
}: {
  window: string
  stops: Booking[]
  type: "pickup" | "delivery"
}) {
  if (stops.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-bold text-gray-600 uppercase tracking-wide">{window}</span>
        <span className="text-xs text-gray-400">({stops.length} stop{stops.length !== 1 ? "s" : ""})</span>
      </div>
      <div className="space-y-2">
        {stops.map((b) => <StopCard key={b.id} booking={b} type={type} />)}
      </div>
    </div>
  )
}

export function TodayView({ pickups, deliveries }: TodayViewProps) {
  const pickupsMorning = pickups.filter((b) => b.pickup_time_window === "9am-1pm")
  const pickupsAfternoon = pickups.filter((b) => b.pickup_time_window === "3pm-7pm")
  const deliveriesMorning = deliveries.filter((b) => b.delivery_time_window === "9am-1pm")
  const deliveriesAfternoon = deliveries.filter((b) => b.delivery_time_window === "3pm-7pm")

  const today = format(new Date(), "EEEE, MMMM d")

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-400 font-medium">{today}</p>

      {/* Pickups */}
      <div>
        <h3 className="text-lg font-extrabold text-[#1e3a8a] mb-4 flex items-center gap-2">
          🚚 Pickups
          <Badge variant="outline">{pickups.length}</Badge>
        </h3>
        {pickups.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No pickups today</p>
        ) : (
          <div className="space-y-5">
            <TimeBlock window="9am – 1pm" stops={pickupsMorning} type="pickup" />
            <TimeBlock window="3pm – 7pm" stops={pickupsAfternoon} type="pickup" />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* Deliveries */}
      <div>
        <h3 className="text-lg font-extrabold text-[#1e3a8a] mb-4 flex items-center gap-2">
          ✨ Deliveries
          <Badge variant="outline">{deliveries.length}</Badge>
        </h3>
        {deliveries.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No deliveries today</p>
        ) : (
          <div className="space-y-5">
            <TimeBlock window="9am – 1pm" stops={deliveriesMorning} type="delivery" />
            <TimeBlock window="3pm – 7pm" stops={deliveriesAfternoon} type="delivery" />
          </div>
        )}
      </div>
    </div>
  )
}
