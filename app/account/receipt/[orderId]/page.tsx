import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, getBranding } from "@/lib/location"
import { resolveMinLbs } from "@/lib/order-minimum"
import { ReceiptPrintButton } from "@/components/receipt-print-button"

const SERVICE_LABEL: Record<string, string> = {
  wash_fold:      "Wash & Fold",
  comforter_wash: "Comforter Wash",
  wash_only:      "Wash Only",
}

export default async function AccountReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const supabaseClient = await createClient()
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()
  const locationId = await getLocationId()
  const branding = await getBranding()

  // Same ownership check as the account order list — match by user_id OR
  // email, scoped to this tenant, so a customer can only ever pull up a
  // receipt for an order that's actually theirs.
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", orderId)
    .eq("location_id", locationId)
    .or(`user_id.eq.${user.id},customer_email.eq.${user.email}`)
    .maybeSingle()

  if (!booking) notFound()

  const isCharged = booking.payment_status === "captured" || booking.payment_status === "paid"
  const totalCents = booking.customer_final_cents ?? booking.total_amount ?? null

  // Weight-based services (Wash & Fold / Wash Only) bill at a minimum
  // weight, not raw scale weight — an order under that minimum is charged
  // as if it weighed the minimum (see lib/order-minimum.ts). The receipt has
  // to say so, or the weight × rate math on the page won't match the real
  // charge.
  const isWeightBased = booking.service_type === "wash_fold" || booking.service_type === "wash_only"
  const actualWeightLbs = booking.actual_weight_lbs ?? booking.pounds ?? null
  const minLbs = isWeightBased ? await resolveMinLbs(booking.service_type) : null
  const minimumWeightApplied =
    isWeightBased && minLbs != null && actualWeightLbs != null && actualWeightLbs < minLbs
  const billedWeightLbs =
    isWeightBased && actualWeightLbs != null && minLbs != null
      ? Math.max(actualWeightLbs, minLbs)
      : actualWeightLbs

  // The base service line is whatever's left of the real total after
  // backing out delivery fee / tip / promo discount (each shown as its own
  // line below) — never an independently recomputed weight × rate guess,
  // which can disagree with the real charge if the rate changed since.
  const otherLinesCents = (booking.delivery_fee_cents ?? 0) + (booking.tip_cents ?? 0) - (booking.promo_discount_cents ?? 0)
  const baseCents = totalCents != null ? totalCents - otherLinesCents : null
  const effectiveRateCents =
    isWeightBased && baseCents != null && billedWeightLbs != null && billedWeightLbs > 0
      ? Math.round(baseCents / billedWeightLbs)
      : booking.price_per_lb_cents ?? null

  const serviceLine =
    booking.service_type === "comforter_wash"
      ? (booking.comforter_sizes || (booking.comforter_size ? `1× ${booking.comforter_size}` : "Comforter Wash"))
      : `${SERVICE_LABEL[booking.service_type] ?? booking.service_type}${actualWeightLbs != null ? ` — ${actualWeightLbs} lbs` : ""}`

  return (
    <div className="min-h-screen bg-[#f7f8fb] py-10 px-4 print:bg-white print:py-0">
      <div className="mx-auto max-w-xl">
        <div className="print:hidden mb-4 flex items-center justify-between">
          <Link href="/account" className="text-xs text-gray-400 hover:text-[#0D2240]">
            ← Back to My Account
          </Link>
          <ReceiptPrintButton />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 print:shadow-none print:border-0 print:rounded-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-100 pb-5 mb-5">
            <div>
              <p className="font-extrabold text-[#0D2240] text-lg">{branding.business_name}</p>
              {branding.address && <p className="text-xs text-gray-400 mt-0.5">{branding.address}</p>}
              {branding.support_phone && <p className="text-xs text-gray-400">{branding.support_phone}</p>}
              {branding.support_email && <p className="text-xs text-gray-400">{branding.support_email}</p>}
            </div>
            <div className="text-right">
              <p className="font-extrabold text-[#0D2240] text-2xl uppercase tracking-wide">Receipt</p>
              <p className="text-xs text-gray-400 mt-1">
                #{booking.short_code ?? booking.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Billed to / dates */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Billed To</p>
              <p className="font-semibold text-[#0D2240]">{booking.customer_name}</p>
              {booking.customer_address && <p className="text-gray-500 text-xs">{booking.customer_address}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Service Date</p>
              {booking.pickup_date && <p className="text-[#0D2240]">Picked up {booking.pickup_date}</p>}
              {booking.delivery_date && <p className="text-[#0D2240]">Delivered {booking.delivery_date}</p>}
              <p className="text-gray-400 text-xs mt-1">{SERVICE_LABEL[booking.service_type] ?? booking.service_type}</p>
            </div>
          </div>

          {/* Line items */}
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f8fb]">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Item</th>
                  <th className="text-right px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="px-4 py-2 text-gray-600">
                    {serviceLine}
                    {minimumWeightApplied && (
                      <span className="text-gray-400 italic"> (Minimum Weight Rule applied)</span>
                    )}
                    {effectiveRateCents != null && booking.service_type !== "comforter_wash" && (
                      <span className="text-gray-400"> × ${(effectiveRateCents / 100).toFixed(2)}/lb</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {baseCents != null ? `$${(baseCents / 100).toFixed(2)}` : "—"}
                  </td>
                </tr>
                {minimumWeightApplied && (
                  <tr>
                    <td className="px-4 py-2 text-gray-500 text-xs italic" colSpan={2}>
                      Billed at the {minLbs} lb service minimum (actual weight was {actualWeightLbs} lbs)
                    </td>
                  </tr>
                )}
                {!!booking.delivery_fee_cents && (
                  <tr>
                    <td className="px-4 py-2 text-gray-600">Delivery fee</td>
                    <td className="px-4 py-2 text-right text-gray-600">${(booking.delivery_fee_cents / 100).toFixed(2)}</td>
                  </tr>
                )}
                {!!booking.tip_cents && (
                  <tr>
                    <td className="px-4 py-2 text-gray-600">Tip</td>
                    <td className="px-4 py-2 text-right text-gray-600">${(booking.tip_cents / 100).toFixed(2)}</td>
                  </tr>
                )}
                {!!booking.promo_discount_cents && (
                  <tr>
                    <td className="px-4 py-2 text-gray-600">
                      Promo discount{booking.promo_code ? ` (${booking.promo_code})` : ""}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">-${(booking.promo_discount_cents / 100).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100 bg-[#f7f8fb]">
                  <td className="px-4 py-3 font-extrabold text-[#0D2240]">Total Charged</td>
                  <td className="px-4 py-3 text-right font-extrabold text-[#0D2240]">
                    {totalCents != null ? `$${(totalCents / 100).toFixed(2)}` : "Pending"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment status — no card number/brand is stored on the
              booking itself (only Stripe holds that), so this shows status
              only, never a card number. */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Payment</p>
              <p className="text-[#0D2240]">Card on file</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Status</p>
              <p className={isCharged ? "text-green-700 font-semibold" : "text-gray-500 font-semibold"}>
                {isCharged ? "Charged" : booking.payment_status === "failed" ? "Charge Failed" : "Not yet charged"}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-gray-300 mt-8 text-center print:mt-4">
            {branding.business_name} · Order #{booking.short_code ?? booking.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}
