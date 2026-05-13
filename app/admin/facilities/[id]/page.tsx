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

          {/* Existing spaces */}
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
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 