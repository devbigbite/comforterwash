import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import Link from "next/link"
import { FacilityAccessWindowsEditor, type AccessWindow } from "@/components/admin/FacilityAccessWindowsEditor"
import { PartnerLinkCopy } from "@/components/admin/PartnerLinkCopy"

// ── shared field CSS ─────────────────────────────────────────────────────────
const inp = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white w-full"

// ── server actions ───────────────────────────────────────────────────────────

async function addFacility(formData: FormData) {
  "use server"
  const name = (formData.get("name") as string)?.trim()
  if (!name) return

  const supports_own_operator      = formData.get("supports_own_operator") === "on"
  const supports_partner_attendant = formData.get("supports_partner_attendant") === "on"
  if (!supports_own_operator && !supports_partner_attendant) return

  const supabase = createAdminClient()
  const code = Math.random().toString(36).slice(2, 12)

  const hasLimit = formData.get("has_processing_limit") === "on"

  await supabase.from("facilities").insert({
    name,
    address:                  (formData.get("address") as string)?.trim() || null,
    phone:                    (formData.get("phone") as string)?.trim() || null,
    contact_email:            (formData.get("contact_email") as string)?.trim() || null,
    manager:                  (formData.get("manager") as string)?.trim() || null,
    owner:                    (formData.get("owner") as string)?.trim() || null,
    hours_open:               (formData.get("hours_open") as string)?.trim() || null,
    storage_level:            parseInt(formData.get("storage_level") as string) || null,
    has_processing_limit:     hasLimit,
    processing_limit_days:    hasLimit ? (parseInt(formData.get("processing_limit_days") as string) || null) : null,
    processing_limit_hours:   hasLimit ? (parseFloat(formData.get("processing_limit_hours") as string) || null) : null,
    supports_own_operator,
    supports_partner_attendant,
    rate_per_lb:   parseFloat(formData.get("rate_per_lb") as string) || null,
    minimum_lbs:   parseFloat(formData.get("minimum_lbs") as string) || 0,
    partner_access_code: code,
  })
  revalidatePath("/admin/facilities")
}

async function editFacility(formData: FormData) {
  "use server"
  const id   = formData.get("id") as string
  const name = (formData.get("name") as string)?.trim()
  if (!name || !id) return

  const hasLimit = formData.get("has_processing_limit") === "on"
  const supabase = createAdminClient()

  await supabase.from("facilities").update({
    name,
    address:                  (formData.get("address") as string)?.trim() || null,
    phone:                    (formData.get("phone") as string)?.trim() || null,
    contact_email:            (formData.get("contact_email") as string)?.trim() || null,
    manager:                  (formData.get("manager") as string)?.trim() || null,
    owner:                    (formData.get("owner") as string)?.trim() || null,
    hours_open:               (formData.get("hours_open") as string)?.trim() || null,
    storage_level:            parseInt(formData.get("storage_level") as string) || null,
    has_processing_limit:     hasLimit,
    processing_limit_days:    hasLimit ? (parseInt(formData.get("processing_limit_days") as string) || null) : null,
    processing_limit_hours:   hasLimit ? (parseFloat(formData.get("processing_limit_hours") as string) || null) : null,
    supports_own_operator:      formData.get("supports_own_operator") === "on",
    supports_partner_attendant: formData.get("supports_partner_attendant") === "on",
    rate_per_lb:   parseFloat(formData.get("rate_per_lb") as string) || null,
    minimum_lbs:   parseFloat(formData.get("minimum_lbs") as string) || 0,
  }).eq("id", id)
  revalidatePath("/admin/facilities")
}

async function toggleFacility(formData: FormData) {
  "use server"
  const id     = formData.get("id") as string
  const active = formData.get("active") === "true"
  const supabase = createAdminClient()
  await supabase.from("facilities").update({ active: !active }).eq("id", id)
  revalidatePath("/admin/facilities")
}

// ── shared form fields component (used for both Add and Edit) ────────────────

