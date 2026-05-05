"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

async function addZip(formData: FormData) {
  "use server"
  const zip = (formData.get("zip") as string)?.trim()
  const city = (formData.get("city") as string)?.trim() || "Orlando"
  const notes = (formData.get("notes") as string)?.trim() || null
  if (!zip || zip.length !== 5) return
  const supabase = createAdminClient()
  await supabase.from("service_areas").upsert({ zip_code: zip, city, notes, active: true }, { onConflict: "zip_code" })
  revalidatePath("/admin/zip-codes")
}

async function toggleZip(formData: FormData) {
  "use server"
  const id = formData.get("id") as string
  const active = formData.get("active") === "true"
  const supabase = createAdminClient()
  await supabase.from("service_areas").update({ active: !active }).eq("id", id)
  revalidatePath("/admin/zip-codes")
}

async function deleteZip(formData: FormData) {
  "use server"
  const id = formData.get("id") as string
  const supabase = createAdminClient()
  await supabase.from("service_areas").delete().eq("id", id)
  revalidatePath("/admin/zip-codes")
}

export default async function ZipCodesPage() {
  const supabase = createAdminClient()
  const { data: areas } = await supabase
    .from("service_areas")
    .select("*")
    .order("zip_code", { ascending: true })

  const activeCount = areas?.filter((a) => a.active).length ?? 0

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Service Areas</h1>
            <p className="text-sm text-gray-400 mt-1">
              {activeCount} active ZIP code{activeCount !== 1 ? "s" : ""}
            </p>
          </div>
          <a
            href="/admin"
            className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>

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
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</label>
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
                  <tr key={area.id} className="hover:bg-[#f7f8fb]/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#0D2240]">{area.zip_code}</td>
                    <td className="px-6 py-4 text-gray-500">{area.city}, {area.state}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">{area.notes ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                          area.active
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-400 border border-gray-200"
                        }`}
                      >
                        {area.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <form action={toggleZip}>
                          <input type="hidden" name="id" value={area.id} />
                          <input type="hidden" name="active" value={String(area.active)} />
                          <button
                            type="submit"
                            className="text-xs text-gray-400 hover:text-[#0D2240] underline transition-colors"
                          >
                            {area.active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        <form action={deleteZip}>
                          <input type="hidden" name="id" value={area.id} />
                          <button
                            type="submit"
                            className="text-xs text-[#E8726A] hover:text-[#d45f57] underline transition-colors"
                            onClick={(e) => {
                              if (!confirm(`Remove ZIP ${area.zip_code}?`)) e.preventDefault()
                            }}
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
