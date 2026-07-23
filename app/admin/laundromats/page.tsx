"use client"

import { useEffect, useState } from "react"
import { getMyLaundromats, addLaundromat, updateLaundromat, removeLaundromat, type Laundromat } from "@/app/actions/laundromats"

const FIELD_CLS = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#0D2240]/20 bg-white"

export default function LaundromatsPage() {
  const [list, setList] = useState<Laundromat[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function load() {
    setList(await getMyLaundromats())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function resetForm() {
    setName(""); setAddress(""); setPhone(""); setAdding(false); setEditingId(null); setError("")
  }

  function startEdit(l: Laundromat) {
    setEditingId(l.id); setName(l.name); setAddress(l.address ?? ""); setPhone(l.phone ?? ""); setAdding(true); setError("")
  }

  async function save() {
    if (!name.trim()) { setError("Name is required"); return }
    const result = editingId
      ? await updateLaundromat(editingId, name, address, phone)
      : await addLaundromat(name, address, phone)
    if (result.error) { setError(result.error); return }
    resetForm()
    load()
  }

  async function remove(id: string) {
    await removeLaundromat(id)
    load()
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0D2240]">My Laundromats</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          A short list of laundromats you sometimes drive to for large orders or comforters that don't fit your home machine.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {list.map(l => (
            <div key={l.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[#0D2240] text-sm">{l.name}</p>
                {l.address && <p className="text-xs text-gray-400 mt-0.5">{l.address}</p>}
                {l.phone && <p className="text-xs text-gray-400">{l.phone}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => startEdit(l)} className="text-xs font-semibold text-[#0D2240] hover:text-[#E8726A]">Edit</button>
                <button onClick={() => remove(l.id)} className="text-xs font-semibold text-red-400 hover:text-red-600">Remove</button>
              </div>
            </div>
          ))}

          {list.length === 0 && !adding && (
            <p className="text-sm text-gray-400 italic py-4">No laundromats saved yet.</p>
          )}
        </div>
      )}

      {adding ? (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide">{editingId ? "Edit Laundromat" : "Add Laundromat"}</p>
          <input placeholder="Name (e.g. Sunshine Coin Laundry)" value={name} onChange={e => setName(e.target.value)} className={FIELD_CLS} />
          <input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} className={FIELD_CLS} />
          <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className={FIELD_CLS} />
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 text-xs font-bold text-gray-500 border border-gray-200 bg-white px-4 py-2 rounded-xl hover:bg-gray-50 uppercase tracking-wide">Cancel</button>
            <button onClick={save} className="flex-[2] text-xs font-bold text-white bg-[#E8726A] hover:bg-[#d45f57] px-4 py-2 rounded-xl uppercase tracking-wide">Save</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 text-xs font-bold text-[#E8726A] border border-[#E8726A] px-4 py-2 rounded-xl hover:bg-[#fdf6f3] transition-colors uppercase tracking-wide"
        >
          + Add Laundromat
        </button>
      )}
    </div>
  )
}
