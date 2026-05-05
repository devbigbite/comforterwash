import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import Link from "next/link"
import LogoutButton from "./logout-button"

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  picked_up: "Picked Up",
  at_facility: "At Facility",
  in_washer: "In Washer",
  in_dryer: "In Dryer",
  folded: "Folded",
  ready: "Ready for Delivery",
  delivered: "Delivered",
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  confirmed: "bg-blue-50 text-blue-700 border border-blue-200",
  picked_up: "bg-purple-50 text-purple-700 border border-purple-200",
  at_facility: "bg-purple-50 text-purple-700 border border-purple-200",
  in_washer: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  in_dryer: "bg-orange-50 text-orange-700 border border-orange-200",
  folded: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  ready: "bg-green-50 text-green-700 border border-green-200",
  delivered: "bg-[#0D2240] text-white",
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
        {activeOrder ? (
          <div className="bg-white rounded-2xl border-2 border-[#E8726A]/30 shadow-sm overflow-hidden">
            <div className="bg-[#E8726A]/5 px-5 py-3 border-b border-[#E8726A]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8726A] animate-pulse" />
                <span className="text-xs font-bold text-[#E8726A] uppercase tracking-wide">Active Order</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_COLOR[activeOrder.status] ?? "bg-gray-100 text-gray-500"}`}>
                {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-extrabold text-[#0D2240] font-mono text-lg">
                    {activeOrder.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activeOrder.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"} ·{" "}
                    {activeOrder.service_type === "wash_fold"
                      ? `~${activeOrder.pounds} lbs`
                      : `${activeOrder.num_comforters} comforter(s)`}
                  </p>
                </div>
                <p className="text-sm font-bold text-[#0D2240]">
                  ${(activeOrder.total_amount / 100).toFixed(2)}
                </p>
              </div>

              {/* Bag mini-status */}
              {activeOrder.order_bags && activeOrder.order_bags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(activeOrder.order_bags as Array<{ id: string; bag_number: number; label_code: string; status: string }>).map((bag) => (
                    <span key={bag.id} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${STATUS_COLOR[bag.status] ?? "bg-gray-100 text-gray-400"}`}>
                      B{bag.bag_number} · {STATUS_LABEL[bag.status] ?? bag.status}
                    </span>
                  ))}
                </div>
              )}

              <Link
                href={`/track/${activeOrder.id.slice(0, 8).toUpperCase()}`}
                className="block w-full text-center bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm py-3 rounded-xl transition-colors"
              >
                📍 Live Tracking →
              </Link>
            </div>
          </div>
        ) : (
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
                        {booking.id.slice(0, 8).toUpperCase()}
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
                  <Link
                    href={`/track/${booking.id.slice(0, 8).toUpperCase()}`}
                    className="shrink-0 text-xs text-gray-400 hover:text-[#0D2240] transition-colors font-semibold"
                  >
                    Track →
                  </Link>
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
