import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import Link from "next/link"

async function addFacility(formData: FormData) {
  "use server"
  const name = (formData.get("name") as string)?.trim()
  const address = (formData.get("address") as string)?.trim() || null
  if (!name) return
  const supabase = createAdminClient()
  await supabase.from("facilities").insert({ name, address })
  revalidatePath("/admin/facilities")
}

async function toggleFacility(formData: FormData) {
  "use server"
  const id = formData.get("id") as string
  const active = formData.get("active") === "true"
  const supabase = createAdminClient()
  await supabase.from("facilities").update({ active: !active }).eq("id", id)
  revalidatePath("/admin/facilities")
}

export default async function FacilitiesPage() {
  const supabase = createAdminClient()
  const { data: facilities } = await supabase
    .from("facilities")
    .select("*, machine_groups(count)")
    .order("name")

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">Laundromat Facilities</h1>
            <p className="text-sm text-gray-400 mt-1">{facilities?.filter(f => f.active).length ?? 0} active locations</p>
          </div>
          <a href="/admin" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">← Admin</a>
        </div>

        {/* Add facility */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-bold text-[#0D2240] mb-4">Add Facility</h2>
          <form action={addFacility} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Facility Name *</label>
              <input name="name" type="text" placeholder="Sunshine Laundry" required
                className="w-52 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Address</label>
              <input name="address" type="text" placeholder="123 Main St, Orlando FL"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
            <button type="submit"
              className="rounded-xl bg-[#E8726A] text-white font-bold text-sm px-5 py-2.5 hover:bg-[#d45f57] transition-colors">
              Add
            </button>
          </form>
        </div>

        {/* Facilities list */}
        <div className="space-y-3">
          {!facilities || facilities.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm border border-gray-100">
              No facilities yet. Add your first laundromat above.
            </div>
          ) : facilities.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#f7f8fb] border border-gray-100 flex items-center justify-center text-2xl shrink-0">
                🏭
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#0D2240] truncate">{f.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    f.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-400"
                  }`}>
                    {f.active ? "Active" : "Inactive"}
                  </span>
                </div>
                {f.address && <p className="text-sm text-gray-400 truncate mt-0.5">{f.address}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link href={`/admin/facilities/${f.id}`}
                  className="rounded-xl bg-[#0D2240] text-white font-bold text-xs px-4 py-2 hover:bg-[#1a3a5c] transition-colors">
                  Manage Machines
                </Link>
                <form action={toggleFacility}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="active" value={String(f.active)} />
                  <button type="submit" className="text-xs text-gray-400 hover:text-[#0D2240] underline transition-colors">
                    {f.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
