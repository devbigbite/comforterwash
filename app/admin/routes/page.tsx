import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { RouteTimeWindowEditor } from "./route-time-window-editor"
import { RouteEditor } from "./route-editor"
import type { Route } from "@/lib/route-availability"

async function createRoute(formData: FormData) {
  "use server"
  const supabase = createAdminClient()
  const pickupDays   = formData.getAll("pickup_days") as string[]
  const deliveryDays = formData.getAll("delivery_days") as string[]
  const areas = (formData.get("service_areas") as string)
    .split(",").map(s => s.trim()).filter(Boolean)

  const turnaround = parseInt(formData.get("turnaround_days") as string || "3", 10)
  const biweeklyStart = formData.get("biweekly_start_date") as string || null

  await supabase.from("routes").insert({
    name:                formData.get("name") as string,
    service_areas:       areas,
    pickup_days:         pickupDays,
    delivery_days:       deliveryDays,
    recurrence:          formData.get("recurrence") as string,
    notes:               formData.get("notes") as string || null,
    turnaround_days:     turnaround,
    biweekly_start_date: biweeklyStart || null,
    active:              true,
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

async function updateRoute(id: string, formData: FormData) {
  "use server"
  const supabase = createAdminClient()
  const pickupDays   = formData.getAll("pickup_days") as string[]
  const deliveryDays = formData.getAll("delivery_days") as string[]
  const areas = (formData.get("service_areas") as string)
    .split(",").map(s => s.trim()).filter(Boolean)
  const biweeklyDate = formData.get("biweekly_start_date") as string || null

  await supabase.from("routes").update({
    name:                formData.get("name") as string,
    recurrence:          formData.get("recurrence") as string,
    turnaround_days:     parseInt(formData.get("turnaround_days") as string || "3", 10),
    biweekly_start_date: biweeklyDate || null,
    service_areas:       areas,
    pickup_days:         pickupDays,
    delivery_days:       deliveryDays,
    notes:               formData.get("notes") as string || null,
  }).eq("id", id)
  revalidatePath("/admin/routes")
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DAY_ABBR: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun"
}

export default async function RoutesPage() {
  const supabase = createAdminClient()

  const { data: routesRaw = [] } = await supabase
    .from("routes")
    .select("*")
    .order("created_at", { ascending: true })

  const routeIds = (routesRaw ?? []).map(r => r.id)
  const { data: windows = [] } = routeIds.length
    ? await supabase.from("route_time_windows").select("*").in("route_id", routeIds).order("sort_order").order("start_time")
    : { data: [] }

  const windowsByRoute: Record<string, Route["time_windows"]> = {}
  for (const w of (windows ?? [])) {
    if (!windowsByRoute[w.route_id]) windowsByRoute[w.route_id] = []
    windowsByRoute[w.route_id].push(w)
  }

  const routes: Route[] = (routesRaw ?? []).map(r => ({
    ...r,
    turnaround_days: r.turnaround_days ?? 3,
    time_windows: windowsByRoute[r.id] ?? [],
  })) as Route[]

  const active   = routes.filter(r => r.active)
  const inactive = routes.filter(r => !r.active)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Route Management</h1>
        <p className="text-sm text-gray-400">Define pickup/delivery routes, service areas, scheduling, and time windows.</p>
      </div>

      {/* ── Create form ── */}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                Turnaround Days <span className="font-normal">(pickup → delivery gap)</span>
              </label>
              <input name="turnaround_days" type="number" min="1" max="14" defaultValue="3"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                Biweekly Reference Date <span className="font-normal">(any date in an ON week)</span>
              </label>
              <input type="date" name="biweekly_start_date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Service Areas (comma-separated)</label>
            <input name="service_areas" placeholder="32801, 32803, Downtown Orlando"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold text-[#E8726A] uppercase tracking-wide block mb-2">↑ Pickup Days</label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map(d => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" name="pickup_days" value={d.toLowerCase()} className="w-3.5 h-3.5 accent-[#E8726A]" />
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
                    <input type="checkbox" name="delivery_days" value={d.toLowerCase()} className="w-3.5 h-3.5 accent-[#0D2240]" />
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

      {/* ── Active routes ── */}
      <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-3">Active Routes ({active.length})</h2>
      <div className="space-y-4 mb-8">
        {active.length === 0 && <p className="text-sm text-gray-400 py-4">No routes yet — create one above.</p>}
        {active.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="font-extrabold text-[#0D2240]">{r.name}</h3>
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full uppercase">Active</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {r.recurrence === "both" ? "Weekly & Bi-weekly" : r.recurrence === "biweekly" ? "Bi-weekly" : "Weekly"}
                  </span>
                  <span className="text-[10px] text-[#0D2240] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                    {r.turnaround_days}d turnaround
                  </span>
                  {r.recurrence === "biweekly" && r.biweekly_start_date && (
                    <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                      starting {new Date(r.biweekly_start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>

                {/* Service areas */}
                {r.service_areas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(r.service_areas as string[]).map((area) => (
                      <span key={area} className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{area}</span>
                    ))}
                  </div>
                )}

                {/* Pickup / Delivery days */}
                <div className="flex gap-6 text-xs text-gray-500 mb-1">
                  <div>
                    <span className="font-bold text-[#E8726A] mr-1">↑ Pickup:</span>
                    {(r.pickup_days as string[] ?? []).map(d => DAY_ABBR[d] ?? d).join(", ") || "—"}
                  </div>
                  <div>
                    <span className="font-bold text-[#0D2240] mr-1">↓ Delivery:</span>
                    {(r.delivery_days as string[] ?? []).map(d => DAY_ABBR[d] ?? d).join(", ") || "—"}
                  </div>
                </div>
                {r.notes && <p className="text-xs text-gray-400 italic">{r.notes}</p>}

                {/* Inline route editor */}
                <RouteEditor route={r as Route & { service_areas?: string[]; notes?: string }} onSave={updateRoute} />

                {/* Time windows editor */}
                <RouteTimeWindowEditor routeId={r.id} initialWindows={r.time_windows ?? []} />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <form action={toggleRoute.bind(null, r.id, false)}>
                  <button className="w-full text-[10px] font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors uppercase">
                    Deactivate
                  </button>
                </form>
                <form action={deleteRoute.bind(null, r.id)}>
                  <button className="w-full text-[10px] font-bold text-red-400 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors uppercase">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Inactive routes ── */}
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
