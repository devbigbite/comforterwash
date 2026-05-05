import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  picked_up: "bg-blue-50 text-blue-700 border border-blue-200",
  at_facility: "bg-purple-50 text-purple-700 border border-purple-200",
  in_washer: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  in_dryer: "bg-orange-50 text-orange-700 border border-orange-200",
  folded: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  ready: "bg-green-50 text-green-700 border border-green-200",
  delivered: "bg-[#0D2240] text-white",
}

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
  photo_pickup: "📷",
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single()

  if (!booking) notFound()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*, machines(name, machine_groups(name, type, facilities(name)))")
    .eq("booking_id", id)
    .order("bag_number")

  const { data: events } = await supabase
    .from("order_events")
    .select("*, machines(name, machine_groups(name, type, facilities(name))), order_bags(label_code, bag_number)")
    .eq("booking_id", id)
    .order("created_at", { ascending: false })

  const orderCode = booking.id.slice(0, 8).toUpperCase()

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto max-w-4xl px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-extrabold text-[#0D2240] font-mono">{orderCode}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                STATUS_COLORS[booking.status] ?? "bg-gray-100 text-gray-500"
              }`}>
                {booking.status?.replace(/_/g, " ")}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f7f8fb] border border-gray-200 text-gray-500 uppercase">
                {booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"}
              </span>
            </div>
            <p className="text-sm text-gray-400">{booking.customer_name} · {booking.customer_phone}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/admin/orders/${id}/labels`}
              className="rounded-xl border-2 border-[#0D2240] text-[#0D2240] font-bold text-sm px-4 py-2 hover:bg-[#0D2240] hover:text-white transition-all">
              🏷️ Print Labels
            </Link>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">← Admin</Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Order info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-[#0D2240] mb-4 text-sm uppercase tracking-wide">Order Details</h2>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: "Customer", value: booking.customer_name },
                { label: "Email", value: booking.customer_email },
                { label: "Phone", value: booking.customer_phone },
                { label: "Address", value: booking.customer_address },
                { label: "Pickup", value: `${booking.pickup_date} · ${booking.pickup_time_window}` },
                { label: "Delivery", value: `${booking.delivery_date} · ${booking.delivery_time_window}` },
                { label: "Service", value: booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash" },
                { label: "Items", value: booking.service_type === "wash_fold" ? `~${booking.pounds} lbs` : `${booking.num_comforters} comforter(s)` },
                { label: "Bags", value: `${booking.num_bags ?? bags?.length ?? 1} bag(s)` },
                { label: "Total", value: `$${(booking.total_amount / 100).toFixed(2)}` },
                { label: "Paid", value: booking.payment_status },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <dt className="text-gray-400 w-20 shrink-0">{label}</dt>
                  <dd className="font-medium text-[#0D2240]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Bags */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-[#0D2240] mb-4 text-sm uppercase tracking-wide">
              Bags ({bags?.length ?? 0})
            </h2>
            <div className="space-y-3">
              {bags?.map((bag) => (
                <div key={bag.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f7f8fb] border border-gray-100">
                  <div className="w-10 h-10 rounded-xl bg-[#0D2240] flex items-center justify-center shrink-0">
                    <span className="text-white font-extrabold text-sm font-mono">B{bag.bag_number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0D2240] text-sm font-mono">{bag.label_code}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
                      {bag.status?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                    STATUS_COLORS[bag.status] ?? "bg-gray-100 text-gray-500"
                  }`}>
                    {bag.status?.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
              {(!bags || bags.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">No bags created yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Event timeline */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0D2240] mb-5 text-sm uppercase tracking-wide">Order Timeline</h2>
          {!events || events.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No events recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {events.map((event, i) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-[#f7f8fb] border-2 border-gray-100 flex items-center justify-center text-base shrink-0">
                      {EVENT_ICONS[event.event_type] ?? "📌"}
                    </div>
                    {i < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 mt-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-[#0D2240] text-sm capitalize">
                        {event.event_type.replace(/_/g, " ")}
                      </span>
                      {event.order_bags && (
                        <span className="text-xs bg-[#0D2240] text-white px-2 py-0.5 rounded-full font-mono">
                          {(event.order_bags as { label_code: string }).label_code}
                        </span>
                      )}
                      {event.machines && (
                        <span className="text-xs bg-[#E8726A]/10 text-[#E8726A] px-2 py-0.5 rounded-full font-bold">
                          {(event.machines as { name: string }).name}
                        </span>
                      )}
                    </div>
                    {event.photo_url && (
                      <a href={event.photo_url} target="_blank" rel="noreferrer" className="block mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={event.photo_url}
                          alt="Pickup photo"
                          className="rounded-xl border border-gray-100 max-h-48 max-w-xs object-cover hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
                    {event.notes && !event.photo_url && <p className="text-sm text-gray-500 mt-0.5">{event.notes}</p>}
                    <p className="text-xs text-gray-300 mt-1">
                      {format(new Date(event.created_at), "MMM d, h:mm a")}
                      {event.created_by && event.created_by !== "system" && ` · ${event.created_by}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
