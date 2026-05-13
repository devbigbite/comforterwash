"use client"

import { useState, useTransition } from "react"
import type { Route } from "@/lib/route-availability"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DAY_ABBR: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
}

interface Facility { id: string; name: string }
interface StorageSpace { id: string; name: string; facility_id: string; address: string | null; unit: string | null }

interface Props {
  route: Route & { service_areas?: string[]; notes?: string }
  onSave: (id: string, data: FormData) => Promise<void>
  facilities?: Facility[]
  storageSpaces?: StorageSpace[]
}

export function RouteEditor({ route, onSave, facilities = [], storageSpaces = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Local state mirroring the route fields
  const [name, setName] = useState(route.name)
  const [recurrence, setRecurrence] = useState(route.recurrence)
  const [turnaround, setTurnaround] = useState(String(route.turnaround_days ?? 3))
  const [biweeklyDate, setBiweeklyDate] = useState(route.biweekly_start_date ?? "")
  const [serviceAreas, setServiceAreas] = useState((route.service_areas ?? []).join(", "))
  const [pickupDays, setPickupDays] = useState<string[]>(route.pickup_days ?? [])
  const [deliveryDays, setDeliveryDays] = useState<string[]>(route.delivery_days ?? [])
  const [notes, setNotes] = useState((route as { notes?: string }).notes ?? "")
  const [facilityId, setFacilityId] = useState((route as { facility_id?: string | null }).facility_id ?? "")
  const [defaultStorageId, setDefaultStorageId] = useState((route as { default_storage_space_id?: string | null }).default_storage_space_id ?? "")

  // Storage spaces filtered to the selected facility
  const filteredStorage = facilityId
    ? storageSpaces.filter(s => s.facility_id === facilityId)
    : storageSpaces

  function toggleDay(day: string, type: "pickup" | "delivery") {
    const id = day.toLowerCase()
    if (type === "pickup") {
      setPickupDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
    } else {
      setDeliveryDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
    }
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append("name", name)
      fd.append("recurrence", recurrence)
      fd.append("turnaround_days", turnaround)
      fd.append("biweekly_start_date", biweeklyDate)
      fd.append("service_areas", serviceAreas)
      fd.append("notes", notes)
      pickupDays.forEach(d => fd.append("pickup_days", d))
      deliveryDays.forEach(d => fd.append("delivery_days", d))
      fd.append("facility_id", facilityId)
      fd.append("default_storage_space_id", defaultStorageId)
      await onSave(route.id, fd)
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-bold text-[#0D2240] border border-[#0D2240]/20 bg-white px-3 py-1.5 rounded-lg hover:bg-[#f7f8fb] transition-colors uppercase tracking-wide"
      >
        Edit
      </button>
    )
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
      <p className="text-[10px] font-bold text-[#0D2240] uppercase tracking-wide">Edit Route</p>

      {/* Name + Recurrence */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Route Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Recurrence</label>
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as Route["recurrence"])}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]">
            <option value="both">Weekly & Bi-weekly</option>
            <option value="weekly">Weekly only</option>
            <option value="biweekly">Bi-weekly only</option>
          </select>
        </div>
      </div>

      {/* Turnaround + Biweekly date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Turnaround Days</label>
          <input type="number" min="1" max="14" value={turnaround} onChange={e => setTurnaround(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
            Biweekly Reference Date
          </label>
          <input type="date" value={biweeklyDate} onChange={e => setBiweeklyDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
        </div>
      </div>

      {/* Service areas */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Service Areas (comma-separated)</label>
        <input value={serviceAreas} onChange={e => setServiceAreas(e.target.value)}
          placeholder="32801, 32803, Downtown Orlando"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]" />
      </div>

      {/* Pickup + Delivery days */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="text-[10px] font-bold text-[#E8726A] uppercase tracking-wide block mb-2">↑ Pickup Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(d => {
              const id = d.toLowerCase()
              const active = pickupDays.includes(id)
              return (
                <button key={id} type="button" onClick={() => toggleDay(d, "pickup")}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border-2 transition-all ${
                    active ? "bg-[#E8726A] border-[#E8726A] text-white" : "bg-white border-gray-200 text-gray-400 hover:border-[#E8726A]"
                  }`}>
                  {DAY_ABBR[id]}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#0D2240] uppercase tracking-wide block mb-2">↓ Delivery Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(d => {
              const id = d.toLowerCase()
              const active = deliveryDays.includes(id)
              return (
                <button key={id} type="button" onClick={() => toggleDay(d, "delivery")}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border-2 transition-all ${
                    active ? "bg-[#0D2240] border-[#0D2240] text-white" : "bg-white border-gray-200 text-gray-400 hover:border-[#0D2240]"
                  }`}>
                  {DAY_ABBR[id]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Home Facility + Default Storage */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Home Facility</label>
          <select value={facilityId} onChange={e => { setFacilityId(e.target.value); setDefaultStorageId("") }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]">
            <option value="">— None assigned —</option>
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Default Storage Space</label>
          <select value={defaultStorageId} onChange={e => setDefaultStorageId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A]"
            disabled={filteredStorage.length === 0}>
            <option value="">— None —</option>
  