import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import Link from "next/link"
import LogoutButton from "./logout-button"

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  confirmed: "bg-blue-50 text-blue-700 border border-blue-200",
  picked_up: "bg-purple-50 text-purple-700 border border-purple-200",
  at_warehouse: "bg-amber-50 text-amber-700 border border-amber-200",
  at_facility: "bg-purple-50 text-purple-700 border border-purple-200",
  in_washer: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  in_dryer: "bg-orange-50 text-orange-700 border border-orange-200",
  folded: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  ready: "bg-green-50 text-green-700 border border-green-200",
  ready_at_warehouse: "bg-teal-50 text-teal-700 border border-teal-200",
  out_for_delivery: "bg-green-600 text-white",
  delivered: "bg-[#0D2240] text-white",
}

// Pipeline steps for the inline tracker
const PIPELINE = [
  { keys: ["pending"],                                              label: "Confirmed",      icon: "✅" },
  { keys: ["picked_up"],                                           label: "Picked Up",      icon: "🚚" },
  { keys: ["at_warehouse"],                                        label: "At Warehouse",   icon: "🏪" },
  { keys: ["at_facility","in_washer","in_dryer","folded"],        label: "Being Cleaned",  icon: "🫧" },
  { keys: ["ready","ready_at_warehouse"],                          label: "Ready",          icon: "👕" },
  { keys: ["out_for_delivery"],                                    label: "Out for Delivery", icon: "🚐" },
  { keys: ["delivered"],                                           label: "Delivered",      icon: "🎉" },
]

function getPipelineIndex(status: string) {
  return PIPELINE.findIndex(s => s.keys.includes(status))
}

function formatPickupDate(d: string | null) {
  if (!d) return null
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) }
  catch { return d }
}

async function saveAddress(formData: FormData) {
  "use server"
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return

  const address = (formData.get("address") as string)?.trim()
  const supabase = createAdminClient()
  await supabase.from("profiles").upsert({
    id: user.id,
    saved_address: address,
    updated_at: new Date().toISOString(),
  })
  revalidatePath("/account")
}

