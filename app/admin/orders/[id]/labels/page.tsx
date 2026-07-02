import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"

export default async function PrintLabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).single()
  if (!booking) notFound()

  const { data: bags } = await supabase
    .from("order_bags")
    .select("*")
    .eq("booking_id", id)
    .order("bag_number")

  const orderCode = booking.id.slice(0, 8).toUpperCase()
  const serviceLabel = booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"
  const deliveryDate = booking.delivery_date ?? ""

  const bagsJson = JSON.stringify(bags ?? [])

  return (
    <html>
      <head>
        <title>Labels — {orderCode}</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #f4f5f7;
            color: #0D2240;
          }

          /* ── Control bar ───────────────────────────────────── */
          .control-bar {
            position: sticky;
            top: 0;
            z-index: 100;
            background: #0D2240;
            padding: 14px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          .control-bar h1 {
            font-size: 15px;
            font-weight: 900;
            color: white;
            margin: 0;
            flex: 1;
            font-family: monospace;
            letter-spacing: 1px;
          }
          .control-bar .sub {
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            font-family: sans-serif;
            font-weight: normal;
            margin-left: 10px;
          }
          .btn-print {
            background: #E8726A;
            color: white;
            border: none;
            padding: 10px 22px;
            border-radius: 10px;
            font-weight: 900;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.15s;
          }
          .btn-print:hover { background: #d45f57; }
          .btn-back {
            color: rgba(255,255,255,0.6);
            font-size: 13px;
            text-decoration: none;
            padding: 8px 0;
          }
          .btn-back:hover { color: white; }

          /* ── Item editor panel ─────────────────────────────── */
          .editor-wrap {
            max-width: 860px;
            margin: 28px auto;
            padding: 0 20px;
          }
          .editor-intro {
            background: white;
            border-radius: 14px;
            border: 1px solid #e8e9ec;
            padding: 18px 22px;
            margin-bottom: 20px;
            font-size: 13px;
            color: #555;
          }
          .editor-intro strong { color: #0D2240; }
          .editor-intro p { margin: 0 0 6px; }
          .editor-intro p:last-child { margin: 0; }

          .bag-editor {
            background: white;
            border-radius: 14px;
            border: 1px solid #e8e9ec;
            padding: 20px 22px;
            margin-bottom: 16px;
          }
          .bag-editor-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
          }
          .bag-num-badge {
            background: #0D2240;
            color: white;
            font-size: 12px;
            font-weight: 900;
            font-family: monospace;
            padding: 4px 10px;
            border-radius: 8px;
          }
          .bag-code {
            font-family: monospace;
            font-size: 13px;
            color: #888;
          }
          .items-list { display: flex; flex-direction: column; gap: 8px; }
          .item-row {
            display: grid;
            grid-template-columns: 1fr 90px 36px;
            gap: 8px;
            align-items: center;
          }
          .item-row input[type="text"] {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 13px;
            color: #0D2240;
            outline: none;
            transition: border 0.15s;
          }
          .item-row input[type="text"]:focus { border-color: #E8726A; }
          .item-row input[type="number"] {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 13px;
            text-align: center;
            color: #0D2240;
            outline: none;
          }
          .item-row input[type="number"]:focus { border-color: #E8726A; }
          .btn-remove {
            background: none;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            color: #bbb;
            font-size: 16px;
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
          }
          .btn-remove:hover { border-color: #E8726A; color: #E8726A; }
          .btn-add-item {
            margin-top: 10px;
            background: none;
            border: 1.5px dashed #ccc;
            border-radius: 8px;
            color: #aaa;
            font-size: 12px;
            font-weight: 700;
            padding: 7px 14px;
            cursor: pointer;
            transition: all 0.15s;
            width: 100%;
            text-align: left;
          }
          .btn-add-item:hover { border-color: #0D2240; color: #0D2240; }
          .col-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #aaa;
            letter-spacing: 0.5px;
          }
          .col-headers {
            display: grid;
            grid-template-columns: 1fr 90px 36px;
            gap: 8px;
            margin-bottom: 4px;
          }

          /* ── Print preview / label grid ────────────────────── */
          .print-section { display: none; }

          /* ── Print styles ──────────────────────────────────── */
          @media print {
            @page { size: 4in 6in; margin: 0.2in; }
            body { background: white; }
            .control-bar,
            .editor-wrap { display: none !important; }
            .print-section { display: block !important; }

            .label {
              width: 100%;
              height: calc(6in - 0.4in);
              page-break-after: always;
              break-after: page;
              display: flex;
              flex-direction: column;
              border: 3px solid #0D2240;
              border-radius: 14px;
              padding: 18px 20px;
              overflow: hidden;
            }
            .label-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 10px;
            }
            .label-brand {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #888;
            }
            .label-bag-badge {
              background: #E8726A;
              color: white;
              font-size: 11px;
              font-weight: 900;
              padding: 3px 10px;
              border-radius: 20px;
            }
            .label-order-code {
              font-size: 28px;
              font-weight: 900;
              font-family: monospace;
              letter-spacing: 2px;
              color: #0D2240;
              line-height: 1;
            }
            .label-bag-code {
              font-size: 14px;
              font-weight: 700;
              font-family: monospace;
              color: #555;
              margin-top: 2px;
            }
            .label-customer {
              font-size: 13px;
              font-weight: 700;
              color: #0D2240;
              margin-top: 8px;
            }
            .label-service {
              display: inline-block;
              background: #f7f8fb;
              border: 1px solid #e0e0e0;
              color: #666;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 2px 8px;
              border-radius: 20px;
              margin-top: 4px;
            }
            .label-divider {
              border: none;
              border-top: 2px dashed #ddd;
              margin: 12px 0 8px;
            }
            .label-items-title {
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #aaa;
              margin-bottom: 6px;
            }
            .label-item-row {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              font-size: 13px;
              font-weight: 600;
              color: #0D2240;
              padding: 3px 0;
              border-bottom: 1px solid #f0f0f0;
            }
            .label-item-qty {
              font-weight: 900;
              font-family: monospace;
              font-size: 14px;
            }
            .label-no-items {
              font-size: 11px;
              color: #bbb;
              font-style: italic;
            }
            .label-footer {
              margin-top: auto;
              border-top: 1.5px dashed #e0e0e0;
              padding-top: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .label-due {
              font-size: 10px;
              color: #0D2240;
              font-weight: 700;
            }
            .label-due span {
              font-size: 9px;
              font-weight: 400;
              color: #aaa;
              display: block;
            }
            .label-instruction {
              font-size: 9px;
              color: #aaa;
              font-style: italic;
              text-align: right;
            }
          }
        `}</style>
      </head>
      <body>

        {/* ── Control bar ── */}
        <div className="control-bar" id="control-bar">
          <h1>
            🏷️ {orderCode}
            <span className="sub">{booking.customer_name} · {serviceLabel}</span>
          </h1>
          <a href={`/admin/orders/${id}`} className="btn-back">← Back</a>
          <button className="btn-print" onclick="doPrint()">🖨️ Print Labels</button>
        </div>

        {/* ── Item editor ── */}
        <div className="editor-wrap" id="editor-wrap">
          <div className="editor-intro">
            <p><strong>Add item details to each packet before printing.</strong></p>
            <p>Fill in what's inside each bag (e.g. "Dress Shirts" × 5, "Pants" × 3). Leave blank if not needed — the label will still print. When done, click <strong>Print Labels</strong>.</p>
          </div>
          <div id="bag-editors"></div>
        </div>

        {/* ── Print output (hidden until print) ── */}
        <div className="print-section" id="print-section"></div>

        <script dangerouslySetInnerHTML={{ __html: `
          var BAGS = ${bagsJson};
          var ORDER_CODE = ${JSON.stringify(orderCode)};
          var CUSTOMER   = ${JSON.stringify(booking.customer_name ?? "")};
          var SERVICE    = ${JSON.stringify(serviceLabel)};
          var DUE_DATE   = ${JSON.stringify(deliveryDate)};

          // State: items per bag  { bagId: [{type, qty}] }
          var state = {};
          BAGS.forEach(function(bag) {
            state[bag.id] = [{ type: "", qty: 1 }];
          });

          function renderEditors() {
            var wrap = document.getElementById("bag-editors");
            wrap.innerHTML = "";
            BAGS.forEach(function(bag) {
              var items = state[bag.id];
              var div = document.createElement("div");
              div.className = "bag-editor";
              div.innerHTML =
                '<div class="bag-editor-header">' +
                  '<span class="bag-num-badge">BAG ' + bag.bag_number + ' / ' + BAGS.length + '</span>' +
                  '<span class="bag-code">' + bag.label_code + '</span>' +
                '</div>' +
                '<div class="col-headers">' +
                  '<span class="col-label">Item / Description</span>' +
                  '<span class="col-label">Qty</span>' +
                  '<span></span>' +
                '</div>' +
                '<div class="items-list" id="items-' + bag.id + '">' +
                  items.map(function(item, idx) { return itemRowHTML(bag.id, idx, item); }).join("") +
                '</div>' +
                '<button class="btn-add-item" onclick="addItem(\'' + bag.id + '\')">+ Add item</button>';
              wrap.appendChild(div);
            });
          }

          function itemRowHTML(bagId, idx, item) {
            return '<div class="item-row" id="row-' + bagId + '-' + idx + '">' +
              '<input type="text" placeholder="e.g. Dress Shirts, Pants, Polos…"' +
                ' value="' + escapeAttr(item.type) + '"' +
                ' oninput="updateItem(\'' + bagId + '\',' + idx + ',\'type\',this.value)">' +
              '<input type="number" min="1" max="999" value="' + (item.qty || 1) + '"' +
                ' oninput="updateItem(\'' + bagId + '\',' + idx + ',\'qty\',parseInt(this.value)||1)">' +
              '<button class="btn-remove" onclick="removeItem(\'' + bagId + '\',' + idx + ')" title="Remove">×</button>' +
            '</div>';
          }

          function escapeAttr(str) {
            return String(str || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
          }

          function updateItem(bagId, idx, field, val) {
            state[bagId][idx][field] = val;
          }

          function addItem(bagId) {
            state[bagId].push({ type: "", qty: 1 });
            renderEditors();
            // Focus the new type input
            var list = document.getElementById("items-" + bagId);
            if (list) {
              var last = list.querySelectorAll('input[type="text"]');
              if (last.length) last[last.length - 1].focus();
            }
          }

          function removeItem(bagId, idx) {
            if (state[bagId].length <= 1) {
              state[bagId][0] = { type: "", qty: 1 };
            } else {
              state[bagId].splice(idx, 1);
            }
            renderEditors();
          }

          function buildPrintSection() {
            var section = document.getElementById("print-section");
            section.innerHTML = BAGS.map(function(bag) {
              var items = (state[bag.id] || []).filter(function(i) { return i.type && i.type.trim(); });

              var itemsHTML = items.length
                ? items.map(function(i) {
                    return '<div class="label-item-row">' +
                      '<span>' + escapeHtml(i.type) + '</span>' +
                      '<span class="label-item-qty">× ' + (i.qty || 1) + '</span>' +
                    '</div>';
                  }).join("")
                : '<div class="label-no-items">No item detail specified</div>';

              var dueFmt = DUE_DATE
                ? new Date(DUE_DATE + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
                : "—";

              return '<div class="label">' +
                '<div class="label-top">' +
                  '<span class="label-brand">WashFold Orlando</span>' +
                  '<span class="label-bag-badge">BAG ' + bag.bag_number + ' / ' + BAGS.length + '</span>' +
                '</div>' +
                '<div class="label-order-code">' + ORDER_CODE + '</div>' +
                '<div class="label-bag-code">' + bag.label_code + '</div>' +
                '<div class="label-customer">' + escapeHtml(CUSTOMER) + '</div>' +
                '<div class="label-service">' + SERVICE + '</div>' +
                '<hr class="label-divider">' +
                '<div class="label-items-title">Contents</div>' +
                itemsHTML +
                '<div class="label-footer">' +
                  '<div class="label-due">' + dueFmt + '<span>Ready / Due date</span></div>' +
                  '<div class="label-instruction">Do not remove · Scan at each station</div>' +
                '</div>' +
              '</div>';
            }).join("");
          }

          function escapeHtml(str) {
            return String(str || "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");
          }

          function doPrint() {
            // Sync any currently focused inputs before printing
            var inputs = document.querySelectorAll('.item-row input');
            inputs.forEach(function(inp) { inp.dispatchEvent(new Event('input')); });
            buildPrintSection();
            window.print();
          }

          // Init
          renderEditors();
        `}} />
      </body>
    </html>
  )
}
