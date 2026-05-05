import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

async function createRoute(formData: FormData) {
  "use server"
  const supabase = createAdminClient()
  const pickupDays = formData.getAll("pickup_days") as string[]
  const deliveryDays = formData.getAll("delivery_days") as string[]
  const areas = (formData.get("service_areas") as string)
    .split(",").map(s => s.trim()).filter(Boolean)

  await supabase.from("routes").insert({
    name:          formData.get("name") as string,
    service_areas: areas,
    pickup_days:   pickupDays,
    delivery_days: deliveryDays,
    recurrence:    formData.get("recurrence") as string,
    notes:         formData.get("notes") as string || null,
    active:        true,
  })
  revalidatePath("/admin/routes")
}

async function toggleRoute(id: string, active: boolean) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("routes").update({ active }).eq("id", id)
  revalidatePath("/admin/routes")
}

async function deleteRoute(id: string) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("routes").delete().eq("id", id)
  revalidatePath("/admin/routes")
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DAY_ABBR: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun"
}

export default async function RoutesPage() {
  const supabase = createAdminClient()
  const { data: routes = [] } = await supabase
    .from("routes")
    .select("*")
    .order("created_at", { ascending: true })

  const active = routes.filter(r => r.active)
  const inactive = routes.filter(r => !r.active)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Route Management</h1>
        <p className="text-sm text-gray-400">Define pickup/delivery routes, service areas, and scheduling.</p>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-4">New Route</h2>
        <form action={createRoute} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Route Name *</label>
              <input name="name" required placeholder="Northeast Route"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Recurrence</label>
              <select name="recurrence"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]">
                <option value="both">Weekly &amp; Bi-weekly</option>
                <option value="weekly">Weekly only</option>
                <option value="biweekly">Bi-weekly only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Service Areas (zip codes or names, comma-separated)</label>
            <input name="service_areas" placeholder="32801, 32803, Downtown Orlando, Orlando East"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold text-[#E8726A] uppercase tracking-wide block mb-2">↑ Pickup Days</label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map(d => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" name="pickup_days" value={d.toLowerCase()}
                      className="w-3.5 h-3.5 accent-[#E8726A]" />
                    <span className="text-xs text-gray-600 font-medium">{d.slice(0,3)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#0D2240] uppercase tracking-wide block mb-2">↓ Delivery Days</label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map(d => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" name="delivery_days" value={d.toLowerCase()}
                      className="w-3.5 h-3.5 accent-[#0D2240]" />
                    <span className="text-xs text-gray-600 font-medium">{d.slice(0,3)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Notes (optional)</label>
            <input name="notes" placeholder="e.g. high-density area, priority route"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>

          <button type="submit"
            className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold px-6 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors">
            Create Route
          </button>
        </form>
      </div>

      {/* Active routes */}
      <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-3">Active Routes ({active.length})</h2>
      <div className="space-y-3 mb-8">
        {active.length === 0 && <p className="text-sm text-gray-400 py-4">No routes yet — create one above.</p>}
        {active.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-extrabold text-[#0D2240]">{r.name}</h3>
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full uppercase">Active</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {r.recurrence === "both" ? "Weekly & Bi-weekly" : r.recurrence}
                  </span>
                </div>

                {r.service_areas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(r.service_areas as string[]).map((area) => (
                      <span key={area} className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {area}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-6 text-xs text-gray-500">
                  <div>
                    <span className="font-bold text-[#E8726A] mr-1">↑ Pickup:</span>
                    {(r.pickup_days as string[] ?? []).map(d => DAY_ABBR[d] ?? d).join(", ") || "—"}
                  </div>
                  <div>
                    <span className="font-bold text-[#0D2240] mr-1">↓ Delivery:</span>
                    {(r.delivery_days as string[] ?? []).map(d => DAY_ABBR[d] ?? d).join(", ") || "—"}
                  </div>
                </div>
                {r.notes && <p className="text-xs text-gray-400 mt-2 italic">{r.notes}</p>}
              </div>

              <div className="flex gap-2 shrink-0">
                <form action={toggleRoute.bind(null, r.id, false)}>
                  <button className="text-[10px] font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors uppercase">
                    Deactivate
                  </button>
                </form>
                <form action={deleteRoute.bind(null, r.id)}>
                  <button className="text-[10px] font-bold text-red-400 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors uppercase">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>

      {inactive.length > 0 && (
        <>
          <h2 className="font-extrabold text-gray-400 text-sm uppercase tracking-wide mb-3">Inactive ({inactive.length})</h2>
          <div className="space-y-2 opacity-60">
            {inactive.map((r) => (
              <div key={r.id} className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500 line-through">{r.name}</span>
                <form action={toggleRoute.bind(null, r.id, true)}>
                  <button className="text-[10px] font-bold text-green-700 border border-green-200 bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-colors uppercase">
                    Reactivate
                  </button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
