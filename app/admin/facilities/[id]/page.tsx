import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { notFound } from "next/navigation"
import DeleteGroupButton from "./delete-group-button"
import {
  addStorageSpace, updateStorageSpace,
  toggleStorageSpaceActive, deleteStorageSpace,
  type StorageSpace,
} from "@/app/actions/storage-spaces"

async function addGroup(formData: FormData) {
  "use server"
  const facilityId = formData.get("facilityId") as string
  const name = (formData.get("name") as string)?.trim()
  const type = formData.get("type") as string
  const capacityLbs = parseFloat(formData.get("capacity") as string) || null
  const startupCostCents = Math.round(parseFloat(formData.get("startup_cost") as string) * 100) || null
  if (!name || !type) return
  const supabase = createAdminClient()
  await supabase.from("machine_groups").insert({
    facility_id: facilityId, name, type, capacity_lbs: capacityLbs, startup_cost_cents: startupCostCents
  })
  revalidatePath(`/admin/facilities/${facilityId}`)
}

async function addMachine(formData: FormData) {
  "use server"
  const groupId = formData.get("groupId") as string
  const facilityId = formData.get("facilityId") as string
  const name = (formData.get("name") as string)?.trim()
  if (!name) return
  const supabase = createAdminClient()
  await supabase.from("machines").insert({ machine_group_id: groupId, name })
  revalidatePath(`/admin/facilities/${facilityId}`)
}

async function toggleMachine(formData: FormData) {
  "use server"
  const machineId = formData.get("machineId") as string
  const facilityId = formData.get("facilityId") as string
  const currentStatus = formData.get("status") as string
  const newStatus = currentStatus === "active" ? "inactive" : "active"
  const supabase = createAdminClient()
  await supabase.from("machines").update({ status: newStatus }).eq("id", machineId)
  revalidatePath(`/admin/facilities/${facilityId}`)
}

async function deleteMachine(formData: FormData) {
  "use server"
  const machineId = formData.get("machineId") as string
  const facilityId = formData.get("facilityId") as string
  const supabase = createAdminClient()
  await supabase.from("machines").delete().eq("id", machineId)
  revalidatePath(`/admin/facilities/${facilityId}`)
}

async function deleteGroup(formData: FormData) {
  "use server"
  const groupId = formData.get("groupId") as string
  const facilityId = formData.get("facilityId") as string
  const supabase = createAdminClient()
  await supabase.from("machine_groups").delete().eq("id", groupId)
  revalidatePath(`/admin/facilities/${facilityId}`)
}

