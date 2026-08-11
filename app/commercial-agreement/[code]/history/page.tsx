import Link from "next/link"
import { notFound } from "next/navigation"
import { getCommercialAccountOrderHistory } from "@/app/actions/commercial-accounts"

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  captured:       "bg-green-50 text-green-700 border-green-200",
  paid:           "bg-green-50 text-green-700 border-green-200",
  failed:         "bg-red-50 text-red-600 border-red-200",
  pending_weight: "bg-gray-100 text-gray-500 border-gray-200",
  pending:        "bg-yellow-50 text-yellow-700 border-yellow-200",
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  captured:       "Charged",
  paid:           "Charged",
  failed:         "Charge Failed",
  pending_weight: "Awaiting Weigh-In",
  pending:        "Pending",
}

export default async function CommercialAccountHistoryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const result = await getCommercialAccountOrderHistory(code)
  if (!result) notFound()
  const { account, orders } = result

  const totalChargedCents = orders
    .filter(o => o.payment_status === "captured" || o.payment_status === "paid")
    .reduce((sum, o) => sum + (o.customer_final_cents ?? 0), 0)

  // Surfaces the account's own rate so this page fully answers "how is my
  // weekly bill calculated" on its own — a commercial customer asked for
  // exactly this (a weight + pricing breakdown) after a payment retry, and
  // per-order weight/amount alone doesn't show the rate that connects them.
  const rateLabel =
    account.rate_type === "per_lb" ? `$${((account.rate_amount_cents ?? 0) / 100).toFixed(2)} per lb` :
    account.rate_type === "per_load" ? `$${((account.rate_amount_cents ?? 0) / 100).toFixed(2)} per load` :
    account.rate_amount_cents != null ? `$${(account.rate_amount_cents / 100).toFixed(2)} flat rate` : null

  // For per-lb accounts, the minimum is really a minimum weight — showing it
  // as a dollar figure obscures the thing that actually varies (how many lbs
  // an order needs to hit before the per-lb math kicks in). Convert using the
  // account's own rate so it stays correct if the rate ever changes.
  const minimumLbs =
    account.rate_type === "per_lb" && account.minimum_amount_cents != null && account.rate_amount_cents
      ? account.minimum_amount_cents / account.rate_amount_cents
      : null

  return (
    <div className="min-h-screen bg-[#f7f8fb] py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-6">
            <Link href={`/commercial-agreement/${code}`} className="text-xs text-gray-400 hover:text-[#0D2240]">
              ← Back to Agreement
            </Link>
            <h1 className="text-2xl font-extrabold text-[#0D2240] mt-2">Order &amp; Billing History</h1>
            <p className="text-sm text-gray-400 mt-1">{account.business_name} · WashFold Orlando</p>
            {rateLabel && (
              <p className="text-sm text-[#0D2240] font-semibold mt-2 bg-[#f7f8fb] border border-gray-100 rounded-xl px-3 py-2 inline-block">
                Your rate: {rateLabel}
                {minimumLbs != null && ` · ${minimumLbs % 1 === 0 ? minimumLbs : minimumLbs.toFixed(1)} lbs minimum per order`}
                {minimumLbs == null && account.minimum_amount_cents != null && ` · $${(account.minimum_amount_cents / 100).toFixed(2)} minimum per order`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total Orders</p>
              <p className="text-xl font-extrabold text-[#0D2240] mt-0.5">{orders.length}</p>
            </div>
            <div className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total Charged</p>
              <p className="text-xl font-extrabold text-[#0D2240] mt-0.5">${(totalChargedCents / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-4 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Payment Method</p>
              <p className="text-sm font-bold text-[#0D2240] mt-0.5">
                {account.stripe_payment_method_id
                  ? `${account.card_brand ? account.card_brand.toUpperCase() + " " : ""}${account.card_last4 ? "••" + account.card_last4 : "On file"}`
                  : "None on file"}
              </p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-8 text-center text-sm text-gray-400">
              No orders yet. Once your first order is picked up and weighed, it will show up here along with the amount charged.
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map(o => {
                // Only show a bag breakdown when at least one bag actually has
                // a weight recorded — orders weighed before per-bag capture
                // existed have order_bags rows but no weight_lbs on them.
                const bagBreakdown = (o.order_bags ?? [])
                  .filter(b => b.weight_lbs != null)
                  .sort((a, b) => a.bag_number - b.bag_number)
                return (
                <div key={o.id} className="rounded-xl border border-gray-100 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-[#0D2240] w-20 shrink-0">{o.short_code ?? o.id.slice(0, 6).toUpperCase()}</span>
                    <span className="text-gray-500">{o.pickup_date}</span>
                    <span className="text-gray-400">
                      {o.actual_weight_lbs ? `${o.actual_weight_lbs} lbs` : "—"}
                      {/* Shows the math (weight × rate) so the charged amount is
                          never a mystery number — this is the exact ask that
                          prompted adding it: "a breakdown of the weight and
                          pricing details" for understanding future charges. */}
                      {o.actual_weight_lbs && account.rate_type === "per_lb" && account.rate_amount_cents && (
                        <span className="text-[10px] text-gray-400 ml-1">
                          (× ${(account.rate_amount_cents / 100).toFixed(2)}/lb)
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-[#0D2240] ml-auto">
                      {o.customer_final_cents != null ? `$${(o.customer_final_cents / 100).toFixed(2)}` : "—"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${PAYMENT_STATUS_STYLE[o.payment_status ?? "pending"] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {PAYMENT_STATUS_LABEL[o.payment_status ?? "pending"] ?? o.payment_status}
                    </span>
                  </div>
                  {bagBreakdown.length > 0 && (
                    <div className="mt-2 pl-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {bagBreakdown.map(b => (
                        <span key={b.bag_number} className="text-[11px] text-gray-400">
                          Bag {b.bag_number}: <span className="text-gray-600 font-semibold">{b.weight_lbs} lbs</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
