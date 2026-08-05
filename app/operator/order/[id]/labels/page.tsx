import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { PinGate } from "@/components/pin-gate"
import { OperatorOrderGate } from "@/components/operator-order-gate"
import { PrintReceiptsButton } from "@/components/print-receipts-button"
import type { ReceiptData } from "@/lib/escpos"

// Color keys are physical stickers applied by hand — the thermal printer is
// monochrome, so the receipt only ever names the color as text
// ("COLOR KEY: BLUE"), never renders it visually.
const COLOR_LABEL: Record<string, string> = {
  red: "Red", blue: "Blue", sky: "Sky Blue", green: "Green",
  lime: "Lime", pink: "Pink", hotpink: "Hot Pink",
  orange: "Orange", purple: "Purple", yellow: "Yellow",
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data: booking } = await supabase.from("bookings").select("short_code").eq("id", id).single()
  const orderCode = (booking?.short_code ?? id.slice(0, 8)).toUpperCase()
  return { title: `Bag Receipts — ${orderCode}` }
}

/**
 * Operator bag receipts — printed one per output bag. Prints directly to
 * the paired Bluetooth thermal printer via Web Bluetooth + raw ESC/POS
 * (see components/print-receipts-button.tsx and lib/escpos.ts) — no OS
 * print dialog, no printer selection each time. Falls back to the normal
 * browser print dialog if Web Bluetooth isn't available. Continuous roll,
 * so each receipt is cut to its actual content length rather than a fixed
 * label size.
 *
 * Carries the delivery address (for the driver) and order/routing info,
 * but never price.
 */
