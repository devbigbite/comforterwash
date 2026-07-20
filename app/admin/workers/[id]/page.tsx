"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  createStripeConnectAccount, syncStripeStatus, issuePayout, updatePayRates,
  addWorkerDocument, deleteWorkerDocument, addMileageReport, deleteMileageReport,
  updateWorkerRoles, getWorkerDetail,
} from "@/app/actions/workers"
import { setWorkerPin, clearWorkerPin, setWorkerLang } from "@/app/actions/staff"

type Worker = {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  roles: string[]
  status: string
  has_vehicle: boolean
  experience: string | null
  admin_notes: string | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  driver_per_order_cents: number
  driver_per_mile_cents: number
  operator_per_hour_cents: number
  operator_per_mile_cents: number
  ic_agreement_signature: string | null
  ic_agreement_signed_at: string | null
  ic_agreement_role: string | null
  lang: string | null
  created_at: string
}

type Payout = {
  id: string
  created_at: string
  payout_type: string
  amount_cents: number
  miles: number | null
  hours: number | null
  stripe_transfer_id: string | null
  status: string
  notes: string | null
  booking_id: string | null
}

type WorkerDocument = {
  id: string
  document_type: string
  file_name: string
  external_url: string | null
  notes: string | null
  created_at: string
}

type MileageReport = {
  id: string
  report_date: string
  description: string
  miles: number
  notes: string | null
  created_at: string
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`
const ROLE_BADGE: Record<string, string> = {
  driver:   "bg-[#0D2240]/10 text-[#0D2240]",
  operator: "bg-purple-100 text-purple-700",
}
const ROLE_LABEL: Record<string, string> = {
  driver:   "Driver",
  operator: "Washing Operator",
}
const DOC_TYPE_LABELS: Record<string, string> = {
  "1099":           "1099-NEC",
  "ic_agreement":   "IC Agreement",
  "id_verification":"ID Verification",
  "other":          "Other",
}

export default function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [workerId, setWorkerId] = useState("")
  const [worker, setWorker] = useState<Worker | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [documents, setDocuments] = useState<WorkerDocument[]>([])
  const [mileageReports, setMileageReports] = useState<MileageReport[]>([])
  const [loading, setLoading] = useState(true)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // PIN management
  const [newPin, setNewPin]       = useState("")
  const [pinMsg, setPinMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [pinSaving, setPinSaving] = useState(false)
  const [workerLang, setWorkerLang_] = useState<"en" | "es">("en")
  const [langSaving, setLangSaving]  = useState(false)

  // Payout form state
  const [payType, setPayType] = useState("delivery")
  const [miles, setMiles] = useState("")
  const [hours, setHours] = useState("")
  const [manualAmt, setManualAmt] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [payoutLoading, setPayoutLoading] = useState(false)

  // Document form state
  const [docType, setDocType]         = useState("1099")
  const [docName, setDocName]         = useState("")
  const [docUrl, setDocUrl]           = useState("")
  const [docNotes, setDocNotes]       = useState("")
  const [docSaving, setDocSaving]     = useState(false)
  const [docMsg, setDocMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [showDocForm, setShowDocForm] = useState(false)

  // Mileage form state
  const [mileDate, setMileDate]         = useState(new Date().toISOString().slice(0, 10))
  const [mileDesc, setMileDesc]         = useState("")
  const [mileMiles, setMileMiles]       = useState("")
  const [mileNotes, setMileNotes]       = useState("")
  const [mileSaving, setMileSaving]     = useState(false)
  const [mileMsg, setMileMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [showMileForm, setShowMileForm] = useState(false)

  useEffect(() => {
    params.then(p => setWorkerId(p.id))
  }, [params])

  useEffect(() => {
    if (!workerId) return
    getWorkerDetail(workerId).then(({ worker: w, payouts: p, documents: d, mileageReports: m }) => {
      setWorker(w as Worker | null)
      setWorkerLang_(((w as Worker | null)?.lang ?? "en") as "en" | "es")
      setPayouts(p as Payout[])
      setDocuments(d as WorkerDocument[])
      setMileageReports(m as MileageReport[])
      setLoading(false)
    })

    const url = new URL(window.location.href)
    if (url.searchParams.get("onboarded")) {
      setSyncLoading(true)
      syncStripeStatus(workerId).then(() => {
        setSyncLoading(false)
        setMsg({ type: "ok", text: "Stripe onboarding complete! Status synced." })
        window.history.replaceState({}, "", `/admin/workers/${workerId}`)
        refreshWorker()
      })
    }
  }, [workerId])

  async function refreshWorker() {
    const { worker: w } = await getWorkerDetail(workerId)
    setWorker(w as Worker | null)
  }

  async function refreshDocs() {
    const { documents: d } = await getWorkerDetail(workerId)
    setDocuments(d as WorkerDocument[])
  }

  async function refreshMileage() {
    const { mileageReports: m } = await getWorkerDetail(workerId)
    setMileageReports(m as MileageReport[])
  }

  const totalPaid = payouts.filter(p => p.status === "transferred").reduce((s, p) => s + p.amount_cents, 0)
  const totalMiles = mileageReports.reduce((s, r) => s + Number(r.miles), 0)

  async function handleStripeConnect() {
    setStripeLoading(true)
    const result = await createStripeConnectAccount(workerId)
    setStripeLoading(false)
    if (result.url) {
      window.location.href = result.url
    } else {
      setMsg({ type: "err", text: result.error ?? "Failed to create Stripe account" })
    }
  }

  async function handleSync() {
    setSyncLoading(true)
    const result = await syncStripeStatus(workerId)
    setSyncLoading(false)
    setMsg(result.complete
      ? { type: "ok", text: "Stripe onboarding is complete — worker is ready to receive payouts." }
      : { type: "err", text: "Onboarding not yet complete. Have the worker finish their Stripe setup." })
    refreshWorker()
  }

  async function handlePayout() {
    if (!worker) return
    setPayoutLoading(true)
    setMsg(null)
    const fd = new FormData()
    fd.set("workerId", workerId)
    fd.set("type", payType)
    fd.set("miles", miles || "0")
    fd.set("hours", hours || "0")
    fd.set("manualCents", String(Math.round(parseFloat(manualAmt || "0") * 100)))
    fd.set("notes", payNotes)
    const result = await issuePayout(fd)
    setPayoutLoading(false)
    if (result.success) {
      setMsg({ type: "ok", text: `Payout of ${fmt(result.amountCents!)} transferred successfully.` })
      setMiles(""); setHours(""); setManualAmt(""); setPayNotes("")
      const { payouts: p } = await getWorkerDetail(workerId)
      setPayouts(p as Payout[])
    } else {
      setMsg({ type: "err", text: result.error ?? "Payout failed" })
    }
  }

  async function handleSetPin() {
    if (!/^\d{4}$/.test(newPin)) { setPinMsg({ type: "err", text: "PIN must be exactly 4 digits" }); return }
    setPinSaving(true); setPinMsg(null)
    const result = await setWorkerPin(worker!.name, newPin)
    setPinSaving(false)
    if (result?.error) { setPinMsg({ type: "err", text: result.error }); return }
    setNewPin("")
    setPinMsg({ type: "ok", text: "PIN set successfully." })
  }

  async function handleClearPin() {
    if (!confirm(`Remove clock PIN for ${worker?.name}?`)) return
    setPinSaving(true); setPinMsg(null)
    await clearWorkerPin(worker!.name)
    setPinSaving(false)
    setPinMsg({ type: "ok", text: "PIN cleared." })
  }

  async function handleRates(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("workerId", workerId)
    await updatePayRates(fd)
    setMsg({ type: "ok", text: "Pay rates saved." })
    refreshWorker()
  }

  async function handleAddDoc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!docName.trim()) { setDocMsg({ type: "err", text: "File name is required." }); return }
    setDocSaving(true); setDocMsg(null)
    const fd = new FormData()
    fd.set("worker_id", workerId)
    fd.set("document_type", docType)
    fd.set("file_name", docName.trim())
    fd.set("external_url", docUrl.trim())
    fd.set("notes", docNotes.trim())
    const result = await addWorkerDocument(fd)
    setDocSaving(false)
    if (result?.error) { setDocMsg({ type: "err", text: result.error }); return }
    setDocName(""); setDocUrl(""); setDocNotes(""); setShowDocForm(false)
    setDocMsg({ type: "ok", text: "Document saved." })
    refreshDocs()
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm("Remove this document?")) return
    await deleteWorkerDocument(docId, workerId)
    refreshDocs()
  }

  async function handleAddMileage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!mileDesc.trim() || !mileMiles) { setMileMsg({ type: "err", text: "Date, description, and miles are required." }); return }
    setMileSaving(true); setMileMsg(null)
    const fd = new FormData()
    fd.set("worker_id", workerId)
    fd.set("report_date", mileDate)
    fd.set("description", mileDesc.trim())
    fd.set("miles", mileMiles)
    fd.set("notes", mileNotes.trim())
    const result = await addMileageReport(fd)
    setMileSaving(false)
    if (result?.error) { setMileMsg({ type: "err", text: result.error }); return }
    setMileDesc(""); setMileMiles(""); setMileNotes(""); setShowMileForm(false)
    setMileMsg({ type: "ok", text: "Mileage entry saved." })
    refreshMileage()
  }

  async function handleDeleteMileage(reportId: string) {
    if (!confirm("Remove this mileage entry?")) return
    await deleteMileageReport(reportId, workerId)
    refreshMileage()
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!worker) return <div className="p-8 text-red-500 text-sm">Worker not found.</div>

  const isDriver   = worker.roles?.includes("driver")
  const isOperator = worker.roles?.includes("operator")

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/admin/workers" className="text-sm text-gray-400 hover:text-[#0D2240] transition-colors">
        ← Back to Workers
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-extrabold text-[#0D2240]">{worker.name}</h1>
              {worker.roles?.map((r: string) => (
                <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${ROLE_BADGE[r] ?? "bg-gray-100 text-gray-500"}`}>
                  {ROLE_LABEL[r] ?? r}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              <span>✉️ {worker.email}</span>
              {worker.phone && <span>📞 {worker.phone}</span>}
              {worker.address && <span>📍 {worker.address}</span>}
            </div>
            {worker.experience && <p className="text-xs text-gray-500 mt-2 italic">"{worker.experience}"</p>}
            {/* IC Agreement status */}
            {worker.ic_agreement_signature ? (
              <p className="text-xs text-green-600 font-semibold mt-2 flex items-center gap-1">
                ✓ IC Agreement signed as &ldquo;{worker.ic_agreement_signature}&rdquo;
                {worker.ic_agreement_signed_at && (
                  <span className="text-gray-400 font-normal">
                    — {new Date(worker.ic_agreement_signed_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-amber-600 font-semibold mt-2">⚠ IC Agreement not signed</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-extrabold text-[#E8726A]">{fmt(totalPaid)}</p>
            <p className="text-xs text-gray-400">total paid out</p>
          </div>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      {/* Stripe Connect */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-1">Stripe Connect</h2>
        <p className="text-xs text-gray-400 mb-4">Worker must complete Stripe onboarding to receive payouts &amp; 1099s.</p>
        <div className="flex items-center gap-3 flex-wrap">
          {worker.stripe_account_id ? (
            <>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${worker.stripe_onboarding_complete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {worker.stripe_onboarding_complete ? "✓ Onboarding Complete" : "⏳ Onboarding Pending"}
              </span>
              <span className="text-xs text-gray-300 font-mono">{worker.stripe_account_id}</span>
              {!worker.stripe_onboarding_complete && (
                <button onClick={handleStripeConnect} disabled={stripeLoading}
                  className="text-xs font-bold text-amber-700 border border-amber-300 bg-amber-50 px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors uppercase tracking-wide disabled:opacity-50">
                  {stripeLoading ? "Loading…" : "Resend Onboarding Link"}
                </button>
              )}
              <button onClick={handleSync} disabled={syncLoading}
                className="text-xs font-bold text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors uppercase tracking-wide disabled:opacity-50">
                {syncLoading ? "Syncing…" : "↻ Sync Status"}
              </button>
            </>
          ) : (
            <button onClick={handleStripeConnect} disabled={stripeLoading}
              className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50">
              {stripeLoading ? "Creating account…" : "⚡ Create Stripe Account & Send Onboarding Link"}
            </button>
          )}
        </div>
      </div>

      {/* Clock PIN */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-1">Clock PIN</h2>
        <p className="text-xs text-gray-400 mb-4">4-digit PIN required at the Staff Clock to prevent buddy punching.</p>
        <div className="flex items-center gap-3">
          <input type="text" inputMode="numeric" pattern="\d{4}" maxLength={4}
            placeholder="New 4-digit PIN" value={newPin}
            onChange={e => { setNewPin(e.target.value.replace(/\D/g, "").slice(0,4)); setPinMsg(null) }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-36 focus:outline-none focus:border-[#E8726A] tracking-[0.4em] font-mono" />
          <button type="button" onClick={handleSetPin} disabled={pinSaving || newPin.length !== 4}
            className="bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors uppercase tracking-wide">
            {pinSaving ? "Saving…" : "Set PIN"}
          </button>
          <button type="button" onClick={handleClearPin} disabled={pinSaving}
            className="text-xs font-bold text-red-400 border border-red-100 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors uppercase tracking-wide disabled:opacity-40">
            Clear
          </button>
        </div>
        {pinMsg && (
          <p className={`text-xs font-semibold mt-2 ${pinMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
            {pinMsg.text}
          </p>
        )}
      </div>

      {/* App Language */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-1">App Language</h2>
        <p className="text-xs text-gray-400 mb-4">Language shown in driver/operator apps when this worker logs in with their PIN.</p>
        <div className="flex gap-2">
          {(["en", "es"] as const).map(l => (
            <button key={l} type="button"
              onClick={async () => {
                if (l === workerLang || langSaving) return
                setLangSaving(true)
                setWorkerLang_(l)
                await setWorkerLang(workerId, l)
                setLangSaving(false)
              }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
                workerLang === l ? "bg-[#0D2240] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              {l === "en" ? "🇺🇸 English" : "🇲🇽 Español"}
              {langSaving && workerLang === l && <span className="ml-1 opacity-60">…</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-1">Roles</h2>
        <p className="text-xs text-gray-400 mb-4">Toggle the functions this worker can perform.</p>
        <form action={updateWorkerRoles} className="space-y-3">
          <input type="hidden" name="workerId" value={worker.id} />
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="role_driver"
              defaultChecked={worker.roles?.includes("driver")}
              className="w-4 h-4 accent-[#E8726A]"
            />
            <div>
              <p className="text-sm font-bold text-[#0D2240]">Driver</p>
              <p className="text-[11px] text-gray-400">Pickups, deliveries, and transfer runs</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="role_operator"
              defaultChecked={worker.roles?.includes("operator")}
              className="w-4 h-4 accent-[#E8726A]"
            />
            <div>
              <p className="text-sm font-bold text-[#0D2240]">Washing Operator</p>
              <p className="text-[11px] text-gray-400">Processing orders at facility</p>
            </div>
          </label>
          <button type="submit"
            className="mt-2 bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-xs font-bold px-5 py-2 rounded-xl transition-colors">
            Save Roles
          </button>
        </form>
      </div>

      {/* Pay Rates */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-4">Pay Rates</h2>
        <form onSubmit={handleRates} className="space-y-4">
          {isDriver && (
            <div>
              <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-2">🚐 Driver</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Order ($)</label>
                  <input type="number" name="driver_per_order" step="0.01" min="0"
                    defaultValue={((worker.driver_per_order_cents ?? 0) / 100).toFixed(2)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Mile ($)</label>
                  <input type="number" name="driver_per_mile" step="0.01" min="0"
                    defaultValue={((worker.driver_per_mile_cents ?? 0) / 100).toFixed(2)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
              </div>
            </div>
          )}
          {isOperator && (
            <div>
              <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-2">🧺 Washing Operator</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Hour ($)</label>
                  <input type="number" name="operator_per_hour" step="0.01" min="0"
                    defaultValue={((worker.operator_per_hour_cents ?? 0) / 100).toFixed(2)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Per Mile ($)</label>
                  <input type="number" name="operator_per_mile" step="0.01" min="0"
                    defaultValue={((worker.operator_per_mile_cents ?? 0) / 100).toFixed(2)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
              </div>
            </div>
          )}
          {!isDriver && !isOperator && (
            <p className="text-xs text-gray-400">No roles assigned yet.</p>
          )}
          <button type="submit"
            className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors">
            Save Rates
          </button>
        </form>
      </div>

      {/* Issue Payout */}
      {worker.stripe_onboarding_complete && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-extrabold text-[#0D2240] text-base mb-1">Issue Payout</h2>
          <p className="text-xs text-gray-400 mb-4">Transfer sent immediately to the worker's bank via Stripe.</p>
          <div className="space-y-4">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { key: "delivery",  label: "🚐 Delivery" },
                { key: "operation", label: "🧺 Operation" },
                { key: "manual",    label: "✏️ Manual" },
              ].map((t) => (
                <button key={t.key} type="button" onClick={() => setPayType(t.key)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    payType === t.key ? "bg-white text-[#0D2240] shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            {payType === "delivery" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Miles driven</label>
                  <input type="number" step="0.1" min="0" value={miles} onChange={e => setMiles(e.target.value)} placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Estimated total</label>
                  <div className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-[#E8726A] bg-gray-50">
                    {fmt((worker.driver_per_order_cents ?? 0) + Math.round(parseFloat(miles || "0") * (worker.driver_per_mile_cents ?? 0)))}
                  </div>
                </div>
              </div>
            )}
            {payType === "operation" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Hours worked</label>
                  <input type="number" step="0.25" min="0" value={hours} onChange={e => setHours(e.target.value)} placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Miles driven</label>
                  <input type="number" step="0.1" min="0" value={miles} onChange={e => setMiles(e.target.value)} placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Estimated total</label>
                  <div className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-[#E8726A] bg-gray-50">
                    {fmt(Math.round(parseFloat(hours || "0") * (worker.operator_per_hour_cents ?? 0)) + Math.round(parseFloat(miles || "0") * (worker.operator_per_mile_cents ?? 0)))}
                  </div>
                </div>
              </div>
            )}
            {payType === "manual" && (
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Amount ($)</label>
                <input type="number" step="0.01" min="0" value={manualAmt} onChange={e => setManualAmt(e.target.value)} placeholder="0.00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
              </div>
            )}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Notes (optional)</label>
              <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="e.g. Route #12, Oct 14"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
            </div>
            <button type="button" onClick={handlePayout} disabled={payoutLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-3 rounded-xl transition-colors text-sm uppercase tracking-wide disabled:opacity-50">
              {payoutLoading ? "Sending…" : "Send Payout via Stripe"}
            </button>
          </div>
        </div>
      )}

      {/* ── Documents ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-extrabold text-[#0D2240] text-base">Documents</h2>
            <p className="text-xs text-gray-400">1099s, IC agreements, ID verification, and other files</p>
          </div>
          <button onClick={() => { setShowDocForm(!showDocForm); setDocMsg(null) }}
            className="text-xs font-bold text-[#E8726A] border border-[#E8726A] px-4 py-2 rounded-lg hover:bg-[#fdf6f3] transition-colors uppercase tracking-wide">
            {showDocForm ? "Cancel" : "+ Add Document"}
          </button>
        </div>

        {docMsg && (
          <div className={`rounded-xl px-3 py-2 text-xs font-semibold mb-3 ${docMsg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
            {docMsg.text}
          </div>
        )}

        {showDocForm && (
          <form onSubmit={handleAddDoc} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Document Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white">
                  <option value="1099">1099-NEC</option>
                  <option value="ic_agreement">IC Agreement</option>
                  <option value="id_verification">ID Verification</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">File Name *</label>
                <input type="text" value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. 1099-2024.pdf"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Link (Google Drive, Dropbox, etc.)</label>
              <input type="url" value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://drive.google.com/…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Notes (optional)</label>
              <input type="text" value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="Tax year, notes, etc."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white" />
            </div>
            <button type="submit" disabled={docSaving}
              className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors uppercase tracking-wide disabled:opacity-50">
              {docSaving ? "Saving…" : "Save Document"}
            </button>
          </form>
        )}

        {documents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No documents on file yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">📄</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0D2240] truncate">{doc.file_name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
                        {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                      </span>
                    </div>
                    {doc.notes && <p className="text-xs text-gray-400">{doc.notes}</p>}
                    <p className="text-[10px] text-gray-300">{new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.external_url && (
                    <a href={doc.external_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold text-[#E8726A] hover:underline">
                      Open ↗
                    </a>
                  )}
                  <button onClick={() => handleDeleteDoc(doc.id)}
                    className="text-xs text-red-400 hover:text-red-600 font-semibold">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mileage Reports (drivers only) ───────────────────────────────────── */}
      {isDriver && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-extrabold text-[#0D2240] text-base">Mileage Reports</h2>
              <p className="text-xs text-gray-400">
                {mileageReports.length} entries — <span className="font-semibold text-[#0D2240]">{totalMiles.toFixed(1)} total miles</span>
              </p>
            </div>
            <button onClick={() => { setShowMileForm(!showMileForm); setMileMsg(null) }}
              className="text-xs font-bold text-[#0D2240] border border-[#0D2240] px-4 py-2 rounded-lg hover:bg-[#0D2240]/5 transition-colors uppercase tracking-wide">
              {showMileForm ? "Cancel" : "+ Log Miles"}
            </button>
          </div>

          {mileMsg && (
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold mb-3 ${mileMsg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              {mileMsg.text}
            </div>
          )}

          {showMileForm && (
            <form onSubmit={handleAddMileage} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Date *</label>
                  <input type="date" value={mileDate} onChange={e => setMileDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Miles *</label>
                  <input type="number" step="0.1" min="0" value={mileMiles} onChange={e => setMileMiles(e.target.value)} placeholder="0.0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Trip Description *</label>
                <input type="text" value={mileDesc} onChange={e => setMileDesc(e.target.value)} placeholder="e.g. Route #3 — Metrowest pickup to facility"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Notes (optional)</label>
                <input type="text" value={mileNotes} onChange={e => setMileNotes(e.target.value)} placeholder="Order #, run ID, etc."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8726A] bg-white" />
              </div>
              <button type="submit" disabled={mileSaving}
                className="bg-[#0D2240] hover:bg-[#1a3a5c] text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors uppercase tracking-wide disabled:opacity-50">
                {mileSaving ? "Saving…" : "Save Mileage Entry"}
              </button>
            </form>
          )}

          {mileageReports.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No mileage entries yet.</p>
          ) : (
            <div className="space-y-0">
              {/* Header row */}
              <div className="grid grid-cols-[90px_1fr_70px_60px] gap-2 text-[10px] text-gray-400 uppercase tracking-wide font-bold pb-2 border-b border-gray-100">
                <span>Date</span><span>Trip</span><span className="text-right">Miles</span><span></span>
              </div>
              {mileageReports.map((r) => (
                <div key={r.id} className="grid grid-cols-[90px_1fr_70px_60px] gap-2 items-start py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400">{new Date(r.report_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <div>
                    <p className="text-xs font-semibold text-[#0D2240]">{r.description}</p>
                    {r.notes && <p className="text-[10px] text-gray-400">{r.notes}</p>}
                  </div>
                  <span className="text-xs font-bold text-[#0D2240] text-right">{Number(r.miles).toFixed(1)} mi</span>
                  <button onClick={() => handleDeleteMileage(r.id)}
                    className="text-xs text-red-400 hover:text-red-600 font-semibold text-right">
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t border-gray-200 mt-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total</span>
                <span className="text-sm font-extrabold text-[#0D2240]">{totalMiles.toFixed(1)} miles</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payout History */}
      {payouts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-extrabold text-[#0D2240] text-base mb-4">Payout History</h2>
          <div className="space-y-0">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[10px] text-gray-400 uppercase tracking-wide font-bold pb-2 border-b border-gray-100">
              <span>Description</span><span className="text-right">Amount</span><span className="text-right">Status</span>
            </div>
            {payouts.map((p) => (
              <div key={p.id} className="grid grid-cols-[1fr_80px_80px] gap-2 items-start py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-[#0D2240] capitalize">{p.payout_type.replace("_", " ")}</p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.miles ? ` · ${p.miles} mi` : ""}
                    {p.hours ? ` · ${p.hours}h` : ""}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#E8726A] text-right">{fmt(p.amount_cents)}</span>
                <span className={`text-[10px] font-bold text-right ${p.status === "transferred" ? "text-green-600" : "text-amber-600"}`}>
                  {p.status}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-gray-200 mt-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Paid Out</span>
              <span className="text-sm font-extrabold text-[#E8726A]">{fmt(totalPaid)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