export default async function AccountPage() {
  const supabaseClient = await createClient()
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()

  // Profile
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  // Bookings — match by user_id OR email (catches pre-auth history)
  const { data: bookings } = await admin
    .from("bookings")
    .select("*, order_bags(id, bag_number, label_code, status)")
    .or(`user_id.eq.${user.id},customer_email.eq.${user.email}`)
    .order("created_at", { ascending: false })

  const activeOrder = bookings?.find(
    (b) => b.status !== "delivered" && b.status !== "cancelled"
  )
  const lastOrder = bookings?.[0]
  const displayName = profile?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "there"

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <div className="bg-[#0D2240] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest">My Account</p>
            <p className="text-white font-extrabold text-lg">Hi, {displayName} 👋</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-white/30 text-xs hover:text-white/60 transition-colors">Home</a>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ── Active order ── */}
        {activeOrder ? (() => {
          const currentStep = getPipelineIndex(activeOrder.status)
          const bags = activeOrder.order_bags as Array<{ id: string; bag_number: number; status: string }> | null
          const serviceLabel = activeOrder.service_type === "comforter_wash" ? "Comforter Wash"
            : activeOrder.service_type === "wash_only" ? "Wash Only" : "Wash & Fold"
          const serviceIcon = activeOrder.service_type === "comforter_wash" ? "🛏️"
            : activeOrder.service_type === "wash_only" ? "🫧" : "🧺"

          return (
            <div className="bg-white rounded-2xl border-2 border-[#E8726A]/30 shadow-sm overflow-hidden">

              {/* Header */}
              <div className="bg-[#E8726A] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white font-extrabold text-sm uppercase tracking-wide">Active Order</span>
                </div>
                <span className="text-white/80 font-mono font-bold text-sm">
                  {activeOrder.short_code ?? activeOrder.id.slice(0, 6).toUpperCase()}
                </span>
              </div>

              <div className="p-5 space-y-5">

                {/* Service + dates */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{serviceIcon}</span>
                    <div>
                      <p className="font-extrabold text-[#0D2240] text-sm">{serviceLabel}</p>
                      <p className="text-xs text-gray-400">
                        {activeOrder.service_type === "wash_fold" || activeOrder.service_type === "wash_only"
                          ? `~${activeOrder.pounds ?? "?"} lbs`
                          : `${activeOrder.num_comforters ?? 1} comforter(s)`}
                      </p>
                    </div>
                  </div>
                  {(activeOrder.pickup_date || activeOrder.delivery_date) && (
                    <div className="text-right">
                      {activeOrder.pickup_date && (
                        <p className="text-[10px] text-gray-400">
                          Pickup <span className="font-bold text-[#0D2240]">{formatPickupDate(activeOrder.pickup_date)}</span>
                        </p>
                      )}
                      {activeOrder.delivery_date && (
                        <p className="text-[10px] text-gray-400">
                          Delivery <span className="font-bold text-[#0D2240]">{formatPickupDate(activeOrder.delivery_date)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress pipeline */}
                <div>
                  {/* Dot track */}
                  <div className="flex items-center gap-0">
                    {PIPELINE.map((step, i) => {
                      const done    = i < currentStep
                      const current = i === currentStep
                      const last    = i === PIPELINE.length - 1
                      return (
                        <div key={i} className="flex items-center" style={{ flex: last ? "0 0 auto" : 1 }}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 z-10
                            ${done    ? "bg-[#0D2240] text-white"
                            : current ? "bg-[#E8726A] text-white ring-4 ring-[#E8726A]/20"
                            : "bg-gray-100 text-gray-300"}`}>
                            {done ? "✓" : step.icon}
                          </div>
                          {!last && (
                            <div className={`h-0.5 flex-1 ${done ? "bg-[#0D2240]" : "bg-gray-100"}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Labels */}
                  <div className="flex mt-1.5">
                    {PIPELINE.map((step, i) => {
                      const done    = i < currentStep
                      const current = i === currentStep
                      const last    = i === PIPELINE.length - 1
                      return (
                        <div key={i} className={`text-center ${last ? "shrink-0" : "flex-1"}`}
                          style={{ minWidth: 0 }}>
                          <p className={`text-[9px] font-bold leading-tight truncate
                            ${current ? "text-[#E8726A]" : done ? "text-[#0D2240]" : "text-gray-300"}`}>
                            {step.label}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Bags */}
                {bags && bags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {bags.map(bag => {
                      const bagStep = getPipelineIndex(bag.status)
                      const done = bag.status === "delivered"
                      return (
                        <span key={bag.id}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border
                            ${done           ? "bg-green-50 text-green-700 border-green-200"
                            : bagStep === currentStep ? "bg-[#E8726A]/10 text-[#E8726A] border-[#E8726A]/20"
                            : "bg-gray-50 text-gray-400 border-gray-100"}`}>
                          Bag {bag.bag_number}{done ? " ✓" : ""}
                        </span>
                      )
                    })}
                  </div>
                )}

              </div>
            </div>
          )
        })() : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl shrink-0">✅</div>
            <div>
              <p className="font-bold text-[#0D2240] text-sm">No active orders</p>
              <p className="text-xs text-gray-400">All caught up — book a new pickup below.</p>
            </div>
          </div>
        )}

        {/* ── Re-book shortcut ── */}
        {lastOrder && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⚡ Quick Rebook</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[#0D2240] text-sm">
                  {lastOrder.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Last booked {format(new Date(lastOrder.created_at), "MMM d")} ·{" "}
                  {lastOrder.service_type === "wash_fold"
                    ? `~${lastOrder.pounds} lbs`
                    : `${lastOrder.num_comforters} comforter(s)`}
                </p>
              </div>
              <Link
                href={lastOrder.service_type === "wash_fold" ? "/book/wash-fold" : "/book/comforter-wash"}
                className="shrink-0 bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
              >
                Book Again →
              </Link>
            </div>
          </div>
        )}

        {/* ── Saved address ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">📍 Saved Address</p>
          <form action={saveAddress} className="flex gap-2">
            <input
              name="address"
              type="text"
              defaultValue={profile?.saved_address ?? ""}
              placeholder="123 Main St, Orlando FL 32801"
              className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:border-[#E8726A] transition-colors"
            />
            <button
              type="submit"
              className="shrink-0 bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
            >
              Save
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">Pre-filled on your next booking.</p>
        </div>

        {/* ── Order history ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
            📋 Order History ({bookings?.length ?? 0})
          </p>
          {!bookings || bookings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">No orders yet.</p>
              <Link href="/" className="text-sm text-[#E8726A] font-bold mt-1 inline-block">
                Book your first pickup →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <div key={booking.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f7f8fb] border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#0D2240] font-mono text-sm">
                        {booking.short_code ?? booking.id.slice(0, 6).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_COLOR[booking.status] ?? "bg-gray-100 text-gray-400"}`}>
                        {STATUS_LABEL[booking.status] ?? booking.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(booking.created_at), "MMM d, yyyy")} ·{" "}
                      {booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"} ·{" "}
                      ${(booking.total_amount / 100).toFixed(2)}
                    </p>
                  </div>
                  {booking.status !== "delivered" && booking.status !== "cancelled" && (
                    <Link
                      href={`/track/${booking.short_code ?? booking.id.slice(0, 6).toUpperCase()}`}
                      className="shrink-0 text-xs text-[#E8726A] hover:text-[#d45f57] transition-colors font-bold"
                    >
                      Track →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Book new */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          <Link href="/book/wash-fold"
            className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-sm text-center py-4 rounded-2xl transition-colors">
            🫧 Wash & Fold
          </Link>
          <Link href="/book/comforter-wash"
            className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm text-center py-4 rounded-2xl transition-colors">
            🛏️ Comforter Wash
          </Link>
        </div>
      </div>
    </div>
  )
}