export default async function OperatorLabelsPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ autoprint?: string }>
}) {
  const { id } = await params
  const { autoprint } = await searchParams
  const supabase = createAdminClient()

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).single()
  if (!booking) notFound()

  // Which numbered order this is for this customer — drives the welcome-gift /
  // repeat-customer coupon notice printed on the receipt below. Counts every
  // non-cancelled booking for this customer_email at this location, in
  // chronological order, so reprinting a receipt later still shows the same
  // order number rather than drifting as new orders come in.
  let orderNumber = 1
  if (booking.customer_email) {
    const { data: customerOrders } = await supabase
      .from("bookings")
      .select("id, created_at")
      .eq("location_id", booking.location_id)
      .eq("customer_email", booking.customer_email)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true })
    if (customerOrders) {
      const idx = customerOrders.findIndex(o => o.id === booking.id)
      orderNumber = idx >= 0 ? idx + 1 : customerOrders.length + 1
    }
  }
  // Customer sees this receipt too, so the main line speaks directly to them
  // (a warm thank-you), while the small tag above it is the operator's cue
  // for what to slip into the bag.
  const loyaltyNotice =
    orderNumber === 1 ? { tag: "WELCOME GIFT INSIDE", text: "🎉 Welcome to the family — thank you for choosing us!" }
    : orderNumber === 2 ? { tag: "20% OFF COUPON INSIDE", text: "🎁 Thanks for coming back — enjoy 20% off your next order!" }
    : { tag: "LOYAL CUSTOMER", text: "⭐ We appreciate your support — thank you!!!" }

  // Order number + customer name together, for staff to quickly match a bag
  // back to the right customer (and as the internal identifier the loyalty
  // notice above doesn't spell out once the numeric tag is dropped for 3rd+ orders).
  const customerName = (booking.customer_name as string | null) ?? ""
  const orderIdentifier = customerName ? `#${orderNumber} · ${customerName}` : `#${orderNumber}`

  // Floor vs Storage must be decided before receipts print — otherwise the
  // storage-marker instruction below would silently be wrong or missing.
  if (booking.hold_at_facility === null || booking.hold_at_facility === undefined) {
    return (
      <PinGate role="operator">
        <OperatorOrderGate assignedOperatorId={booking.assigned_operator_id ?? null}>
          <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center max-w-sm">
              <p className="text-3xl mb-3">📍📦</p>
              <p className="text-[#0D2240] font-extrabold text-lg">Floor vs. Storage not decided yet</p>
              <p className="text-gray-500 text-base mt-1">
                Go back to the order and choose Keep at Facility or Send to Storage before printing bag receipts.
              </p>
              <a href={`/operator/order/${id}`}
                className="inline-block mt-5 bg-[#0D2240] text-white font-bold text-base px-6 py-3 rounded-xl">
                ← Back to order
              </a>
            </div>
          </div>
        </OperatorOrderGate>
      </PinGate>
    )
  }

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*")
    .eq("booking_id", id)
    .order("bag_number")

  const orderCode = (booking.short_code ?? booking.id.slice(0, 8)).toUpperCase()
  const serviceLabel = booking.service_type === "wash_fold" ? "Wash & Fold"
    : booking.service_type === "comforter_wash" ? "Comforter Wash"
    : booking.service_type === "wash_only" ? "Wash Only"
    : booking.service_type

  const dueDate = booking.delivery_date
    ? new Date(booking.delivery_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })
    : "—"

  const colorKey = booking.color_key as string | null
  const colorLabel = colorKey ? (COLOR_LABEL[colorKey] ?? colorKey) : null
  const goingToStorage = booking.hold_at_facility === false

  const extras = (booking.extras as string | null)?.split(",").map((e: string) => e.trim()).filter(Boolean) ?? []

  const bagList = (bags ?? []).map(b => ({
    bag_number: b.bag_number as number,
    label_code: b.label_code as string,
  }))
  // The operator-entered finished/packed bag count always wins — order_bags
  // rows reflect the original pickup count, which can differ after folding
  // (e.g. picked up as 3 bags, packed down into 2). Print exactly what the
  // operator said they packed, one receipt per bag.
  const totalBags = (booking.output_bags as number | null) ?? (booking.num_bags as number | null) ?? bagList.length ?? 1

  const address = (booking.customer_address as string | null) ?? ""
  const detergent = (booking.detergent as string | null) ?? null

  // Build exactly TOTAL receipts (the operator-entered finished/packed bag
  // count) — use a real bag code where one exists for that bag number,
  // otherwise just number it. Rendered as plain server JSX rather than an
  // injected <script> building the DOM at runtime: this page lives inside
  // PinGate/OperatorOrderGate ("use client"), so it gets hydrated by React,
  // and an inline <script>'s DOM mutations aren't reliably preserved through
  // that hydration — which was why the sheet stayed empty and the print
  // button did nothing.
  const prefsLine = [detergent, ...extras].filter(Boolean).join(" · ") || null

  const receipts: ReceiptData[] = Array.from({ length: totalBags }, (_, i) => {
    const bagNum = i + 1
    const match = bagList.find(b => b.bag_number === bagNum)
    return {
      orderCode,
      bagNum,
      totalBags,
      bagCode: match?.label_code ?? null,
      serviceLabel,
      loyaltyTag: loyaltyNotice.tag,
      loyaltyText: loyaltyNotice.text,
      orderIdentifier,
      address,
      colorLabel,
      goingToStorage,
      prefsLine,
      dueDate,
    }
  })

  return (
    <PinGate role="operator">
      <OperatorOrderGate assignedOperatorId={booking.assigned_operator_id ?? null}>
        <>
            <style dangerouslySetInnerHTML={{ __html: `
              *, *::before, *::after { box-sizing: border-box; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f5f7; color: #0D2240; }

              .bar {
                position: sticky; top: 0; z-index: 10;
                background: #0D2240; padding: 14px 20px;
                /* Extra right padding reserves room for PinGate's fixed
                   top-right session pill ("<Name> · switch"), which floats
                   above everything (z-50) and would otherwise sit directly
                   on top of the print button in this corner. */
                padding-right: 190px;
                display: flex; align-items: center; gap: 14px;
                flex-wrap: wrap;
              }
              @media print {
                .bar { padding-right: 20px; }
              }
              .bar h1 { font-size: 15px; font-weight: 900; color: white; margin: 0; flex: 1; font-family: monospace; letter-spacing: 1px; }
              .bar .sub { font-size: 11px; color: rgba(255,255,255,0.55); font-family: sans-serif; font-weight: normal; margin-left: 8px; }
              .btn-print { background: #E8726A; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 900; font-size: 14px; cursor: pointer; }
              .btn-print:hover { background: #d45f57; }
              .btn-print:disabled { opacity: 0.6; cursor: default; }
              .btn-back { color: rgba(255,255,255,0.6); font-size: 13px; text-decoration: none; }
              .btn-back:hover { color: white; }

              .print-btn-wrap { position: relative; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
              .btn-print-alt {
                background: none; border: none; color: rgba(255,255,255,0.5);
                font-size: 10px; text-decoration: underline; cursor: pointer; padding: 0;
              }
              .btn-print-alt:hover { color: white; }
              .print-error {
                position: absolute; top: 100%; right: 0; margin-top: 8px; z-index: 20;
                background: white; color: #b91c1c; font-size: 12px; font-weight: 700;
                padding: 10px 12px; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
                width: 260px; text-align: left;
              }
              .btn-fallback {
                display: block; margin-top: 8px; background: #0D2240; color: white;
                border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px;
                font-weight: 700; cursor: pointer; width: 100%;
              }

              .preview-note { max-width: 500px; margin: 24px auto; padding: 0 20px; font-size: 13px; color: #888; text-align: center; }

              .sheet { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; }

              /* 80mm roll — 72mm printable width is standard once you subtract printer margins */
              .receipt {
                width: 80mm;
                padding: 14px 10px;
                border: 1px dashed #ccc;
                background: white;
                font-family: 'Courier New', monospace;
                color: #0D2240;
              }
              .r-center { text-align: center; }
              .r-brand { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #666; }
              .r-bagof { font-size: 12px; font-weight: 700; margin-top: 2px; }
              .r-order-code { font-size: 30px; font-weight: 900; letter-spacing: 1px; margin: 6px 0 2px; }
              .r-bag-code { font-size: 13px; color: #555; }
              .r-service { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
              .r-divider { border: none; border-top: 1px dashed #999; margin: 10px 0; }

              .r-section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 3px; }
              .r-address { font-size: 13px; font-weight: 700; line-height: 1.4; margin-bottom: 10px; }

              /* Monochrome thermal print — color is never rendered visually, only
                 named as text, so the operator knows which physical sticker to apply. */
              .r-color-row { border: 2px solid #0D2240; border-radius: 4px; padding: 6px 8px; margin-bottom: 8px; text-align: center; }
              .r-color-row .r-tag { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; display: block; }
              .r-color-text { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }

              .r-storage-flag { border: 2px solid #0D2240; background: #0D2240; color: white; border-radius: 4px; padding: 8px; text-align: center; margin-bottom: 8px; }
              .r-storage-flag span { font-size: 11px; font-weight: 900; letter-spacing: 0.5px; }

              /* Customer loyalty notice — printed once per bag so the operator
                 (or a bag-checker at delivery) can't miss it: this tells them
                 whether to slip in a welcome gift, a 20%-off coupon, etc. */
              .r-loyalty-flag { border: 2px dashed #0D2240; border-radius: 4px; padding: 6px 8px; margin-bottom: 8px; text-align: center; }
              .r-loyalty-flag .r-tag { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; display: block; }
              .r-loyalty-flag .r-loyalty-text { font-size: 11px; font-weight: 700; line-height: 1.35; display: block; margin-top: 2px; }
              .r-loyalty-flag .r-order-id { font-size: 9px; color: #888; display: block; margin-top: 4px; letter-spacing: 0.3px; }

              .r-prefs { font-size: 11px; line-height: 1.5; margin-bottom: 8px; }

              .r-due { font-size: 12px; font-weight: 700; text-align: center; margin-top: 8px; }
              .r-due span { display: block; font-size: 9px; font-weight: 400; color: #888; }
              .r-instruction { font-size: 9px; color: #888; font-style: italic; text-align: center; margin-top: 6px; }

              @media print {
                @page { size: 80mm auto; margin: 0; }
                body { background: white; }
                .bar, .preview-note { display: none !important; }
                .sheet { display: block; padding: 0; gap: 0; }
                .receipt { border: none; page-break-after: always; break-after: page; margin: 0; width: 80mm; }
              }
            ` }} />
            <div className="bar">
              <h1>
                🧾 {orderCode}
                <span className="sub">{totalBags} bag{totalBags !== 1 ? "s" : ""} · 80mm roll · no price printed</span>
              </h1>
              <a href={`/operator/order/${id}`} className="btn-back">← Back to order</a>
              <PrintReceiptsButton receipts={receipts} autoprint={autoprint === "1"} />
            </div>

            <p className="preview-note">
              One receipt per output bag. First tap connects your paired Bluetooth printer once — after that it prints straight to it, no dialog. Includes the delivery address for the driver. No price is printed.
            </p>

            <div className="sheet">
              {receipts.map(({ bagNum, bagCode }) => (
                <div className="receipt" key={bagNum}>
                  <div className="r-center">
                    <div className="r-brand">WashFold Orlando</div>
                    <div className="r-bagof">BAG {bagNum} / {totalBags}</div>
                    <div className="r-order-code">{orderCode}</div>
                    {bagCode && <div className="r-bag-code">{bagCode}</div>}
                    <div className="r-service">{serviceLabel}</div>
                  </div>
                  <hr className="r-divider" />
                  <div className="r-loyalty-flag">
                    <span className="r-tag">{loyaltyNotice.tag}</span>
                    <span className="r-loyalty-text">{loyaltyNotice.text}</span>
                    <span className="r-order-id">{orderIdentifier}</span>
                  </div>
                  {address && (
                    <>
                      <div className="r-section-title">Delivery Address</div>
                      <div className="r-address">{address}</div>
                    </>
                  )}
                  {colorLabel && (
                    <div className="r-color-row">
                      <span className="r-tag">Color key sticker</span>
                      <span className="r-color-text">{colorLabel}</span>
                    </div>
                  )}
                  {goingToStorage && (
                    <div className="r-storage-flag">
                      <span>GOING TO STORAGE</span>
                    </div>
                  )}
                  {(detergent || extras.length > 0) && (
                    <>
                      <div className="r-section-title">Wash Preferences</div>
                      <div className="r-prefs">
                        {[detergent, ...extras].filter(Boolean).join(" · ")}
                      </div>
                    </>
                  )}
                  <div className="r-due">
                    {dueDate}
                    <span>Deliver to customer by</span>
                  </div>
                  <div className="r-instruction">Do not remove · Match sticker to bag</div>
                </div>
              ))}
            </div>
        </>
      </OperatorOrderGate>
    </PinGate>
  )
}
