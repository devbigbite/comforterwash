"use client"

import { useEffect, useState, useTransition } from "react"
import {
  getPlatformDemoRequests,
  setDemoRequestStatus,
  type PlatformDemoRequest,
} from "@/app/actions/platform-demo-requests"
import { DEMO_REQUEST_STAGES, type DemoRequestStatus } from "@/lib/demo-request-stages"
import { resendDemoGuideEmail } from "@/app/actions/platform-demo-email"
import { sendSignupLinkToLead } from "@/app/actions/platform-billing"
import { enterTenantAdmin } from "@/app/actions/super-admin"

const STATUS_COLORS: Record<DemoRequestStatus, string> = {
  new:         "bg-indigo-100 text-indigo-700",
  contacted:   "bg-amber-100 text-amber-700",
  demo_viewed: "bg-sky-100 text-sky-700",
  negotiating: "bg-purple-100 text-purple-700",
  won:         "bg-green-100 text-green-700",
  lost:        "bg-slate-200 text-slate-500",
}

// Stages still counted as "active pipeline" for the stale-lead warning —
// won/lost leads are done, so staleness no longer matters for them.
const ACTIVE_STAGES: DemoRequestStatus[] = ["new", "contacted", "demo_viewed", "negotiating"]
const STALE_AFTER_DAYS = 3

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function DemoRequestsPage() {
  const [requests, setRequests] = useState<PlatformDemoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentMsg, setSentMsg] = useState<Record<string, string>>({})
  const [signupPanelId, setSignupPanelId] = useState<string | null>(null)
  const [planName, setPlanName] = useState("Standard")
  const [planPrice, setPlanPrice] = useState("99")
  const [, startTransition] = useTransition()

  async function load() {
    setLoading(true)
    const data = await getPlatformDemoRequests()
    setRequests(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function changeStatus(r: PlatformDemoRequest, status: DemoRequestStatus) {
    let lostReason: string | undefined
    if (status === "lost") {
      lostReason = window.prompt("Why was this lead lost? (e.g. price, went with a competitor, timing)", r.lost_reason ?? "") ?? undefined
      if (lostReason === undefined) return // cancelled — don't change status
    }
    await setDemoRequestStatus(r.id, status, lostReason)
    startTransition(() => { load() })
  }

  async function handleResend(id: string) {
    setSendingId(id)
    setSentMsg(m => ({ ...m, [id]: "" }))
    const result = await resendDemoGuideEmail(id)
    setSendingId(null)
    setSentMsg(m => ({ ...m, [id]: "error" in result ? `Failed: ${result.error}` : "Sent!" }))
    startTransition(() => { load() })
  }

  function openSignupPanel(r: PlatformDemoRequest) {
    setSignupPanelId(r.id)
    setPlanName("Standard")
    setPlanPrice("99")
  }

  async function handleSendSignupLink(r: PlatformDemoRequest) {
    if (!r.demo_location_id) return
    const priceCents = Math.round(parseFloat(planPrice) * 100)
    if (!priceCents || priceCents <= 0) {
      setSentMsg(m => ({ ...m, [r.id]: "Failed: Enter a valid monthly price" }))
      return
    }
    setSendingId(r.id)
    setSentMsg(m => ({ ...m, [r.id]: "" }))
    const result = await sendSignupLinkToLead({
      requestId: r.id,
      leadEmail: r.email,
      leadName: r.name,
      business: r.business,
      locationId: r.demo_location_id,
      planName,
      planPriceCents: priceCents,
    })
    setSendingId(null)
    setSignupPanelId(null)
    setSentMsg(m => ({ ...m, [r.id]: result.error ? `Failed: ${result.error}` : "Signup link sent!" }))
    startTransition(() => { load() })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Loading demo requests…
      </div>
    )
  }

  const newCount = requests.filter(r => r.status === "new").length
  const staleCount = requests.filter(r => ACTIVE_STAGES.includes(r.status) && daysSince(r.updated_at) >= STALE_AFTER_DAYS).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Sales Funnel</h2>
        <p className="text-sm text-slate-500 mt-1">
          {requests.length} total{newCount > 0 ? ` · ${newCount} new` : ""}{staleCount > 0 ? ` · ${staleCount} stale` : ""} —
          submitted via the "Request a Demo" form on /platform. Each one automatically gets its own live demo site
          (name.washfoldclean.com), an admin login, a guide email, and up to 3 automated follow-up nudges if they go quiet.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          No demo requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => {
            const stale = ACTIVE_STAGES.includes(r.status) && daysSince(r.updated_at) >= STALE_AFTER_DAYS
            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl border p-5 flex items-start justify-between gap-4 ${stale ? "border-amber-300" : "border-slate-200"}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{r.name}</span>
                    {r.business && <span className="text-slate-400 text-sm">— {r.business}</span>}
                    <select
                      value={r.status}
                      onChange={e => changeStatus(r, e.target.value as DemoRequestStatus)}
                      className={`text-xs font-medium rounded-full px-2 py-0.5 border-0 cursor-pointer ${STATUS_COLORS[r.status] ?? STATUS_COLORS.new}`}
                    >
                      {DEMO_REQUEST_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {stale && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                        ⚠ Stale — {daysSince(r.updated_at)}d untouched
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                    {r.phone && <> · <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a></>}
                  </p>
                  {r.message && (
                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2">{r.message}</p>
                  )}
                  {r.status === "lost" && r.lost_reason && (
                    <p className="text-xs text-slate-400 mt-2">Lost reason: {r.lost_reason}</p>
                  )}
                  <p className="text-xs text-slate-300 mt-2">
                    {new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    {r.follow_up_count > 0 && <> · {r.follow_up_count} follow-up{r.follow_up_count > 1 ? "s" : ""} sent</>}
                  </p>

                  {signupPanelId === r.id && (
                    <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-end gap-2 flex-wrap">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Plan name</label>
                        <input
                          value={planName}
                          onChange={e => setPlanName(e.target.value)}
                          className="text-sm rounded-md border border-slate-300 px-2 py-1 w-32"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Monthly price ($)</label>
                        <input
                          value={planPrice}
                          onChange={e => setPlanPrice(e.target.value)}
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-sm rounded-md border border-slate-300 px-2 py-1 w-24"
                        />
                      </div>
                      <button
                        onClick={() => handleSendSignupLink(r)}
                        disabled={sendingId === r.id}
                        className="text-xs font-semibold bg-indigo-600 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
                      >
                        {sendingId === r.id ? "Sending…" : "Send Link"}
                      </button>
                      <button
                        onClick={() => setSignupPanelId(null)}
                        className="text-xs text-slate-400 px-2 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  {r.demo_slug ? (
                    <a
                      href={`https://${r.demo_slug}.${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfoldclean.com"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-indigo-600 hover:underline whitespace-nowrap"
                    >
                      {r.demo_slug}.{process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "washfoldclean.com"} ↗
                    </a>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-600 whitespace-nowrap">No demo site yet</span>
                  )}
                  {r.demo_email_sent_at ? (
                    <span className="text-[11px] font-medium text-green-600 whitespace-nowrap">
                      ✓ Demo email sent {new Date(r.demo_email_sent_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-600 whitespace-nowrap">Demo email not sent</span>
                  )}
                  <div className="flex items-center gap-3">
                    {r.demo_location_id && (
                      <button
                        onClick={() => enterTenantAdmin(r.demo_location_id!)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 whitespace-nowrap"
                      >
                        Enter their admin
                      </button>
                    )}
                    {r.demo_location_id && r.status !== "won" && r.status !== "lost" && (
                      <button
                        onClick={() => openSignupPanel(r)}
                        className="text-xs font-medium text-green-600 hover:text-green-800 whitespace-nowrap"
                      >
                        Send Signup Link
                      </button>
                    )}
                    <button
                      onClick={() => handleResend(r.id)}
                      disabled={sendingId === r.id}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      {sendingId === r.id ? "Working…" : r.demo_location_id ? "Resend guide" : "Create demo site"}
                    </button>
                  </div>
                  {sentMsg[r.id] && (
                    <span className={`text-[11px] ${sentMsg[r.id].startsWith("Failed") ? "text-red-500" : "text-green-600"}`}>
                      {sentMsg[r.id]}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
