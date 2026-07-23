"use client"

import { useState, useTransition } from "react"

interface Area {
  id: string
  zip_code: string
  city: string
  state: string | null
  notes: string | null
  public_blurb: string | null
  active: boolean
}

interface Props {
  area: Area
  toggleZip: (fd: FormData) => Promise<void>
  updateZip: (fd: FormData) => Promise<void>
  deleteZip: (fd: FormData) => Promise<void>
}

export default function EditZipRow({ area, toggleZip, updateZip, deleteZip }: Props) {
  const [editing, setEditing] = useState(false)
  const [city, setCity] = useState(area.city)
  const [notes, setNotes] = useState(area.notes ?? "")
  const [publicBlurb, setPublicBlurb] = useState(area.public_blurb ?? "")
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set("id", area.id)
    fd.set("zip_code", area.zip_code)
    fd.set("city", city)
    fd.set("notes", notes)
    fd.set("public_blurb", publicBlurb)
    startTransition(async () => {
      await updateZip(fd)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleToggle() {
    const fd = new FormData()
    fd.set("id", area.id)
    fd.set("active", String(area.active))
    startTransition(() => toggleZip(fd))
  }

  function handleDelete() {
    if (!confirm(`Remove ZIP ${area.zip_code}?`)) return
    const fd = new FormData()
    fd.set("id", area.id)
    startTransition(() => deleteZip(fd))
  }

  if (editing) {
    return (
      <tr className="bg-[#fdf6f3]/60">
        <td className="px-6 py-4 font-bold text-[#0D2240]">{area.zip_code}</td>
        <td className="px-6 py-3" colSpan={2}>
          <form onSubmit={handleSave} className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City"
                className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] focus:outline-none focus:ring-1 focus:ring-[#E8726A]/40"
              />
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notes (admin only)"
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] focus:outline-none focus:ring-1 focus:ring-[#E8726A]/40"
              />
            </div>
            <textarea
              value={publicBlurb}
              onChange={e => setPublicBlurb(e.target.value)}
              placeholder="Public blurb shown on this ZIP's SEO page — leave blank to use the auto-generated description"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#0D2240] focus:outline-none focus:ring-1 focus:ring-[#E8726A]/40 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[#0D2240] text-white font-bold text-xs px-3 py-1.5 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-gray-400 hover:text-[#0D2240] px-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </td>
        <td className="px-6 py-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
            area.active
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-gray-100 text-gray-400 border border-gray-200"
          }`}>
            {area.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-6 py-4" />
      </tr>
    )
  }

  return (
    <tr className="hover:bg-[#f7f8fb]/60 transition-colors">
      <td className="px-6 py-4 font-bold text-[#0D2240]">{area.zip_code}</td>
      <td className="px-6 py-4 text-gray-500">{area.city}{area.state ? `, ${area.state}` : ""}</td>
      <td className="px-6 py-4 text-gray-400 text-xs">{area.notes ?? "—"}</td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
          area.active
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-gray-100 text-gray-400 border border-gray-200"
        }`}>
          {saved ? "✓ Saved" : area.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3 justify-end">
          <a
            href={`/service-areas/${area.zip_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-[#0D2240] underline transition-colors"
          >
            View page
          </a>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-[#0D2240] underline transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className="text-xs text-gray-400 hover:text-[#0D2240] underline transition-colors disabled:opacity-40"
          >
            {area.active ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-[#E8726A] hover:text-[#d45f57] underline transition-colors disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  )
}
