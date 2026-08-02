"use client"

// Per-lead activity timeline + quick actions — the "real way to interact
// with them" piece: log a call/note (which just needs to record that a
// human touched this lead) and send a genuine custom email without leaving
// the page. Both clear the stale-lead badge on the parent card, since both
// touch platform_demo_requests.updated_at under the hood.

import { useEffect, useState } from "react"
import {
  getDemoRequestActivities,
  logDemoRequestActivity,
  sendCustomEmailToLead,
  type DemoActivity,
} from "@/app/actions/platform-demo-activities"

const TYPE_LABEL: Record<string, string> = {
  note: "📝 Note",
  call: "📞 Call",
  email_sent: "✉️ Email",
  status_change: "🔄 Status",
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ActivityPanel({
  requestId, leadEmail, leadName, onTouched,
}: {
  requestId: string
  leadEmail: string
  leadName: string
  onTouched: () => void
}) {
  const [activities, setActivities] = useState<DemoActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [noteBody, setNoteBody] = useState("")
  const [noteType, setNoteType] = useState<"note" | "call">("note")
  const [logging, setLogging] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [msg, setMsg] = useState("")

  async function load() {
    setLoading(true)
    setActivities(await getDemoRequestActivities(requestId))
    setLoading(false)
  }

  useEffect(() => { load() }, [requestId])

  async function handleLog() {
    if (!noteBody.trim()) return
    setLogging(true)
    const result = await logDemoRequestActivity(requestId, noteType, noteBody)
    setLogging(false)
    if (!result.error) {
      setNoteBody("")
      await load()
      onTouched()
    } else {
      setMsg(`Failed: ${result.error}`)
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    setMsg("")
    const result = await sendCustomEmailToLead({
      requestId, toEmail: leadEmail, toName: leadName, subject: emailSubject, body: emailBody,
    })
    setSendingEmail(false)
    if (result.error) {
      setMsg(`Failed: ${result.error}`)
    } else {
      setEmailSubject("")
      setEmailBody("")
      setShowEmailForm(false)
      await load()
      onTouched()
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
      {/* Timeline */}
      {loading ? (
        <p className="text-xs text-slate-300">Loading activity…</p>
      ) : activities.length === 0 ? (
        <p className="text-xs text-slate-300">No activity logged yet — this lead hasn't been touched since the demo email.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {activities.map(a => (
            <div key={a.id} className="text-xs flex items-start gap-2">
              <span className="text-slate-400 whitespace-nowrap shrink-0">{relativeTime(a.created_at)}</span>
              <span className="font-medium text-slate-500 whitespace-nowrap shrink-0">{TYPE_LABEL[a.type] ?? a.type}</span>
              {a.body && <span className="text-slate-600 whitespace-pre-wrap break-words">{a.body}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Log a note/call */}
      <div className="flex items-start gap-2">
        <select
          value={noteType}
          onChange={e => setNoteType(e.target.value as "note" | "call")}
          className="text-xs rounded-md border border-slate-300 px-1.5 py-1 shrink-0"
        >
          <option value="note">Note</option>
          <option value="call">Call</option>
        </select>
        <input
          value={noteBody}
          onChange={e => setNoteBody(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLog()}
          placeholder={noteType === "call" ? "What happened on the call?" : "Add a note…"}
          className="flex-1 text-xs rounded-md border border-slate-300 px-2 py-1 min-w-0"
        />
        <button
          onClick={handleLog}
          disabled={logging || !noteBody.trim()}
          className="text-xs font-semibold bg-slate-700 text-white rounded-md px-3 py-1 disabled:opacity-40 shrink-0"
        >
          Log
        </button>
      </div>

      {/* Send a real email */}
      {showEmailForm ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <input
            value={emailSubject}
            onChange={e => setEmailSubject(e.target.value)}
            placeholder="Subject"
            className="w-full text-xs rounded-md border border-slate-300 px-2 py-1.5"
          />
          <textarea
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            placeholder={`Hi ${leadName.split(" ")[0]}, ...`}
            rows={4}
            className="w-full text-xs rounded-md border border-slate-300 px-2 py-1.5"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
              className="text-xs font-semibold bg-indigo-600 text-white rounded-md px-3 py-1.5 disabled:opacity-40"
            >
              {sendingEmail ? "Sending…" : "Send Email"}
            </button>
            <button onClick={() => setShowEmailForm(false)} className="text-xs text-slate-400 px-2 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowEmailForm(true)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          ✉️ Write & send a custom email
        </button>
      )}

      {msg && <p className={`text-[11px] ${msg.startsWith("Failed") ? "text-red-500" : "text-green-600"}`}>{msg}</p>}
    </div>
  )
}
