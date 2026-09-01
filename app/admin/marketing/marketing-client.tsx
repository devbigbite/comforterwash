"use client"

import { useState, useTransition } from "react"
import type { MarketingSettings } from "@/app/actions/marketing-settings"
import { setMarketingSettings } from "@/app/actions/marketing-settings"
import { sendSmsCampaign, getRecipientCount, type SmsCampaign } from "@/app/actions/sms-campaigns"
import type { ReferralStats } from "@/app/actions/referrals"
import type { Segment } from "@/lib/customer-segments"
import { SEGMENT_LABELS } from "@/lib/customer-segments"

const TABS = ["Campaigns", "Abandoned Cart", "Re-Engagement", "Referrals"] as const
type Tab = typeof TABS[number]

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8726A]"

export function MarketingClient({
  initialSettings, initialCampaigns, referralStats,
}: {
  initialSettings: MarketingSettings
  initialCampaigns: SmsCampaign[]
  referralStats: ReferralStats
}) {
  const [tab, setTab] = useState<Tab>("Campaigns")
  const [settings, setSettings] = useState(initialSettings)
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function save() {
    startTransition(async () => {
      await setMarketingSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t ? "border-[#E8726A] text-[#0D2240]" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Campaigns" && <CampaignsTab campaigns={campaigns} setCampaigns={setCampaigns} promoCode={settings.abandonedCartPromoCode} />}

      {tab === "Abandoned Cart" && (
        <SettingsCard title="⚡ Abandoned Cart Recovery" desc="Automatically text customers who start a booking but don't finish it.">
          <label className="flex items-center gap-2 text-sm font-bold text-[#0D2240] mb-4">
            <input type="checkbox" checked={settings.abandonedCartEnabled} onChange={e => setSettings(s => ({ ...s, abandonedCartEnabled: e.target.checked }))} className="rounded" />
            Enable abandoned-cart recovery texts
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Field label="Wait before texting (hours)">
              <input type="number" min={1} max={48} value={settings.abandonedCartDelayHours} onChange={e => setSettings(s => ({ ...s, abandonedCartDelayHours: parseInt(e.target.value || "2", 10) }))} className={inputCls} />
            </Field>
            <Field label="Promo code to reference (optional)">
              <input value={settings.abandonedCartPromoCode} onChange={e => setSettings(s => ({ ...s, abandonedCartPromoCode: e.target.value.toUpperCase() }))} placeholder="COMEBACK10" className={inputCls} />
            </Field>
          </div>
          <Field label="Message (use {name} and {code})">
            <textarea rows={3} value={settings.abandonedCartMessage} onChange={e => setSettings(s => ({ ...s, abandonedCartMessage: e.target.value }))} className={inputCls} />
          </Field>
          <p className="text-[10px] text-gray-400 mt-2">Checked automatically every 2 hours. Create the promo code itself under Promotions first.</p>
          <SaveButton onClick={save} isPending={isPending} saved={saved} />
        </SettingsCard>
      )}

      {tab === "Re-Engagement" && (
        <SettingsCard title="🔁 Automated Re-Engagement" desc="Auto-text dormant and at-risk customers to win them back — fully on autopilot.">
          <label className="flex items-center gap-2 text-sm font-bold text-[#0D2240] mb-4">
            <input type="checkbox" checked={settings.reengagementEnabled} onChange={e => setSettings(s => ({ ...s, reengagementEnabled: e.target.checked }))} className="rounded" />
            Enable automated re-engagement texts
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Field label="Consider dormant after (days)">
              <input type="number" min={14} value={settings.reengagementDormantDays} onChange={e => setSettings(s => ({ ...s, reengagementDormantDays: parseInt(e.target.value || "60", 10) }))} className={inputCls} />
            </Field>
            <Field label="Don't re-text more often than (days)">
              <input type="number" min={7} value={settings.reengagementIntervalDays} onChange={e => setSettings(s => ({ ...s, reengagementIntervalDays: parseInt(e.target.value || "30", 10) }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Message (use {name})">
            <textarea rows={3} value={settings.reengagementMessage} onChange={e => setSettings(s => ({ ...s, reengagementMessage: e.target.value }))} className={inputCls} />
          </Field>
          <p className="text-[10px] text-gray-400 mt-2">Runs once daily, capped at 200 texts per run per city.</p>
          <SaveButton onClick={save} isPending={isPending} saved={saved} />
        </SettingsCard>
      )}

      {tab === "Referrals" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Referred Customers" value={referralStats.totalReferrals.toString()} />
            <Stat label="Credit Granted" value={`$${(referralStats.totalCreditGrantedCents / 100).toFixed(2)}`} />
            <Stat label="Credit Redeemed" value={`$${(referralStats.totalCreditRedeemedCents / 100).toFixed(2)}`} />
            <Stat label="Outstanding" value={`$${(referralStats.totalCreditOutstandingCents / 100).toFixed(2)}`} />
          </div>
          <SettingsCard title="🎁 Referral Program" desc="Every customer gets a unique code from the Customers page. When a friend books using it, they get a discount and the referrer earns credit.">
            <label className="flex items-center gap-2 text-sm font-bold text-[#0D2240] mb-4">
              <input type="checkbox" checked={settings.referralEnabled} onChange={e => setSettings(s => ({ ...s, referralEnabled: e.target.checked }))} className="rounded" />
              Enable the referral program
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Field label="New customer's discount">
                <CentsInput cents={settings.referralRefereeCreditCents} onChange={c => setSettings(s => ({ ...s, referralRefereeCreditCents: c }))} />
              </Field>
              <Field label="Referrer's reward (per referral)">
                <CentsInput cents={settings.referralReferrerCreditCents} onChange={c => setSettings(s => ({ ...s, referralReferrerCreditCents: c }))} />
              </Field>
              <Field label="Credit expires after (days)">
                <input type="number" min={1} value={settings.referralCreditExpiresDays} onChange={e => setSettings(s => ({ ...s, referralCreditExpiresDays: parseInt(e.target.value || "90", 10) }))} className={inputCls} />
              </Field>
              <Field label="Monthly cap per referrer">
                <CentsInput cents={settings.referralMonthlyCapCents} onChange={c => setSettings(s => ({ ...s, referralMonthlyCapCents: c }))} />
              </Field>
            </div>
            <p className="text-[10px] text-gray-400">
              Customers enter a friend's code in the promo code field at checkout — same box, no extra step. Find and share codes from the Customers page.
            </p>
            <SaveButton onClick={save} isPending={isPending} saved={saved} />
          </SettingsCard>
        </div>
      )}
    </div>
  )
}

function CampaignsTab({ campaigns, setCampaigns, promoCode }: { campaigns: SmsCampaign[]; setCampaigns: (c: SmsCampaign[]) => void; promoCode: string }) {
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [segment, setSegment] = useState<Segment | "all">("all")
  const [code, setCode] = useState(promoCode || "")
  const [count, setCount] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ sent?: number; failed?: number; error?: string } | null>(null)

  function preview(seg: Segment | "all") {
    setSegment(seg)
    setCount(null)
    startTransition(async () => setCount(await getRecipientCount(seg)))
  }

  function send() {
    if (!name.trim() || !message.trim()) return
    startTransition(async () => {
      const res = await sendSmsCampaign({ name, message, segment, promoCode: code || undefined })
      setResult(res)
      if (!res.error) {
        setCampaigns([
          { id: Date.now().toString(), name, message, segment, promo_code: code || null, recipient_count: count ?? 0, sent_count: res.sent ?? 0, failed_count: res.failed ?? 0, status: "sent", created_at: new Date().toISOString(), sent_at: new Date().toISOString() },
          ...campaigns,
        ])
        setName(""); setMessage("")
      }
    })
  }

  return (
    <div className="space-y-6">
      <SettingsCard title="📣 New Campaign" desc="Compose a message and send it to a customer segment right now.">
        <Field label="Campaign name (internal)">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Labor Day sale" className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <Field label="Send to">
            <select value={segment} onChange={e => preview(e.target.value as Segment | "all")} className={inputCls}>
              <option value="all">All customers</option>
              {(Object.keys(SEGMENT_LABELS) as Segment[]).map(s => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">{count !== null ? `${count} customers with SMS enabled` : "Select to preview recipient count"}</p>
          </Field>
          <Field label="Promo code to mention (optional)">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SAVE20" className={inputCls} />
          </Field>
        </div>
        <Field label="Message (use {name} and {code})">
          <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi {name}! Enjoy 20% off your next order with code {code}." className={inputCls} />
        </Field>
        <div className="flex items-center gap-4 mt-4">
          <button onClick={send} disabled={isPending || !name.trim() || !message.trim()} className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-60">
            {isPending ? "Sending…" : "Send Now"}
          </button>
          {result && !result.error && <span className="text-green-600 text-sm font-semibold">✓ Sent to {result.sent}{result.failed ? `, ${result.failed} failed` : ""}</span>}
          {result?.error && <span className="text-red-600 text-sm font-semibold">{result.error}</span>}
        </div>
      </SettingsCard>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-extrabold text-[#0D2240] text-sm">Campaign History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3">Name</th><th className="px-4 py-3">Segment</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Failed</th><th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#0D2240]">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.segment}</td>
                  <td className="px-4 py-3">{c.sent_count}</td>
                  <td className="px-4 py-3">{c.failed_count}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">No campaigns sent yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SettingsCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-extrabold text-[#0D2240] text-base mb-1">{title}</h2>
      <p className="text-xs text-gray-400 mb-5">{desc}</p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-extrabold text-[#0D2240]">{value}</p>
    </div>
  )
}

function CentsInput({ cents, onChange }: { cents: number; onChange: (c: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
      <input
        type="number" step="0.01" min={0}
        value={(cents / 100).toFixed(2)}
        onChange={e => onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
        className={inputCls + " pl-7"}
      />
    </div>
  )
}

function SaveButton({ onClick, isPending, saved }: { onClick: () => void; isPending: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-4 mt-4">
      <button onClick={onClick} disabled={isPending} className="bg-[#0D2240] hover:bg-[#142d52] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-60">
        {isPending ? "Saving…" : "Save Settings"}
      </button>
      {saved && <span className="text-green-600 text-sm font-semibold">✓ Saved</span>}
    </div>
  )
}
