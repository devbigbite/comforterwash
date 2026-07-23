import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import DeleteZipButton from "./delete-button"
import EditZipRow from "./edit-zip-row"

async function addZip(formData: FormData) {
  "use server"
  await requireAdmin()
  const zip = (formData.get("zip") as string)?.trim()
  const city = (formData.get("city") as string)?.trim() || "Orlando"
  const notes = (formData.get("notes") as string)?.trim() || null
  if (!zip || zip.length !== 5) return
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("service_areas").upsert(
    { zip_code: zip, city, notes, active: true, location_id: locationId },
    { onConflict: "location_id,zip_code" }
  )
  revalidatePath("/admin/zip-codes")
}

async function toggleZip(formData: FormData) {
  "use server"
  await requireAdmin()
  const id = formData.get("id") as string
  const active = formData.get("active") === "true"
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("service_areas").update({ active: !active }).eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/zip-codes")
}

async function deleteZip(formData: FormData) {
  "use server"
  await requireAdmin()
  const id = formData.get("id") as string
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("service_areas").delete().eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/zip-codes")
}

async function updateZip(formData: FormData) {
  "use server"
  await requireAdmin()
  const id = formData.get("id") as string
  const city = (formData.get("city") as string)?.trim() || "Orlando"
  const notes = (formData.get("notes") as string)?.trim() || null
  const publicBlurb = (formData.get("public_blurb") as string)?.trim() || null
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  await supabase.from("service_areas").update({ city, notes, public_blurb: publicBlurb }).eq("id", id).eq("location_id", locationId)
  revalidatePath("/admin/zip-codes")
  revalidatePath(`/service-areas/${(formData.get("zip_code") as string) ?? ""}`)
}

export default async function ZipCodesPage() {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: areas } = await supabase
    .from("service_areas")
    .select("*")
    .eq("location_id", locationId)
    .order("zip_code", { ascending: true })

  const activeCount = areas?.filter((a) => a.active).length ?? 0

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Service Areas</h1>
            <p className="text-sm text-gray-400 mt-1">
              {activeCount} active ZIP code{activeCount !== 1 ? "s" : ""} · Notes are admin-only
            </p>
          </div>
          <a href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
            ← Back to Dashboard
          </a>
        </div>

        {/* Map editor link */}
        <a
          href="/admin/service-area"
          className="flex items-center justify-between bg-[#0D2240] hover:bg-[#1a3a5c] text-white rounded-2xl px-6 py-4 mb-6 transition-colors group"
        >
          <div>
            <p className="font-extrabold text-sm">Service Area Map Editor</p>
            <p className="text-white/50 text-xs mt-0.5">Draw the delivery zone customers see on the Service Areas page</p>
          </div>
          <span className="text-white/40 group-hover:text-white text-lg transition-colors">→</span>
        </a>

        {/* Add ZIP form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-bold text-[#0D2240] mb-4">Add ZIP Code</h2>
          <form action={addZip} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ZIP Code *</label>
              <input
                name="zip"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="32827"
                required
                className="w-28 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">City</label>
              <input
                name="city"
                type="text"
                defaultValue="Orlando"
                className="w-36 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes (admin only)</label>
              <input
                name="notes"
                type="text"
                placeholder="Optional note"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#E8726A] text-white font-bold text-sm px-5 py-2.5 hover:bg-[#d45f57] transition-colors"
            >
              Add ZIP
            </button>
          </form>
        </div>

        {/* ZIP code list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {!areas || areas.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No ZIP codes added yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f7f8fb]">
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">ZIP</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">City</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Notes</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {areas.map((area) => (
                  <EditZipRow
                    key={area.id}
                    area={area}
                    toggleZip={toggleZip}
                    updateZip={updateZip}
                    deleteZip={deleteZip}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
