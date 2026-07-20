import { createAdminClient } from "@/lib/supabase/admin"
import { getBranding } from "@/lib/location"
import { notFound } from "next/navigation"
import Link from "next/link"

// ── Status pipeline ──────────────────────────────────────────────────────────

const PIPELINE: {
  key: string[]
  label: string
  icon: string
  sub?: string
}[] = [
  { key: ["pending"],           label: "Booking Confirmed",  icon: "✅", sub: "We have your order!" },
  { key: ["picked_up"],         label: "Picked Up",          icon: "🚚", sub: "Your laundry is on the way to us" },
  { key: ["at_warehouse"],      label: "At Warehouse",       icon: "🏪", sub: "Checked in and ready for processing" },
  { key: ["at_facility","in_washer","in_dryer","folded"], label: "Being Cleaned", icon: "🫧", sub: "Washing, drying & folding in progress" },
  { key: ["ready","ready_at_warehouse"], label: "Ready",     icon: "👕", sub: "Your order is clean and folded" },
  { key: ["out_for_delivery"],  label: "Out for Delivery",   icon: "🚐", sub: "Your driver is on the way!" },
  { key: ["delivered"],         label: "Delivered",          icon: "🎉", sub: "Enjoy your fresh laundry!" },
]

const STATUS_FRIENDLY: Record<string, string> = {
  pending:            "Booking Confirmed",
  picked_up:          "Picked Up",
  at_warehouse:       "At Warehouse",
  at_facility:        "Being Cleaned",
  in_washer:          "Being Washed",
  in_dryer:           "In the Dryer",
  folded:             "Being Folded",
  ready:              "Ready",
  ready_at_warehouse: "Ready — At Warehouse",
  out_for_delivery:   "Out for Delivery",
  delivered:          "Delivered",
}

const EVENT_ICONS: Record<string, string> = {
  booking_created:         "📋",
  pickup_confirmed:        "🚚",
  bags_received:           "📦",
  dropped_at_warehouse:    "🏪",
  processing_started:      "⚙️",
  bag_in_washer:           "🫧",
  bag_in_dryer:            "🌀",
  bag_folded:              "👕",
  ready_for_delivery:      "✅",
  out_for_delivery:        "🚐",
  delivered:               "🎉",
  photo_customer_pickup:   "📷",
  photo_facility_dropoff:  "📷",
  photo_facility_pickup:   "📷",
  photo_customer_delivery: "📷",
  weight_confirmed:        "⚖️",
}

const EVENT_LABELS: Record<string, string> = {
  booking_created:         "Booking confirmed",
  pickup_confirmed:        "Picked up from you",
  bags_received:           "Bags received",
  dropped_at_warehouse:    "Arrived at warehouse",
  processing_started:      "Processing started",
  bag_in_washer:           "In the washer",
  bag_in_dryer:            "In the dryer",
  bag_folded:              "Folded",
  ready_for_delivery:      "Ready for delivery",
  out_for_delivery:        "Out for delivery",
  delivered:               "Delivered to you",
  photo_customer_pickup:   "Photo at pickup",
  photo_facility_dropoff:  "Photo at warehouse",
  photo_facility_pickup:   "Photo — clean bags ready",
  photo_customer_delivery: "Photo at delivery",
  weight_confirmed:        "Weight confirmed",
}

function getPipelineStep(status: string) {
  return PIPELINE.findIndex(step => step.key.includes(status))
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  } catch { return dateStr }
}