export default async function FacilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: facility } = await supabase.from("facilities").select("*").eq("id", id).single()
  if (!facility) notFound()

  const [{ data: groups }, { data: storageSpacesRaw }] = await Promise.all([
    supabase.from("machine_groups").select("*, machines(*)").eq("facility_id", id).order("type").order("name"),
    supabase.from("storage_spaces").select("*").eq("facility_id", id).order("active", { ascending: false }).order("name"),
  ])
  const storageSpaces: StorageSpace[] = (storageSpacesRaw ?? []) as StorageSpace[]

  const washers = groups?.filter(g => g.type === "washer") ?? []
  const dryers = groups?.filter(g => g.type === "dryer") ?? []

  const totalMachines = groups?.reduce((sum, g) => sum + (g.machines?.length ?? 0), 0) ?? 0

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0D2240]">{facility.name}</h1>
            {facility.address && <p className="text-sm text-gray-400 mt-0.5">{facility.address}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {groups?.length ?? 0} machine group{groups?.length !== 1 ? "s" : ""} · {totalMachines} individual machine{totalMachines !== 1 ? "s" : ""}
            </p>
          </div>
          <a href="/admin/facilities" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">← Facilities</a>
        </div>

        {/* ── Storage Spaces ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-[#0D2240]">📦 Storage Spaces</h2>
            <span className="text-xs text-gray-400">{storageSpaces.length} space{storageSpaces.length !== 1 ? "s" : ""}</span>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Storage spaces are the staging hub for this facility — orders wait here before transfer in and after transfer out.
            Multiple spaces can share an address (different units) or be at separate locations.
          </p>

          {storageSpaces.length > 0 && (
            <div className="space-y-3 mb-6">
              {storageSpaces.map(s => (
                <details key={s.id} className={`rounded-xl border-2 ${s.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                    <span className="text-base">📦</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-[#0D2240] text-sm">{s.name}</span>
                      {(s.address || s.unit) && (
                        <span className="text-xs text-gray-400 ml-2">
                          {[s.unit, s.address, s.city].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.capacity_bags && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">
                          {s.capacity_bags} bags cap.
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {s.active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-gray-300 text-xs">▾</span>
                    </div>
                  </summary>
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <form action={updateStorageSpace} className="space-y-3">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="facility_id" value={id} />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Name / Label *</label>
                          <input name="name" defaultValue={s.name} required
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Unit / Suite</label>
                          <input name="unit" defaultValue={s.unit ?? ""}
                            placeholder="Unit 113"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Street Address</label>
                        <input name="address" defaultValue={s.address ?? ""}
                          placeholder="500 Curry Ford Rd"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">City</label>
                          <input name="city" defaultValue={s.city ?? ""} placeholder="Orlando"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">State</label>
                          <input name="state" defaultValue={s.state ?? "FL"}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Zip</label>
                          <input name="zip" defaultValue={s.zip ?? ""}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Capacity (bags)</label>
                          <input name="capacity_bags" type="number" defaultValue={s.capacity_bags ?? ""}
                            placeholder="e.g. 200"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Sq Ft</label>
                          <input name="sq_ft" type="number" defaultValue={s.sq_ft ?? ""}
                            placeholder="e.g. 400"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Notes</label>
                        <input name="notes" defaultValue={s.notes ?? ""}
                          placeholder="Access hours, gate code, contact…"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit"
                          className="flex-1 text-xs font-bold text-white bg-[#0D2240] hover:bg-[#1a3a5c] px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
                          Save Changes
                        </button>
                        <form action={toggleStorageSpaceActive}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="facility_id" value={id} />
                          <button type="submit"
                            className="text-xs font-bold text-gray-500 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-wide">
                            {s.active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        <form action={deleteStorageSpace}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="facility_id" value={id} />
                          <button type="submit"
                            className="text-xs font-bold text-red-400 border border-red-200 bg-white px-3 py-2 rounded-xl hover:bg-red-50 transition-colors uppercase tracking-wide">
                            Delete
                          </button>
                        </form>
                      </div>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}

          <details className="rounded-xl border-2 border-dashed border-gray-200">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none text-gray-500 hover:text-[#0D2240] transition-colors">
              <span className="text-base">+</span>
              <span className="text-sm font-bold">Add Storage Space</span>
            </summary>
            <div className="px-4 pb-4 border-t border-gray-100 pt-4">
              <form action={addStorageSpace} className="space-y-3">
                <input type="hidden" name="facility_id" value={id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Name / Label *</label>
                    <input name="name" required placeholder="Unit 113 Storage"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Unit / Suite</label>
                    <input name="unit" placeholder="Unit 113"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Street Address</label>
                  <input name="address" placeholder="500 Curry Ford Rd"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">City</label>
                    <input name="city" placeholder="Orlando"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">State</label>
                    <input name="state" defaultValue="FL"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Zip</label>
                    <input name="zip"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Capacity (bags)</label>
                    <input name="capacity_bags" type="number" placeholder="e.g. 200"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Sq Ft</label>
                    <input name="sq_ft" type="number" placeholder="e.g. 400"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Notes</label>
                  <input name="notes" placeholder="Access hours, gate code, contact…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                </div>
                <button type="submit"
                  className="w-full text-xs font-bold text-white bg-[#E8726A] hover:bg-[#d45f57] px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
                  Add Storage Space
                </button>
              </form>
            </div>
          </details>
        </div>

        {/* Add Machine Group */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="font-bold text-[#0D2240] mb-1">Add Machine Group</h2>
          <p className="text-xs text-gray-400 mb-4">A group represents a model/size (e.g., "Washer T450 – 30LB"). Individual machines go inside.</p>
          <form action={addGroup} className="flex flex-wrap gap-3 items-end">
            <input type="hidden" name="facilityId" value={id} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Name *</label>
              <input name="name" type="text" placeholder="Washer T450 – 30LB" required
                className="w-48 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Type *</label>
              <select name="type" required
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30">
                <option value="washer">Washer</option>
                <option value="dryer">Dryer</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Capacity (lbs)</label>
              <input name="capacity" type="number" step="1" placeholder="30"
                className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Startup Cost ($)</label>
              <input name="startup_cost" type="number" step="0.25" placeholder="6.00"
                className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
            </div>
            <button type="submit"
              className="rounded-xl bg-[#E8726A] text-white font-bold text-sm px-5 py-2.5 hover:bg-[#d45f57] transition-colors">
              Add Group
            </button>
          </form>
        </div>

        {/* Machine groups by type */}
        {[{ label: "🫧 Washers", groups: washers }, { label: "🌀 Dryers", groups: dryers }].map(({ label, groups: typeGroups }) => (
          <div key={label} className="mb-8">
            <h2 className="font-extrabold text-[#0D2240] text-lg mb-4">{label}</h2>
            {typeGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-gray-400 text-center">
                No {label.toLowerCase()} groups yet.
              </div>
            ) : (
              <div className="space-y-4">
                {typeGroups.map((group) => (
                  <div key={group.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 bg-[#f7f8fb]">
                      <div className="flex-1">
                        <h3 className="font-bold text-[#0D2240]">{group.name}</h3>
                        <div className="flex gap-4 mt-0.5 text-xs text-gray-400">
                          {group.capacity_lbs && <span>Capacity: {group.capacity_lbs} lbs</span>}
                          {group.startup_cost_cents && <span>Startup: ${(group.startup_cost_cents / 100).toFixed(2)}</span>}
                          <span>{group.machines?.length ?? 0} machine{group.machines?.length !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <DeleteGroupButton
                        groupName={group.name}
                        groupId={group.id}
                        facilityId={id}
                        action={deleteGroup}
                      />
                    </div>

                    {/* Individual machines */}
                    <div className="p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                        {group.machines?.map((m: { id: string; name: string; status: string }) => (
                          <div key={m.id} className={`rounded-xl border-2 p-3 flex flex-col gap-2 ${
                            m.status === "active" ? "border-green-200 bg-green-50" :
                            m.status === "maintenance" ? "border-amber-200 bg-amber-50" :
                            "border-gray-200 bg-gray-50"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#0D2240] text-sm">{m.name}</span>
                              <form action={deleteMachine}>
                                <input type="hidden" name="machineId" value={m.id} />
                                <input type="hidden" name="facilityId" value={id} />
                                <button type="submit" className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                              </form>
                            </div>
                            <form action={toggleMachine}>
                              <input type="hidden" name="machineId" value={m.id} />
                              <input type="hidden" name="facilityId" value={id} />
                              <input type="hidden" name="status" value={m.status} />
                              <button type="submit"
                                className={`w-full text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition-colors ${
                                  m.status === "active"
                                    ? "bg-green-500 text-white hover:bg-green-600"
                                    : "bg-gray-300 text-gray-600 hover:bg-gray-400"
                                }`}>
                                {m.status}
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>

                      {/* Add machine to group */}
                      <form action={addMachine} className="flex gap-2">
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="facilityId" value={id} />
                        <input name="name" type="text" placeholder={`e.g. W${(group.machines?.length ?? 0) + 1}`}
                          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30" />
                        <button type="submit"
                          className="rounded-xl bg-[#0D2240] text-white font-bold text-xs px-4 py-2 hover:bg-[#1a3a5c] transition-colors">
                          + Add Machine
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
