import { getAbandonedCheckouts } from "@/app/actions/checkout-attempts"

export const dynamic = "force-dynamic"

const SERVICE_LABEL: Record<string, string> = {
  comforter_wash: "Comforter Wash",
  wash_fold:      "Wash & Fold",
  wash_only:      "Wash Only",
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  failed:  "bg-red-50 text-red-700 border border-red-200",
  expired: "bg-gray-100 text-gray-500 border border-gray-200",
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Started, didn't finish",
  failed:  "Card declined",
  expired: "Abandoned (expired)",
}

function digitsOnly(phone: string | null): string {
  return (phone ?? "").replace(/\D/g, "")
}

export default async function AbandonedCheckoutsPage() {
  const attempts = await getAbandonedCheckouts()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Abandoned Checkouts</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Customers who started booking but never completed payment — a declined card, or they just closed the tab.
          Follow up before they book with someone else.
        </p>
      </div>

      {attempts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-[#0D2240] font-bold">Nothing to follow up on</p>
          <p className="text-gray-400 text-sm mt-1">Every recent checkout attempt completed successfully.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map(a => {
            const phone = digitsOnly(a.customer_phone)
            const amount = a.amount_cents != null ? `$${(a.amount_cents / 100).toFixed(2)}` : "—"
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#0D2240]">{a.customer_name ?? "Unknown"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {SERVICE_LABEL[a.service_type ?? ""] ?? a.service_type ?? "Service"} · {amount}
                    {a.pickup_date ? ` · wanted pickup ${a.pickup_date}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.customer_email ?? "no email"} · {a.customer_phone ?? "no phone"}
                  </p>
                  {a.failure_reason && (
                    <p className="text-xs text-red-500 mt-1">⚠️ {a.failure_reason}</p>
                  )}
                  <p className="text-[10px] text-gray-300 mt-1">
                    Attempted {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {phone && (
                    <>
                      <a href={`tel:${phone}`} className="text-xs font-bold text-white bg-[#0D2240] hover:bg-[#1a3a5c] px-3 py-1.5 rounded-full text-center transition-colors">
                        📞 Call
                      </a>
                      <a href={`sms:${phone}`} className="text-xs font-bold text-[#0D2240] border border-gray-200 hover:border-[#0D2240] px-3 py-1.5 rounded-full text-center transition-colors">
                        💬 Text
                      </a>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