function formatTime(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    })
  } catch { return isoStr }
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = createAdminClient()
  const branding = await getBranding()

  // Look up booking by short_code
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("short_code", code.toUpperCase())
    .single()

  if (!booking) notFound()

  const { data: events } = await supabase
    .from("order_events")
    .select("id, event_type, notes, photo_url, created_at")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true })

  const { data: bags } = await supabase
    .from("order_bags")
    .select("id, bag_number, status")
    .eq("booking_id", booking.id)
    .order("bag_number")

  const status        = booking.status as string
  const currentStep   = getPipelineStep(status)
  const isDone        = status === "delivered"
  const serviceLabel  = booking.service_type === "comforter_wash" ? "Comforter Wash"
                      : booking.service_type === "wash_only"      ? "Wash Only"
                      : "Wash & Fold"
  const serviceIcon   = booking.service_type === "comforter_wash" ? "🛏️"
                      : booking.service_type === "wash_only"      ? "🫧"
                      : "🧺"

  // Customer-visible events — exclude internal admin/operator details
  const publicEventTypes = new Set([
    "booking_created","pickup_confirmed","dropped_at_warehouse",
    "processing_started","bag_in_washer","bag_in_dryer","bag_folded",
    "ready_for_delivery","out_for_delivery","delivered",
    "photo_customer_pickup","photo_facility_pickup","photo_customer_delivery",
  ])
  const publicEvents = (events ?? []).filter(e => publicEventTypes.has(e.event_type))

  return (
    <div className="min-h-screen bg-[#f7f8fb]">

      {/* Header */}
      <div className="bg-[var(--brand-primary)] px-4 pt-8 pb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-[var(--brand-accent)] font-extrabold text-xl mb-4">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="24" fill="white" fillOpacity="0.15" />
            <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
              stroke="var(--brand-accent)" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
          {branding.business_name}
        </Link>
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-3">
          <span className="text-lg">{serviceIcon}</span>
          <span className="text-white font-bold text-sm">{serviceLabel}</span>
        </div>
        <p className="text-white font-black text-2xl tracking-widest font-mono">{code.toUpperCase()}</p>
        <p className="text-white/50 text-sm mt-1">{booking.customer_name}</p>
        <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-bold
          ${isDone ? "bg-green-500 text-white" : "bg-[var(--brand-accent)] text-white"}`}>
          {STATUS_FRIENDLY[status] ?? status}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── Progress pipeline ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Order Progress</p>
          <div className="space-y-0">
            {PIPELINE.map((step, i) => {
              const isCompleted = i < currentStep
              const isCurrent   = i === currentStep
              const isFuture    = i > currentStep
              const isLast      = i === PIPELINE.length - 1

              return (
                <div key={i} className="flex gap-3">
                  {/* Line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 z-10
                      ${isCompleted ? "bg-[var(--brand-primary)] text-white"
                      : isCurrent   ? "bg-[var(--brand-accent)] text-white shadow-lg ring-4 ring-[var(--brand-accent)]/20"
                      : "bg-gray-100 text-gray-300"}`}>
                      {isCompleted ? "✓" : step.icon}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 my-1 ${isCompleted ? "bg-[var(--brand-primary)]" : "bg-gray-100"}`}
                        style={{ minHeight: "24px" }} />
                    )}
                  </div>

                  {/* Label */}
                  <div className={`pt-1.5 pb-5 ${isLast ? "pb-0" : ""}`}>
                    <p className={`font-bold text-sm leading-tight
                      ${isCompleted ? "text-[var(--brand-primary)]"
                      : isCurrent   ? "text-[var(--brand-accent)]"
                      : "text-gray-300"}`}>
                      {step.label}
                      {isCurrent && <span className="ml-2 text-[10px] font-black uppercase tracking-widest bg-[var(--brand-accent)] text-white px-2 py-0.5 rounded-full">Now</span>}
                    </p>
                    {(isCurrent || isCompleted) && step.sub && (
                      <p className={`text-xs mt-0.5 ${isCurrent ? "text-[var(--brand-accent)]/70" : "text-gray-400"}`}>
                        {step.sub}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Dates ── */}
        {(booking.pickup_date || booking.delivery_date) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className={`grid gap-3 ${booking.pickup_date && booking.delivery_date ? "grid-cols-2" : "grid-cols-1"}`}>
              {booking.pickup_date && (
                <div className={`rounded-xl p-3 text-center ${status === "pending" ? "bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/30" : "bg-gray-50"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Pickup</p>
                  <p className={`text-xs font-bold leading-snug ${status === "pending" ? "text-[var(--brand-accent)]" : "text-[var(--brand-primary)]"}`}>
                    {formatDate(booking.pickup_date)}
                  </p>
                  {booking.pickup_time_window && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{booking.pickup_time_window}</p>
                  )}
                </div>
              )}
              {booking.delivery_date && (
                <div className={`rounded-xl p-3 text-center ${["out_for_delivery","ready","ready_at_warehouse"].includes(status) ? "bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20" : "bg-gray-50"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Delivery</p>
                  <p className={`text-xs font-bold leading-snug ${["out_for_delivery","ready","ready_at_warehouse"].includes(status) ? "text-[var(--brand-primary)]" : "text-[var(--brand-primary)]"}`}>
                    {formatDate(booking.delivery_date)}
                  </p>
                  {booking.delivery_time_window && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{booking.delivery_time_window}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bag count ── */}
        {bags && bags.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Your Bags</p>
            <div className="grid grid-cols-3 gap-2">
              {bags.map(bag => {
                const bagStep = getPipelineStep(bag.status)
                const done    = bag.status === "delivered"
                return (
                  <div key={bag.id} className={`rounded-xl border-2 p-3 text-center
                    ${done ? "border-green-300 bg-green-50"
                    : bagStep === currentStep ? "border-[var(--brand-accent)] bg-orange-50"
                    : "border-gray-100 bg-gray-50"}`}>
                    <p className={`font-black text-lg font-mono
                      ${done ? "text-green-600" : bagStep === currentStep ? "text-[var(--brand-accent)]" : "text-gray-300"}`}>
                      B{bag.bag_number}
                    </p>
                    <p className={`text-[9px] font-bold uppercase tracking-wide mt-0.5
                      ${done ? "text-green-500" : bagStep === currentStep ? "text-[var(--brand-accent)]" : "text-gray-300"}`}>
                      {done ? "Done ✓" : STATUS_FRIENDLY[bag.status] ?? bag.status}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Event timeline ── */}
        {publicEvents.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
            <div className="space-y-3">
              {[...publicEvents].reverse().map(event => (
                <div key={event.id} className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-sm shrink-0">
                    {EVENT_ICONS[event.event_type] ?? "📌"}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-bold text-[var(--brand-primary)] leading-tight">
                      {EVENT_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatTime(event.created_at)}</p>
                    {event.photo_url && (
                      <a href={event.photo_url} target="_blank" rel="noreferrer"
                        className="inline-block mt-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={event.photo_url} alt="Driver photo"
                          className="w-full max-w-[200px] rounded-xl border border-gray-100 object-cover" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Contact footer ── */}
        <div className="bg-[var(--brand-primary)] rounded-2xl p-5 text-center">
          <p className="text-white font-extrabold mb-1">Questions about your order?</p>
          <p className="text-white/50 text-sm mb-4">Contact {branding.business_name} and mention your order code.</p>
          <p className="text-[var(--brand-accent)] font-black text-lg tracking-widest font-mono">{code.toUpperCase()}</p>
        </div>

      </div>
    </div>
  )
}
