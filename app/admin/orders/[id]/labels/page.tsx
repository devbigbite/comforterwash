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

  return (
    <html>
      <head>
        <title>Labels — {orderCode}</title>
        <style>{`
          @page { margin: 0.5in; }
          * { box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background: white; }
          .no-print { margin-bottom: 20px; }
          .no-print button {
            background: #0D2240; color: white; border: none; padding: 10px 24px;
            border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px;
            margin-right: 10px;
          }
          .no-print a { color: #666; font-size: 14px; }
          .labels-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
          .label {
            border: 3px solid #0D2240; border-radius: 16px; padding: 24px;
            page-break-inside: avoid; break-inside: avoid;
            min-height: 200px; display: flex; flex-direction: column; gap: 12px;
          }
          .label-header { display: flex; justify-content: space-between; align-items: flex-start; }
          .brand { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #666; }
          .bag-badge {
            background: #E8726A; color: white; font-size: 13px; font-weight: 900;
            padding: 4px 12px; border-radius: 20px;
          }
          .order-code { font-size: 32px; font-weight: 900; color: #0D2240; font-family: monospace; letter-spacing: 2px; }
          .bag-label { font-size: 22px; font-weight: 900; color: #0D2240; font-family: monospace; }
          .customer { font-size: 13px; color: #555; font-weight: 600; margin-top: 4px; }
          .service-badge {
            display: inline-block; background: #f7f8fb; border: 1px solid #e0e0e0;
            color: #555; font-size: 10px; font-weight: bold; text-transform: uppercase;
            letter-spacing: 1px; padding: 3px 10px; border-radius: 20px; margin-top: 4px;
          }
          .instruction {
            margin-top: auto; border-top: 2px dashed #e0e0e0; padding-top: 10px;
            font-size: 11px; color: #999; font-style: italic;
          }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        `}</style>
      </head>
      <body>
        <div className="no-print">
          <button onClick="window.print()">🖨️ Print Labels</button>
          <a href={`/admin/orders/${id}`}>← Back to Order</a>
        </div>

        <div className="labels-grid">
          {bags?.map((bag) => (
            <div key={bag.id} className="label">
              <div className="label-header">
                <span className="brand">WashFold Orlando</span>
                <span className="bag-badge">BAG {bag.bag_number} / {bags.length}</span>
              </div>
              <div>
                <div className="order-code">{orderCode}</div>
                <div className="bag-label">{bag.label_code}</div>
              </div>
              <div>
                <div className="customer">{booking.customer_name}</div>
                <div>
                  <span className="service-badge">
                    {booking.service_type === "wash_fold" ? "Wash & Fold" : "Comforter Wash"}
                  </span>
                </div>
              </div>
              <div className="instruction">
                Attach to bag · Do not remove · Scan at each station
              </div>
            </div>
          ))}
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.querySelector('.no-print button').addEventListener('click', () => window.print());
        `}} />
      </body>
    </html>
  )
}
