import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { PinGate } from "@/components/pin-gate"
import { OperatorOrderGate } from "@/components/operator-order-gate"

// Color keys and the yellow storage marker are physical stickers applied by
// hand — the thermal printer is monochrome, so the receipt only ever names
// the color as text ("COLOR KEY: BLUE"), never renders it visually.
const COLOR_LABEL: Record<string, string> = {
  red: "Red", blue: "Blue", sky: "Sky Blue", green: "Green",
  lime: "Lime", pink: "Pink", hotpink: "Hot Pink",
  orange: "Orange", purple: "Purple",
}
/**
 * Operator bag receipts — printed one per output bag on a standard 80mm
 * thermal receipt roll (works the same on the Munbyn or any Bluetooth
 * thermal receipt printer — both install as a normal system printer and
 * print via the browser's print dialog; no special "programming" needed
 * beyond selecting the printer). Continuous roll, so each receipt is cut
 * to its actual content length rather than a fixed label size.
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

  const bagsJson = JSON.stringify(bagList)
  const address = (booking.customer_address as string | null) ?? ""

  return (
    <PinGate role="operator">
      <OperatorOrderGate assignedOperatorId={booking.assigned_operator_id ?? null}>
        <html>
          <head>
            <title>Bag Receipts — {orderCode}</title>
            <style>{`
              *, *::before, *::after { box-sizing: border-box; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f5f7; color: #0D2240; }

              .bar {
                position: sticky; top: 0; z-index: 10;
                background: #0D2240; padding: 14px 20px;
                display: flex; align-items: center; gap: 14px;
              }
              .bar h1 { font-size: 15px; font-weight: 900; color: white; margin: 0; flex: 1; font-family: monospace; letter-spacing: 1px; }
              .bar .sub { font-size: 11px; color: rgba(255,255,255,0.55); font-family: sans-serif; font-weight: normal; margin-left: 8px; }
              .btn-print { background: #E8726A; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 900; font-size: 14px; cursor: pointer; }
              .btn-print:hover { background: #d45f57; }
              .btn-back { color: rgba(255,255,255,0.6); font-size: 13px; text-decoration: none; }
              .btn-back:hover { color: white; }

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
            `}</style>
          </head>
          <body>
            <div className="bar">
              <h1>
                🧾 {orderCode}
                <span className="sub">{totalBags} bag{totalBags !== 1 ? "s" : ""} · 80mm roll · no price printed</span>
              </h1>
              <a href={`/operator/order/${id}`} className="btn-back">← Back to order</a>
              <button className="btn-print" id="print-btn">🖨️ Print All Receipts</button>
            </div>

            <p className="preview-note">
              One receipt per output bag, sized for an 80mm thermal roll (Munbyn or any Bluetooth thermal receipt printer — select it like any normal printer in the print dialog). Includes the delivery address for the driver. No price is printed.
            </p>

            <div className="sheet" id="sheet"></div>

            <script dangerouslySetInnerHTML={{ __html: `
              var BAGS = ${bagsJson};
              var TOTAL = ${totalBags};
              var ORDER_CODE = ${JSON.stringify(orderCode)};
              var SERVICE = ${JSON.stringify(serviceLabel)};
              var DUE = ${JSON.stringify(dueDate)};
              var ADDRESS = ${JSON.stringify(address)};
              var COLOR_LABEL = ${JSON.stringify(colorLabel)};
              var GOING_TO_STORAGE = ${JSON.stringify(goingToStorage)};
              var EXTRAS = ${JSON.stringify(extras)};
              var DETERGENT = ${JSON.stringify(booking.detergent ?? null)};

              function escapeHtml(str) {
                return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
              }

              function buildReceipt(bagNum, bagCode) {
                var colorRow = COLOR_LABEL
                  ? '<div class="r-color-row"><span class="r-tag">Color key sticker</span>' +
                    '<span class="r-color-text">' + escapeHtml(COLOR_LABEL) + '</span></div>'
                  : '';
                var storageFlag = GOING_TO_STORAGE
                  ? '<div class="r-storage-flag"><span>⚠ APPLY YELLOW MARKER STICKER — GOING TO STORAGE</span></div>'
                  : '';
                var prefsParts = [];
                if (DETERGENT) prefsParts.push(escapeHtml(DETERGENT));
                EXTRAS.forEach(function(e) { prefsParts.push(escapeHtml(e)); });
                var prefsHTML = prefsParts.length
                  ? '<div class="r-section-title">Wash Preferences</div><div class="r-prefs">' + prefsParts.join(' · ') + '</div>'
                  : '';
                var addressHTML = ADDRESS
                  ? '<div class="r-section-title">Delivery Address</div><div class="r-address">' + escapeHtml(ADDRESS) + '</div>'
                  : '';

                return '<div class="receipt">' +
                  '<div class="r-center">' +
                    '<div class="r-brand">WashFold Orlando</div>' +
                    '<div class="r-bagof">BAG ' + bagNum + ' / ' + TOTAL + '</div>' +
                    '<div class="r-order-code">' + escapeHtml(ORDER_CODE) + '</div>' +
                    (bagCode ? '<div class="r-bag-code">' + escapeHtml(bagCode) + '</div>' : '') +
                    '<div class="r-service">' + escapeHtml(SERVICE) + '</div>' +
                  '</div>' +
                  '<hr class="r-divider">' +
                  addressHTML +
                  colorRow +
                  storageFlag +
                  prefsHTML +
                  '<div class="r-due">' + escapeHtml(DUE) + '<span>Ready / Due date</span></div>' +
                  '<div class="r-instruction">Do not remove · Match sticker to bag</div>' +
                '</div>';
              }

              function render() {
                var sheet = document.getElementById("sheet");
                var html = "";
                // Always print exactly TOTAL receipts (the operator-entered finished
                // bag count) — use a real bag code where one exists for that bag
                // number, otherwise just number it.
                for (var i = 1; i <= TOTAL; i++) {
                  var match = null;
                  for (var j = 0; j < BAGS.length; j++) {
                    if (BAGS[j].bag_number === i) { match = BAGS[j]; break; }
                  }
                  html += buildReceipt(i, match ? match.label_code : null);
                }
                sheet.innerHTML = html;
              }

              document.getElementById("print-btn").addEventListener("click", function() { window.print(); });
              render();

              if (${JSON.stringify(autoprint === "1")}) {
                // Give the receipts a beat to lay out before invoking the print dialog.
                setTimeout(function() { window.print(); }, 300);
              }
            `}} />
          </body>
        </html>
      </OperatorOrderGate>
    </PinGate>
  )
}
