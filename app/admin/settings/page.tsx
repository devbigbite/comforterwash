import { getComforterPromo, setComforterPromo } from "@/app/actions/settings"

export default async function SettingsPage() {
  const promoActive = await getComforterPromo()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Promotions</h1>
        <p className="text-sm text-gray-400 mt-1">Toggle site-wide promotions on or off instantly.</p>
      </div>

      {/* Comforter flat-rate promo card */}
      <div className={`rounded-2xl border-2 shadow-sm p-6 transition-all ${promoActive ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏷️</span>
              <h2 className="font-extrabold text-[#0D2240] text-lg">Comforter Flat-Rate Promotion</h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              When <strong>ON</strong>, the booking form shows a <strong className="text-[#E8726A]">$33 any-size</strong> promotional price for all comforters.
              Original per-size prices appear crossed out in red. Customers see the deal immediately.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
              {[
                { size: "Twin", orig: "$29", promo: "$33" },
                { size: "Full",  orig: "$33", promo: "$33" },
                { size: "Queen", orig: "$38", promo: "$33" },
                { size: "King",  orig: "$43", promo: "$33" },
              ].map(s => (
                <span key={s.size} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-2.5 py-1.5">
                  <span className="font-semibold text-[#0D2240]">{s.size}</span>
                  {promoActive ? (
                    <>
                      <span className="line-through text-red-400">{s.orig}</span>
                      <span className="font-bold text-[#E8726A]">{s.promo}</span>
                    </>
                  ) : (
                    <span className="font-bold text-gray-500">{s.orig}</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${promoActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {promoActive ? "ACTIVE" : "OFF"}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-3">
          {promoActive ? (
            <form action={async () => { "use server"; await setComforterPromo(false) }}>
              <button type="submit"
                className="bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 font-bold text-sm px-6 py-2.5 rounded-xl transition-colors border border-gray-200 hover:border-red-200">
                Turn Off Promotion
              </button>
            </form>
          ) : (
            <form action={async () => { "use server"; await setComforterPromo(true) }}>
              <button type="submit"
                className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm">
                🚀 Activate — $33 Any Size
              </button>
            </form>
          )}
          <p className="text-xs text-gray-400">
            Changes take effect immediately for all new bookings.
          </p>
        </div>
      </div>
    </div>
  )
}
