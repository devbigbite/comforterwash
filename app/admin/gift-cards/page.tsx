import { redirect } from "next/navigation"
import { getGiftCards } from "@/app/actions/gift-cards"
import { isAdminForCurrentLocation } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-green-50 text-green-700 border border-green-200",
  redeemed:  "bg-gray-100 text-gray-500 border border-gray-200",
  cancelled: "bg-red-50 text-red-700 border border-red-200",
}

export default async function GiftCardsAdminPage() {
  // getGiftCards() calls the requireAdmin()-gated action, which throws
  // instead of returning for a logged-out/unauthorized visitor — check
  // first and redirect gracefully instead of crashing the page.
  if (!(await isAdminForCurrentLocation())) redirect("/admin/login")

  const cards = await getGiftCards()
  const totalOutstandingCents = cards
    .filter(c => c.status === "active")
    .reduce((sum, c) => sum + c.balance_cents, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Gift Cards</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {cards.length} issued · ${(totalOutstandingCents / 100).toFixed(2)} outstanding balance
          </p>
        </div>
        <a
          href="/gift-cards"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-[#0D2240] border border-gray-200 hover:border-[#0D2240] px-3 py-2 rounded-xl transition-colors"
        >
          View Purchase Page ↗
        </a>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-4xl mb-3">🎁</p>
          <p className="text-[#0D2240] font-bold">No gift cards issued yet</p>
          <p className="text-gray-400 text-sm mt-1">They'll show up here as soon as someone buys one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-[#0D2240]">{c.code}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  ${(c.initial_amount_cents / 100).toFixed(2)} issued · ${(c.balance_cents / 100).toFixed(2)} remaining
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  From {c.purchaser_name ?? "—"} ({c.purchaser_email ?? "no email"})
                  {c.recipient_name && <> → to {c.recipient_name} ({c.recipient_email ?? "no email"})</>}
                </p>
                {c.message && <p className="text-xs text-gray-500 italic mt-1">"{c.message}"</p>}
                <p className="text-[10px] text-gray-300 mt-1">
                  {new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