function FacilityFields({ f }: { f?: Record<string, unknown> }) {
  const val = (k: string) => (f ? String(f[k] ?? "") : "")
  const checked = (k: string) => f ? Boolean(f[k]) : false
  const storageVal = f?.storage_level ? String(f.storage_level) : ""

  return (
    <>
      {/* Row 1: Name, Phone, Email, Address */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Facility Name *</label>
          <input name="name" type="text" required placeholder="Sunshine Laundry"
            defaultValue={val("name")} className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</label>
          <input name="phone" type="tel" placeholder="(407) 555-0100"
            defaultValue={val("phone")} className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Contact Email
            <span className="ml-1 text-gray-300 normal-case font-normal">(arrival alerts)</span>
          </label>
          <input name="contact_email" type="email" placeholder="manager@facility.com"
            defaultValue={val("contact_email")} className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Address</label>
          <input name="address" type="text" placeholder="123 Main St, Orlando FL"
            defaultValue={val("address")} className={inp} />
        </div>
      </div>

      {/* Row 2: Owner, Manager, Working Hours */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Owner</label>
          <input name="owner" type="text" placeholder="Maria Rodriguez"
            defaultValue={val("owner")} className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Manager in Charge</label>
          <input name="manager" type="text" placeholder="Carlos Vega"
            defaultValue={val("manager")} className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Working Hours</label>
          <input name="hours_open" type="text" placeholder="7am – 10pm daily"
            defaultValue={val("hours_open")} className={inp} />
        </div>
      </div>

      {/* Row 3: Models, Rate, Min lbs, Storage, Processing limit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Models *</label>
          <div className="flex flex-col gap-1.5 py-1">
            <label className="flex items-center gap-2 text-sm text-[#0D2240] cursor-pointer">
              <input type="checkbox" name="supports_own_operator"
                defaultChecked={f ? checked("supports_own_operator") : true} className="rounded" />
              Own Operator
            </label>
            <label className="flex items-center gap-2 text-sm text-[#0D2240] cursor-pointer">
              <input type="checkbox" name="supports_partner_attendant"
                defaultChecked={checked("supports_partner_attendant")} className="rounded" />
              Partner Attendant
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate ($/lb) &amp; Min. lbs</label>
          <div className="flex gap-2">
            <input name="rate_per_lb" type="number" step="0.01" placeholder="1.20"
              defaultValue={val("rate_per_lb")}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white w-24" />
            <input name="minimum_lbs" type="number" step="1" placeholder="0"
              defaultValue={f ? String(f.minimum_lbs ?? 0) : "0"}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white w-20" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Storage Availability
            <span className="text-gray-300 ml-1 normal-case">(1 = low, 3 = high)</span>
          </label>
          <select name="storage_level" defaultValue={storageVal}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white">
            <option value="">— select —</option>
            <option value="1">1 — Low</option>
            <option value="2">2 — Medium</option>
            <option value="3">3 — High</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Processing Limit?</label>
          <div className="flex flex-col gap-2 py-1">
            <label className="flex items-center gap-2 text-sm text-[#0D2240] cursor-pointer">
              <input type="checkbox" name="has_processing_limit"
                defaultChecked={checked("has_processing_limit")} className="rounded" />
              Has a limit
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Days</span>
                <input name="processing_limit_days" type="number" step="1" min="0" placeholder="0"
                  defaultValue={val("processing_limit_days")}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white w-20" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Hours</span>
                <input name="processing_limit_hours" type="number" step="0.5" min="0" placeholder="0"
                  defaultValue={val("processing_limit_hours")}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Storage badge ─────────────────────────────────────────────────────────────
const STORAGE_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Storage: Low",    color: "bg-red-50 text-red-700 border-red-200" },
  2: { label: "Storage: Medium", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  3: { label: "Storage: High",   color: "bg-green-50 text-green-700 border-green-200" },
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function FacilitiesPage() {
  const supabase = createAdminClient()
  const [{ data: facilities }, { data: allWindows }] = await Promise.all([
    supabase.from("facilities").select("*, machine_groups(count)").order("name"),
    supabase.from("facility_access_windows").select("*").eq("active", true).order("start_time"),
  ])
  const windowsByFacility = (allWindows ?? []).reduce<Record<string, AccessWindow[]>>((acc, w) => {
    if (!acc[w.facility_id]) acc[w.facility_id] = []
    acc[w.facility_id].push(w as AccessWindow)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Laundromat Facilities</h1>
          <p className="text-sm text-gray-400 mt-1">{facilities?.filter(f => f.active).length ?? 0} active locations</p>
        </div>
      </div>

      {/* ── Partner Portal Links ── */}
      {facilities && facilities.some(f => f.active && f.partner_access_code) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-bold text-[#0D2240] mb-1">Partner Portal Links</h2>
          <p className="text-xs text-gray-400 mb-4">Share these links with each facility owner — they only see their own data.</p>
          <div className="space-y-2">
            {facilities.filter(f => f.active && f.partner_access_code).map(f => {
              const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://comforterwash.com"}/partner/${f.partner_access_code}`
              return (
                <div key={f.id} className="flex items-center gap-3 bg-[#f7f8fb] rounded-xl px-4 py-3 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0D2240] text-sm">{f.name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/partner/${f.partner_access_code}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs font-bold text-[#E8726A] hover:underline px-3 py-1.5 rounded-lg bg-[#E8726A]/10 hover:bg-[#E8726A]/20 transition-colors"
                    >
                      Open ↗
                    </a>
                    <PartnerLinkCopy url={url} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Add facility ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
        <h2 className="font-bold text-[#0D2240]">Add Facility</h2>
        <form action={addFacility} className="space-y-4">
          <FacilityFields />
          <div className="flex justify-end pt-1">
            <button type="submit"
              className="rounded-xl bg-[#E8726A] text-white font-bold text-sm px-6 py-2.5 hover:bg-[#d45f57] transition-colors">
              Add Facility
            </button>
          </div>
        </form>
      </div>

      {/* ── Facilities list ── */}
      <div className="space-y-3">
        {!facilities || facilities.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm border border-gray-100">
            No facilities yet. Add your first laundromat above.
          </div>
        ) : facilities.map((f) => (
          <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Summary row */}
            <div className="p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#f7f8fb] border border-gray-100 flex items-center justify-center text-2xl shrink-0">
                🏭
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[#0D2240]">{f.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    f.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-400"
                  }`}>
                    {f.active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Contact / people */}
                <div className="mt-1 space-y-0.5">
                  {f.address && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <span className="text-gray-300">📍</span>{f.address}
                    </p>
                  )}
                  {f.phone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <span className="text-gray-300">📞</span>
                      <a href={`tel:${f.phone}`} className="hover:text-[#0D2240]">{f.phone}</a>
                    </p>
                  )}
                  {f.contact_email && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <span className="text-gray-300">✉️</span>
                      <a href={`mailto:${f.contact_email}`} className="hover:text-[#0D2240]">{f.contact_email}</a>
                    </p>
                  )}
                  {(f.owner || f.manager) && (
                    <p className="text-sm text-gray-500 flex items-center gap-3">
                      {f.owner   && <span><span className="text-gray-400 font-semibold">Owner:</span> {f.owner}</span>}
                      {f.manager && <span><span className="text-gray-400 font-semibold">Manager:</span> {f.manager}</span>}
                    </p>
                  )}
                  {f.hours_open && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <span className="text-gray-300">🕐</span>{f.hours_open}
                    </p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {f.supports_own_operator && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Own Operator</span>
                  )}
                  {f.supports_partner_attendant && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">Partner Attendant</span>
                  )}
                  {f.rate_per_lb && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">${f.rate_per_lb}/lb</span>
                  )}
                  {f.minimum_lbs > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">min {f.minimum_lbs} lbs</span>
                  )}
                  {f.storage_level && STORAGE_LABEL[f.storage_level] && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STORAGE_LABEL[f.storage_level].color}`}>
                      {STORAGE_LABEL[f.storage_level].label}
                    </span>
                  )}
                  {f.has_processing_limit && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                      ⏱ Limit: {[f.processing_limit_days ? `${f.processing_limit_days}d` : null, f.processing_limit_hours ? `${f.processing_limit_hours}h` : null].filter(Boolean).join(" ") || "set"}
                    </span>
                  )}
                  {f.partner_access_code && (
                    <a href={`/partner/${f.partner_access_code}`} target="_blank" rel="noreferrer"
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8726A]/10 text-[#E8726A] border border-[#E8726A]/20 hover:bg-[#E8726A]/20 transition-colors">
                      Partner Portal ↗
                    </a>
                  )}
                  {(windowsByFacility[f.id] ?? []).length > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      🕐 {(windowsByFacility[f.id] ?? []).length} access window{(windowsByFacility[f.id] ?? []).length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200">
                      No access windows
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link href={`/admin/facilities/${f.id}`}
                  className="rounded-xl bg-[#0D2240] text-white font-bold text-xs px-4 py-2 hover:bg-[#1a3a5c] transition-colors">
                  Machines
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

            {/* Edit accordion */}
            <details className="group border-t border-gray-100">
              <summary className="cursor-pointer px-5 py-2.5 text-xs font-semibold text-gray-400 hover:text-[#0D2240] transition-colors list-none flex items-center gap-1.5 select-none">
                <span className="group-open:hidden">✏️ Edit facility</span>
                <span className="hidden group-open:inline">✏️ Close editor</span>
              </summary>
              <form action={editFacility} className="px-5 pb-5 pt-4 bg-[#f7f8fb] space-y-4 border-t border-gray-100">
                <input type="hidden" name="id" value={f.id} />
                <FacilityFields f={f as Record<string, unknown>} />
                <div className="flex justify-end">
                  <button type="submit"
                    className="rounded-xl bg-[#E8726A] text-white font-bold text-sm px-6 py-2 hover:bg-[#d45f57] transition-colors">
                    Save Changes
                  </button>
                </div>
              </form>
              {/* Access windows editor — outside the edit form so it can use client actions */}
              <div className="px-5 pb-5 bg-[#f7f8fb] border-t border-gray-100">
                <FacilityAccessWindowsEditor
                  facilityId={f.id}
                  initial={windowsByFacility[f.id] ?? []}
                />
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  )
}
