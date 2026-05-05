import { createAdminClient } from "@/lib/supabase/admin"
import { createPromoCode, togglePromoCode, deletePromoCode } from "@/app/actions/promos"

function fmt(promo: { discount_type: string; discount_value: number }) {
  return promo.discount_type === "percent"
    ? `${promo.discount_value}% off`
    : `$${promo.discount_value.toFixed(2)} off`
}

export default async function PromosPage() {
  const supabase = createAdminClient()
  const { data: promos = [] } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false })

  const active = promos.filter(p => p.active)
  const inactive = promos.filter(p => !p.active)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Promo Codes</h1>
          <p className="text-sm text-gray-400">{active.length} active · {inactive.length} inactive</p>
        </div>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-4">New Promo Code</h2>
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
      <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-3">Active Codes</h2>
      <div className="space-y-2 mb-8">
        {active.length === 0 && <p className="text-sm text-gray-400 py-4">No active promo codes.</p>}
        {active.map((p) => (
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
          <h2 className="font-extrabold text-gray-400 text-sm uppercase tracking-wide mb-3">Inactive / Expired</h2>
          <div className="space-y-2">
            {inactive.map((p) => (
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
    </div>
  )
}
