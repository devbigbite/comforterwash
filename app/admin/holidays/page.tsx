import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { PlatformHoursEditor } from "@/components/admin/platform-hours-editor"
import { todayET } from "@/lib/date-et"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

async function addHoliday(formData: FormData) {
  "use server"
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("holiday_exclusions").insert({
    date: formData.get("date") as string,
    name: formData.get("name") as string,
    location_id: locationId,
  })
  revalidatePath("/admin/holidays")
}

async function addDateRange(formData: FormData) {
  "use server"
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const dateFrom = formData.get("date_from") as string
  const dateTo = formData.get("date_to") as string
  const name = formData.get("name") as string
  if (!dateFrom || !name) return
  // If no date_to or same as from, treat as single day
  const isRange = dateTo && dateTo !== dateFrom
  await supabase.from("holiday_exclusions").insert({
    date: dateFrom,
    date_to: isRange ? dateTo : null,
    name,
    location_id: locationId,
  })
  revalidatePath("/admin/holidays")
}

async function removeHoliday(id: string) {
  "use server"
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("holiday_exclusions").delete().eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/holidays")
}

const PRESET_HOLIDAYS = [
  { date: "2026-05-25", name: "Memorial Day 2026" },
  { date: "2026-07-04", name: "Independence Day 2026" },
  { date: "2026-09-07", name: "Labor Day 2026" },
  { date: "2026-11-26", name: "Thanksgiving Day 2026" },
  { date: "2026-12-25", name: "Christmas Day 2026" },
  { date: "2027-01-01", name: "New Year's Day 2027" },
]

function fmt(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  })
}

export default async function HolidaysPage() {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: exclusionsData, error: exclusionsError } = await supabase
    .from("holiday_exclusions")
    .select("*")
    .eq("location_id", locationId)
    .order("date", { ascending: true })
  if (exclusionsError) console.error("[admin/holidays] Failed to load exclusions:", exclusionsError.message)
  const exclusions = exclusionsData ?? []

  // Load saved platform hours from settings
  const { data: hoursSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "platform_hours")
    .eq("location_id", locationId)
    .single()

  let savedHours = null
  try { savedHours = hoursSetting?.value ? JSON.parse(hoursSetting.value) : null } catch { /* ignore */ }

  const existingDates = new Set(exclusions.map(e => e.date))
  const today = todayET()
  const upcoming = exclusions.filter(e => e.date >= today)
  const past = exclusions.filter(e => e.date < today)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Schedule & Availability</h1>
        <p className="text-sm text-gray-400 mt-1">Control blocked dates and platform operating hours.</p>
      </div>

      {/* ── Platform Hours ──────────────────────────────────────────────── */}
      <PlatformHoursEditor initialHours={savedHours} />

      {/* ── Quick-add Holidays ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-4">Quick-add Holidays</h2>
        <div className="flex flex-wrap gap-2">
          {PRESET_HOLIDAYS.map((h) => {
            const already = existingDates.has(h.date)
            return (
              <form key={h.date} action={addHoliday}>
                <input type="hidden" name="date" value={h.date} />
                <input type="hidden" name="name" value={h.name} />
                <button type="submit" disabled={already}
                  className={`text-xs font-bold px-4 py-2 rounded-full border transition-all ${
                    already
                      ? "bg-green-100 border-green-200 text-green-700 cursor-default"
                      : "bg-white border-gray-200 text-[#0D2240] hover:border-[#E8726A] hover:text-[#E8726A]"
                  }`}>
                  {already ? "✓ " : "+ "}{h.name}
                </button>
              </form>
            )
          })}
        </div>
      </div>

      {/* ── Block Date Range ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-1">Block Date Range</h2>
        <p className="text-xs text-gray-400 mb-4">Block a span of days — vacation, closure, off-season, etc.</p>
        <form action={addDateRange} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">From</label>
            <input type="date" name="date_from" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">To</label>
            <input type="date" name="date_to"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>
          <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Label</label>
            <input type="text" name="name" required placeholder="e.g. Summer Break"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button type="submit"
              className="w-full bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold px-5 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors">
              Block Range
            </button>
          </div>
        </form>
      </div>

      {/* ── Add Custom Single Date ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-1">Block Single Date</h2>
        <p className="text-xs text-gray-400 mb-4">Block one specific day from the booking calendar.</p>
        <form action={addHoliday} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Date</label>
            <input type="date" name="date" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>
          <div className="flex-[2]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Label</label>
            <input type="text" name="name" required placeholder="e.g. Company Closure"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
          </div>
          <button type="submit"
            className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold px-5 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors">
            Add
          </button>
        </form>
      </div>

      {/* ── Upcoming Blocked Dates ──────────────────────────────────────── */}
      <div>
        <h2 className="font-extrabold text-[#0D2240] text-sm uppercase tracking-wide mb-3">
          Upcoming Blocked ({upcoming.length})
        </h2>
        <div className="space-y-2">
          {upcoming.length === 0 && (
            <p className="text-sm text-gray-400 py-4">No upcoming blocked dates.</p>
          )}
          {upcoming.map((e) => {
            const isRange = !!e.date_to
            return (
              <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${isRange ? "bg-amber-50" : "bg-[#fdf6f3]"}`}>
                    {isRange ? (
                      <span className="text-lg font-extrabold text-amber-500">⋯</span>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold text-[#E8726A] uppercase">
                          {new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-lg font-extrabold text-[#0D2240] leading-tight">
                          {new Date(e.date + "T12:00:00").getDate()}
                        </span>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#0D2240] text-sm">{e.name}</p>
                    <p className="text-xs text-gray-400">
                      {isRange ? `${fmt(e.date)} → ${fmt(e.date_to)}` : fmt(e.date)}
                    </p>
                    {isRange && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full mt-1 inline-block">
                        Range block
                      </span>
                    )}
                  </div>
                </div>
                <form action={removeHoliday.bind(null, e.id)}>
                  <button type="submit"
                    className="text-xs text-red-400 hover:text-red-600 font-bold border border-red-100 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide">
                    Remove
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Past Exclusions ─────────────────────────────────────────────── */}
      {past.length > 0 && (
        <div>
          <h2 className="font-extrabold text-gray-400 text-sm uppercase tracking-wide mb-3">Past ({past.length})</h2>
          <div className="space-y-2 opacity-50">
            {past.slice(-5).reverse().map((e) => (
              <div key={e.id} className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-mono">{e.date}{e.date_to ? ` → ${e.date_to}` : ""}</span>
                  <span className="text-sm text-gray-500 line-through">{e.name}</span>
                </div>
                <form action={removeHoliday.bind(null, e.id)}>
                  <button type="submit" className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase tracking-wide transition-colors">
                    Delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
