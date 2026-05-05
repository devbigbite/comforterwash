import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { format } from "date-fns"

const EVENT_ICONS: Record<string, string> = {
  booking_created: "📋",
  pickup_confirmed: "🚚",
  bags_received: "📦",
  processing_started: "⚙️",
  bag_in_washer: "🫧",
  bag_in_dryer: "🌀",
  bag_folded: "👕",
  ready_for_delivery: "✅",
  out_for_delivery: "🏃",
  delivered: "🎉",
}

const EVENT_LABELS: Record<string, string> = {
  booking_created: "Booking Confirmed",
  pickup_confirmed: "Picked Up",
  bags_received: "Arrived at Facility",
  processing_started: "Processing Started",
  bag_in_washer: "In the Washer",
  bag_in_dryer: "In the Dryer",
  bag_folded: "Folded & Ready",
  ready_for_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered!",
}

const BAG_STATUS_STEPS = [
  { status: "pending", label: "Order Placed" },
  { status: "picked_up", label: "Picked Up" },
  { status: "at_facility", label: "At Facility" },
  { status: "in_washer", label: "Washing" },
  { status: "in_dryer", label: "Drying" },
  { status: "folded", label: "Folded" },
  { status: "ready", label: "Ready" },
  { status: "delivered", label: "Delivered" },
]

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#0D2240" />
      <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
        stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default async function TrackOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .ilike("id", `${cleaned.slice(0, 8)}%`)
    .maybeSingle()

  if (!booking) notFound()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*")
    .eq("booking_id", booking.id)
    .order("bag_number")

  const { data: events } = await supabase
    .from("order_events")
    .select("*, order_bags(label_code, bag_number)")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true })

  const orderCode = booking.id.slice(0, 8).toUpperCase()

  // Determine current overall status
  const allDelivered = bags?.every(b => b.status === "delivered")
  const anyInDryer = bags?.some(b => b.status === "in_dryer")
  const anyInWasher = bags?.some(b => b.status === "in_washer")
  const allPickedUp = bags?.every(b => b.status !== "pending")
  const allReady = bags?.every(b => b.status === "ready" || b.status === "delivered")

  const currentStep = allDelivered ? 7 : allReady ? 6 : anyInDryer ? 4 : anyInWasher ? 3 : allPickedUp ? 1 : 0

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header className="bg-[#0D2240] px-4 py-4">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-white font-extrabold text-base">
              Wash<span className="text-[#E8726A]">Fold</span>
              <span className="text-white/30 text-xs ml-1 font-normal">Orlando</span>
            </span>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs">Order</p>
            <p className="text-white font-extrabold font-mono text-sm">{orderCode}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">

        {/* Status hero */}
        <div className={`rounded-3xl p-6 text-center ${allDelivered ? "bg-green-500" : "bg-[#0D2240]"}`}>
          <div className="text-5xl mb-3">
            {allDelivered ? "🎉" : allReady ? "✅" : anyInDryer ? "🌀" : anyInWasher ? "🫧" : allPickedUp ? "📦" : "📋"}
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">
            {allDelivered ? "Delivered!" : allReady ? "Ready for Delivery" : anyInDryer ? "In the Dryer" : anyInWasher ? "Being Washed" : allPickedUp ? "At the Facility" : "Order Confirmed"}
          </h1>
          <p className="text-white/60 text-sm">Hi {booking.customer_name.split(" ")[0]}! Here&apos;s your order status.</p>
        </div>

        {/* Progress track */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-[#0D2240] text-sm mb-4">Progress</h2>
          <div className="space-y-3">
            {BAG_STATUS_STEPS.map((step, i) => {
              const done = i <= currentStep
              const active = i === currentStep
              return (
                <div key={step.status} className={`flex items-center gap-3 ${done ? "" : "opacity-30"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 transition-all ${
                    done ? (active ? "bg-[#E8726A] text-white ring-4 ring-[#E8726A]/20" : "bg-[#0D2240] text-white") : "bg-gray-100 text-gray-400"
                  }`}>
                    {done && !active ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm font-medium ${active ? "text-[#E8726A] font-bold" : done ? "text-[#0D2240]" : "text-gray-300"}`}>
                    {step.label}
                  </span>
                  {active && <span className="ml-auto text-[#E8726A] text-xs font-bold">← Now</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bags */}
        {bags && bags.length > 1 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-[#0D2240] text-sm mb-4">Your {bags.length} Bags</h2>
            <div className="space-y-2">
              {bags.map((bag) => (
                <div key={bag.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-[#0D2240] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-xs font-mono">B{bag.bag_number}</span>
                  </div>
                  <span className="font-mono text-sm text-[#0D2240] font-medium flex-1">{bag.label_code}</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    {bag.status?.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order details */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-[#0D2240] text-sm mb-4">Order Details</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex gap-3">
              <dt className="text-gray-400 w-24 shrink-0">Service</dt>
              <dd className="font-medium text-[#0D2240]">{booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-gray-400 w-24 shrink-0">Pickup</dt>
              <dd className="font-medium text-[#0D2240]">{booking.pickup_date} · {booking.pickup_time_window}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-gray-400 w-24 shrink-0">Delivery</dt>
              <dd className="font-medium text-[#0D2240]">{booking.delivery_date} · {booking.delivery_time_window}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-gray-400 w-24 shrink-0">Total Paid</dt>
              <dd className="font-medium text-[#E8726A]">${(booking.total_amount / 100).toFixed(2)}</dd>
            </div>
          </dl>
        </div>

        {/* Event timeline */}
        {events && events.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-[#0D2240] text-sm mb-4">Activity Log</h2>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <span className="text-xl shrink-0">{EVENT_ICONS[event.event_type] ?? "📌"}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#0D2240]">
                      {EVENT_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ")}
                      {event.order_bags && (
                        <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                          {(event.order_bags as { label_code: string }).label_code}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{format(new Date(event.created_at), "MMM d, h:mm a")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 pb-4">
          Questions? Call us at (407) 555-0100
        </div>
      </div>
    </div>
  )
}
