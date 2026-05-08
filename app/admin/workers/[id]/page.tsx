"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createStripeConnectAccount, syncStripeStatus, issuePayout, updatePayRates } from "@/app/actions/workers"
import { setWorkerPin, clearWorkerPin } from "@/app/actions/staff"
import { createClient } from "@/lib/supabase/client"

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

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`
const ROLE_BADGE: Record<string, string> = {
  driver:   "bg-[#0D2240]/10 text-[#0D2240]",
  operator: "bg-purple-100 text-purple-700",
}

export default function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [workerId, setWorkerId] = useState("")
  const [worker, setWorker] = useState<Worker | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // PIN management
  const [newPin, setNewPin]       = useState("")
  const [pinMsg, setPinMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [pinSaving, setPinSaving] = useState(false)

  // Payout form state
  const [payType, setPayType] = useState("delivery")
  const [miles, setMiles] = useState("")
  const [hours, setHours] = useState("")
  const [manualAmt, setManualAmt] = useState("")
  const [payNotes, setPayNotes] = useState("")

  useEffect(() => {
    params.then(p => setWorkerId(p.id))
  }, [params])

  useEffect(() => {
    if (!workerId) return
    const supabase = createClient()
    Promise.all([
      supabase.from("workers").select("*").eq("id", workerId).single(),
      supabase.from("worker_payouts").select("*").eq("worker_id", workerId).order("created_at", { ascending: false }),
    ]).then(([{ data: w }, { data: p }]) => {
      setWorker(w)
      setPayouts(p ?? [])
      setLoading(false)
    })

    // Check URL params for Stripe return
    const url = new URL(window.location.href)
    if (url.searchParams.get("onboarded")) {
      setSyncLoading(true)
      syncStripeStatus(workerId).then(() => {
        setSyncLoading(false)
        setMsg({ type: "ok", text: "Stripe onboarding complete! Status synced." })
        window.history.replaceState({}, "", `/admin/workers/${workerId}`)
        supabase.from("workers").select("*").eq("id", workerId).single().then(({ data }) => setWorker(data))
      })
    }
  }, [workerId])

  const totalPaid = payouts.filter(p => p.status === "transferred").reduce((s, p) => s + p.amount_cents, 0)

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
    const supabase = createClient()
    const { data } = await supabase.from("workers").select("*").eq("id", workerId).single()
    setWorker(data)
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
      // Refresh payouts
      const supabase = createClient()
      const { data } = await supabase.from("worker_payouts").select("*").eq("worker_id", workerId).order("created_at", { ascending: false })
      setPayouts(data ?? [])
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
    setPinMsg({ type: "ok", text: "PIN cleared — worker can clock in without a PIN until a new one is set." })
  }

  async function handleRates(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("workerId", workerId)
    await updatePayRates(fd)
    setMsg({ type: "ok", text: "Pay rates saved." })
    const supabase = createClient()
    const { data } = await supabase.from("workers").select("*").eq("id", workerId).single()
    setWorker(data)
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
                <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${ROLE_BADGE[r]}`}>{r}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              <span>✉️ {worker.email}</span>
              {worker.phone && <span>📞 {worker.phone}</span>}
              {worker.address && <span>📍 {worker.address}</span>}
            </div>
            {worker.experience && <p className="text-xs text-gray-500 mt-2 italic">"{worker.experience}"</p>}
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
        <p className="text-xs text-gray-400 mb-4">4-digit PIN required at the Staff Clock to prevent buddy punching. Leave blank to allow PIN-free clock-in.</p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="New 4-digit PIN"
            value={newPin}
            onChange={e => { setNewPin(e.target.value.replace(/\D/g, "").slice(0,4)); setPinMsg(null) }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-36 focus:outline-none focus:border-[#E8726A] tracking-[0.4em] font-mono"
          />
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
              <p className="text-xs font-bold text-[#0D2240] uppercase tracking-wide mb-2">🧺 Operator</p>
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
            <p className="text-xs text-gray-400">No roles assigned to this worker yet.</p>
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
          <p className="text-xs text-gray-400 mb-4">Transfer is sent immediately to the worker's bank via Stripe.</p>

          <div className="space-y-4">
            {/* Payout type tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { key: "delivery",  label: "🚐 Delivery" },
                { key: "operation", label: "🧺 Operation" },
                { key: "manual",    label: "✏️ Manual" },
              ].map((t) => (
                <button key={t.key} type="button"
                  onClick={() => setPayType(t.key)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    payType === t.key ? "bg-white text-[#0D2240] shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Calculated preview */}
            {payType === "delivery" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Miles driven</label>
                  <input type="number" step="0.1" min="0" value={miles} onChange={e => setMiles(e.target.value)}
                    placeholder="0"
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
                  <input type="number" step="0.25" min="0" value={hours} onChange={e => setHours(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Miles driven</label>
                  <input type="number" step="0.1" min="0" value={miles} onChange={e => setMiles(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Estimated total</label>
                  <div className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-[#E8726A] bg-gray-50">
                    {fmt(
                      Math.round(parseFloat(hours || "0") * (worker.operator_per_hour_cents ?? 0)) +
                      Math.round(parseFloat(miles || "0") * (worker.operator_per_mile_cents ?? 0))
                    )}
                  </div>
                </div>
              </div>
            )}

            {payType === "manual" && (
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Amount ($)</label>
                <input type="number" step="0.01" min="0" value={manualAmt} onChange={e => setManualAmt(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]" />
              </div>
            )}

            {/* Submit payout button */}
            <button type="button"
              onClick={async () => {
                let amountCents = 0
                if (payType === "delivery") {
                  amountCents = (worker.driver_per_order_cents ?? 0) + Math.round(parseFloat(miles || "0") * (worker.driver_per_mile_cents ?? 0))
                } else if (payType === "operation") {
                  amountCents = Math.round(parseFloat(hours || "0") * (worker.operator_per_hour_cents ?? 0)) +
                    Math.round(parseFloat(miles || "0") * (worker.operator_per_mile_cents ?? 0))
                } else {
                  amountCents = Math.round(parseFloat(manualAmt || "0") * 100)
                }
                if (amountCents <= 0) { setPayError("Enter a valid amount."); return }
                setPayError(null); setPayLoading(true)
                try {
                  await issuePayout(worker.id, amountCents, payType)
                  setPaySuccess(fmt(amountCents) + " payout sent!")
                } catch (e: unknown) {
                  setPayError(e instanceof Error ? e.message : "Payout failed")
                } finally { setPayLoading(false) }
              }}
              disabled={payLoading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white font-extrabold py-3 rounded-xl transition-colors text-sm uppercase tracking-wide">
              {payLoading ? "Sending…" : "Send Payout via Stripe"}
            </button>

            {payError && <p className="text-red-500 text-xs font-semibold text-center">{payError}</p>}
            {paySuccess && <p className="text-green-600 text-xs font-semibold text-center">{paySuccess}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
