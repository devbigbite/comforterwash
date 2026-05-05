import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { notFound } from "next/navigation"
import DeleteGroupButton from "./delete-group-button"

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

  const { data: groups } = await supabase
    .from("machine_groups")
    .select("*, machines(*)")
    .eq("facility_id", id)
    .order("type")
    .order("name")

  const washers = groups?.filter(g => g.type === "washer") ?? []
  const dryers = groups?.filter(g => g.type === "dryer") ?? []

  const totalMachines = groups?.reduce((sum, g) => sum + (g.machines?.length ?? 0), 0) ?? 0

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
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
