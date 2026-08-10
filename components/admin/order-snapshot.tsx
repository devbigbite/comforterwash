// Shared "at a glance" order summary — pickup/delivery timing, what's inside
// the order, who it's for, who's handling it, and what it costs. Built so an
// admin never has to hunt through the full order detail page (billing
// breakdown, photo uploaders, event log, etc.) just to answer "when's this
// picked up and what's in it." Used both as a standalone card on the order
// detail page and as the expandable panel on the Orders list row.

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "🛏️ Comforter Wash",
  wash_fold:      "👕 Wash & Fold",
  wash_only:      "🧺 Wash Only",
}

const STATUS_COLOR: Record<string, string> = {
  confirmed:          "bg-blue-100 text-blue-700",
  picked_up:          "bg-amber-100 text-amber-700",
  at_facility:        "bg-purple-100 text-purple-700",
  in_washer:          "bg-purple-100 text-purple-700",
  in_dryer:           "bg-purple-100 text-purple-700",
  folded:             "bg-purple-100 text-purple-700",
  at_warehouse:       "bg-indigo-100 text-indigo-700",
  ready:              "bg-teal-100 text-teal-700",
  ready_at_warehouse: "bg-indigo-100 text-indigo-700",
  out_for_delivery:   "bg-green-100 text-green-700",
  delivered:          "bg-green-100 text-green-700",
  cancelled:          "bg-red-100 text-red-700",
}

export interface OrderSnapshotData {
  short_code: string | null
  id: string
  status: string
  service_type: string
  customer_name: string
  customer_phone: string | null
  customer_address?: string | null
  delivery_address?: string | null
  pickup_date: string | null
  pickup_time_window: string | null
  delivery_date: string | null
  delivery_time_window: string | null
  num_bags: number | null
  num_comforters: number | null
  comforter_size?: string | null
  comforter_sizes?: string | null
  detergent?: string | null
  extras?: string | null
  customer_final_cents?: number | null
  total_amount?: number | null
  promo_code?: string | null
  promo_discount_cents?: number | null
  subscription_frequency?: string | null
  commercial_account_id?: string | null
  assigned_driver?: { name: string } | null
  assigned_delivery_driver?: { name: string } | null
  assigned_operator?: { name: string } | null
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-[#0D2240] mt-0.5">{value}</p>
    </div>
  )
}

export function OrderSnapshot({ order, compact }: { order: OrderSnapshotData; compact?: boolean }) {
  const orderCode = order.short_code?.toUpperCase() ?? order.id.slice(0, 8).toUpperCase()
  const bagCount = order.num_bags ?? order.num_comforters ?? 1
  const amountCents = order.customer_final_cents ?? order.total_amount ?? 0
  const address = order.delivery_address || order.customer_address

  const customerType = order.commercial_account_id
    ? "🏢 Commercial"
    : order.subscription_frequency === "weekly" || order.subscription_frequency === "biweekly"
    ? `🔁 ${order.subscription_frequency}`
    : "One-time"

  return (
    <div className={compact ? "p-4" : "bg-white rounded-2xl border border-gray-100 shadow-sm p-6"}>
      {!compact && (
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide">📋 Order Snapshot</h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-500"}`}>
            {order.status?.replace(/_/g, " ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Order Code" value={orderCode} />
        <Field label="Customer" value={
          <>
            {order.customer_name}
            <span className="block text-xs font-normal text-gray-400">{order.customer_phone}{" · "}{customerType}</span>
          </>
        } />
        <Field label="Service" value={SERVICE_LABEL[order.service_type] ?? order.service_type} />

        <Field label="Pickup" value={
          order.pickup_date
            ? <>{order.pickup_date}<span className="block text-xs font-normal text-gray-400">{order.pickup_time_window ?? "—"}</span></>
            : "—"
        } />
        <Field label="Delivery" value={
          order.delivery_date
            ? <>{order.delivery_date}<span className="block text-xs font-normal text-gray-400">{order.delivery_time_window ?? "—"}</span></>
            : "—"
        } />
        <Field label="Bags / Comforters" value={
          <>
            {bagCount} {order.num_comforters ? "comforter" : "bag"}{bagCount !== 1 ? "s" : ""}
            {(order.comforter_size || order.comforter_sizes) && (
              <span className="block text-xs font-normal text-gray-400 capitalize">{order.comforter_sizes || order.comforter_size}</span>
            )}
          </>
        } />

        {(order.detergent || order.extras) && (
          <Field label="Preferences" value={
            <span className="text-xs font-normal text-[#0D2240]">
              {[order.detergent, order.extras].filter(Boolean).join(" · ") || "—"}
            </span>
          } />
        )}

        {address && <Field label="Delivery Address" value={<span className="text-xs font-normal">{address}</span>} />}

        {(order.assigned_driver || order.assigned_delivery_driver || order.assigned_operator) && (
          <Field label="Assigned To" value={
            <span className="text-xs font-normal text-[#0D2240] space-y-0.5 block">
              {order.assigned_driver && <span className="block">🚗 Pickup: {order.assigned_driver.name}</span>}
              {order.assigned_delivery_driver && <span className="block">🚚 Delivery: {order.assigned_delivery_driver.name}</span>}
              {order.assigned_operator && <span className="block">🏭 Operator: {order.assigned_operator.name}</span>}
            </span>
          } />
        )}

        <Field label="Amount" value={
          <>
            ${(amountCents / 100).toFixed(2)}
            {order.promo_code && (
              <span className="block text-xs font-normal text-green-600">
                {order.promo_code} (−${((order.promo_discount_cents ?? 0) / 100).toFixed(2)})
              </span>
            )}
          </>
        } />
      </div>
    </div>
  )
}
