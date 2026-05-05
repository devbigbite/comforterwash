import { createAdminClient } from "@/lib/supabase/admin"
import { createPromoCode, togglePromoCode, deletePromoCode } from "@/app/actions/promos"
import { getComforterPromo, setComforterPromo, getLandingOffers } from "@/app/actions/settings"
import { LandingOffersEditor } from "@/components/admin/landing-offers-editor"

function fmt(promo: { discount_type: string; discount_value: number }) {
  return promo.discount_type === "percent"
    ? `${promo.discount_value}% off`
    : `$${promo.discount_value.toFixed(2)} off`
}

export default async function PromotionsPage() {
  const supabase = createAdminClient()
  const [{ data: promos = [] }, promoActive, offers] = await Promise.all([
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    getComforterPromo(),
    getLandingOffers(),
  ])

  const active = (promos ?? []).filter((p: { active: boolean }) => p.active)
  const inactive = (promos ?? []).filter((p: { active: boolean }) => !p.active)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">

      <div>
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Promotions</h1>
        <p className="text-sm text-gray-400 mt-1">Manage all promotions, offers, and promo codes in one place.</p>
      </div>

      {/* ── Section 1: Landing Page Offers ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-extrabold text-[#0D2240] uppercase tracking-wide">Landing Page Offers</h2>
          <p className="text-sm text-gray-400 mt-0.5">The three offer cards shown on the homepage. Toggle visibility, edit badge text, title, and description.</p>
        </div>
        <LandingOffersEditor initialOffers={offers} />
      </section>

      {/* ── Section 2: Comforter Flat-Rate Promo ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-extrabold text-[#0D2240] uppercase tracking-wide">Comforter Flat-Rate Promotion</h2>
          <p className="text-sm text-gray-400 mt-0.5">When active, all comforter sizes show a $33 flat-rate promo price in the booking form.</p>
        </div>
        <div className={`rounded-2xl border-2 shadow-sm p-6 transition-all ${promoActive ? "border-[#E8726A] bg-[#fdf6f3]" : "border-gray-100 bg-white"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🏷️</span>
                <h3 className="font-extrabold text-[#0D2240] text-base">$33 Any-Size Comforter</h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${promoActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {promoActive ? "ACTIVE" : "OFF"}
                </span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mt-1">
                Original per-size prices appear crossed out in red. Customers see the deal immediately.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                {[
                  { size: "Twin", orig: "$29", promo: "$33" },
                  { size: "Full", orig: "$33", promo: "$33" },
                  { size: "Queen", orig: "$38", promo: "$33" },
                  { size: "King", orig: "$43", promo: "$33" },
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
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
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
            <p className="text-xs text-gray-400">Changes take effect immediately for all new bookings.</p>
          </div>
        </div>
      </section>

      {/* ── Section 3: Promo Codes ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#0D2240] uppercase tracking-wide">Promo Codes</h2>
            <p className="text-sm text-gray-400 mt-0.5">{active.length} active · {inactive.length} inactive</p>
          </div>
        </div>

        {/* Create form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="font-extrabold text-[#0D2240] text-sm mb-4">New Promo Code</h3>
          <form action={createPromoCode} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Code *</label>
              <input name="code" required placeholder="SUMMER25"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#E8726A]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Description</label>
              <input name="description" placeholder="Summer promotion"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Discount Type</label>
              <select name="discount_type"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]">
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Value *</label>
              <input name="discount_value" type="number" step="0.01" min="0" required placeholder="15"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Applies To</label>
              <select name="applies_to"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]">
                <option value="all">All Services</option>
                <option value="comforter_wash">Comforter Wash</option>
                <option value="wash_fold">Wash &amp; Fold</option>
                <option value="wash_only">Wash Only</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Max Uses (blank = unlimited)</label>
              <input name="max_uses" type="number" min="1" placeholder="∞"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Expires</label>
              <input name="expires_at" type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
            <div className="flex items-end">
              <button type="submit"
                className="w-full bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors">
                Create Code
              </button>
            </div>
          </form>
        </div>

        {/* Active codes */}
        <h3 className="font-extrabold text-[#0D2240] text-xs uppercase tracking-wide mb-3">Active Codes</h3>
        <div className="space-y-2 mb-6">
          {active.length === 0 && <p className="text-sm text-gray-400 py-4">No active promo codes.</p>}
          {active.map((p: { id: string; code: string; discount_type: string; discount_value: number; applies_to: string; description?: string; uses_count: number; max_uses?: number; expires_at?: string }) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="font-mono font-extrabold text-[#0D2240] text-base">{p.code}</span>
                <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{fmt(p)}</span>
                {p.applies_to !== "all" && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">{p.applies_to.replace("_", " ")}</span>
                )}
                {p.description && <span className="text-xs text-gray-400">{p.description}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                <span>{p.uses_count}{p.max_uses ? `/${p.max_uses}` : ""} uses</span>
                {p.expires_at && <span>Exp {new Date(p.expires_at).toLocaleDateString()}</span>}
                <form action={togglePromoCode.bind(null, p.id, false)}>
                  <button className="text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1 rounded-lg hover:bg-amber-100 transition-colors font-bold uppercase text-[10px]">
                    Deactivate
                  </button>
                </form>
                <form action={deletePromoCode.bind(null, p.id)}>
                  <button className="text-red-500 border border-red-100 bg-red-50 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors font-bold uppercase text-[10px]">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

        {/* Inactive codes */}
        {inactive.length > 0 && (
          <>
            <h3 className="font-extrabold text-gray-400 text-xs uppercase tracking-wide mb-3">Inactive / Expired</h3>
            <div className="space-y-2">
              {inactive.map((p: { id: string; code: string; discount_type: string; discount_value: number; description?: string; uses_count: number }) => (
                <div key={p.id} className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between gap-4 opacity-60">
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-extrabold text-gray-500 text-base line-through">{p.code}</span>
                    <span className="text-xs text-gray-400">{fmt(p)}</span>
                    {p.description && <span className="text-xs text-gray-400">{p.description}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{p.uses_count} uses</span>
                    <form action={togglePromoCode.bind(null, p.id, true)}>
                      <button className="text-green-700 border border-green-200 bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-colors font-bold uppercase text-[10px]">
                        Reactivate
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

    </div>
  )
}
