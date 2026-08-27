import Link from "next/link"
import { notFound } from "next/navigation"
import { getCommercialAccountOrderHistory } from "@/app/actions/commercial-accounts"
import { getBranding } from "@/lib/location"
import { resolveMinLbs } from "@/lib/order-minimum"
import { ReceiptPrintButton } from "@/components/receipt-print-button"

export async function generateMetadata({ params }: { params: Promise<{ code: string; orderId: string }> }) {
  const { code } = await params
  const result = await getCommercialAccountOrderHistory(code)
  const branding = await getBranding()
  return { title: `Receipt — ${result?.account.business_name ?? "Order"} · ${branding.business_name}` }
}

const SERVICE_LABEL: Record<string, string> = {
  wash_fold:      "Wash & Fold",
  comforter_wash: "Comforter Wash",
  wash_only:      "Wash Only",
}

export default async function CommercialReceiptPage({
  params,
}: {
  params: Promise<{ code: string; orderId: string }>
}) {
  const { code, orderId } = await params
  const [result, branding] = await Promise.all([getCommercialAccountOrderHistory(code), getBranding()])
  if (!result) notFound()
  const { account, orders } = result
  const order = orders.find(o => o.id === orderId)
  if (!order) notFound()

  // Only a delivered, charged order has a real total to receipt — anything
  // still in progress doesn't have a final number yet.
  const isCharged = order.payment_status === "captured" || order.payment_status === "paid"
  const totalCents = order.customer_final_cents

  // Weight-based services (Wash & Fold / Wash Only) bill at a minimum
  // weight, not raw scale weight — an order under that minimum is charged
  // as if it weighed the minimum (see lib/order-minimum.ts / order 714600,
  // an 11.1 lb order billed at the 18 lb minimum). The line item has to show
  // that, not the raw weight × rate, or the receipt disagrees with the
  // actual charge.
  const isWeightBased = order.service_type === "wash_fold" || order.service_type === "wash_only"
  const minLbs = isWeightBased ? await resolveMinLbs(order.service_type) : null
  const minimumWeightApplied =
    isWeightBased && minLbs != null && order.actual_weight_lbs != null && order.actual_weight_lbs < minLbs
  const billedWeightLbs =
    isWeightBased && order.actual_weight_lbs != null && minLbs != null
      ? Math.max(order.actual_weight_lbs, minLbs)
      : order.actual_weight_lbs

  // The amount shown is always the real charge (customer_final_cents) —
  // never an independently recomputed weight × current-rate guess, which
  // can silently disagree with what was actually billed if the account's
  // rate changed since. The "effective" rate below is only for display,
  // backed out of the real total so it reflects the rate actually applied
  // at the time, not today's rate.
  const effectiveRateCents =
    totalCents != null && billedWeightLbs != null && billedWeightLbs > 0
      ? Math.round(totalCents / billedWeightLbs)
      : (account.rate_type === "per_lb" ? account.rate_amount_cents : null)

  const bagBreakdown = (order.order_bags ?? [])
    .filter(b => b.weight_lbs != null)
    .sort((a, b) => a.bag_number - b.bag_number)

  return (
    <div className="min-h-screen bg-[#f7f8fb] py-10 px-4 print:bg-white print:py-0">
      <div className="mx-auto max-w-xl">
        <div className="print:hidden mb-4 flex items-center justify-between">
          <Link
            href={`/commercial-agreement/${code}/history`}
            className="text-xs text-gray-400 hover:text-[#0D2240]"
          >
            ← Back to Order History
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
                #{order.short_code ?? order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Billed to / dates */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Billed To</p>
              <p className="font-semibold text-[#0D2240]">{account.business_name}</p>
              {account.contact_name && <p className="text-gray-500 text-xs">{account.contact_name}</p>}
              {account.address && <p className="text-gray-500 text-xs">{account.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Service Date</p>
              <p className="text-[#0D2240]">Picked up {order.pickup_date}</p>
              {order.delivery_date && <p className="text-[#0D2240]">Delivered {order.delivery_date}</p>}
              <p className="text-gray-400 text-xs mt-1">{SERVICE_LABEL[order.service_type] ?? order.service_type}</p>
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
                    {SERVICE_LABEL[order.service_type] ?? order.service_type}
                    {order.actual_weight_lbs != null && ` — ${order.actual_weight_lbs} lbs`}
                    {minimumWeightApplied && (
                      <span className="text-gray-400 italic"> (Minimum Weight Rule applied)</span>
                    )}
                    {effectiveRateCents != null && (
                      <span className="text-gray-400"> × ${(effectiveRateCents / 100).toFixed(2)}/lb</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {totalCents != null ? `$${(totalCents / 100).toFixed(2)}` : "—"}
                  </td>
                </tr>
                {minimumWeightApplied && (
                  <tr>
                    <td className="px-4 py-2 text-gray-500 text-xs italic" colSpan={2}>
                      Billed at the {minLbs} lb service minimum (actual weight was {order.actual_weight_lbs} lbs)
                    </td>
                  </tr>
                )}
                {bagBreakdown.length > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-gray-400 text-xs" colSpan={2}>
                      {bagBreakdown.map(b => `Bag ${b.bag_number}: ${b.weight_lbs} lbs`).join("  ·  ")}
                    </td>
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

          {/* Payment */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Payment Method</p>
              <p className="text-[#0D2240]">
                {account.card_brand ? `${account.card_brand.toUpperCase()} ••${account.card_last4}` : "On file"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Status</p>
              <p className={isCharged ? "text-green-700 font-semibold" : "text-gray-500 font-semibold"}>
                {isCharged ? "Charged" : order.payment_status === "failed" ? "Charge Failed" : "Not yet charged"}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-gray-300 mt-8 text-center print:mt-4">
            {branding.business_name} · Order #{order.short_code ?? order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}
