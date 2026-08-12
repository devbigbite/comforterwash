"use client"

import { useState, useTransition } from "react"
import {
  createOrderIssueNote,
  deleteOrderIssueNote,
  sendOrderIssueNote,
  type OrderIssueNote,
} from "@/app/actions/order-issue-notes"

// Lets staff flag a detail/issue about this specific order — a stain, a
// missing item, damage — write it up, review it, and then explicitly send
// it to the customer by email + SMS. Nothing goes out automatically; a
// note sits as a Draft until someone clicks Send. Separate from the
// automated pickup/delivery lifecycle notifications and from the internal
// order_events audit trail (which the customer never sees).
export function OrderIssueNotesPanel({
  bookingId,
  initialNotes,
  hasEmail,
  hasPhone,
}: {
  bookingId: string
  initialNotes: OrderIssueNote[]
  hasEmail: boolean
  hasPhone: boolean
}) {
  const [notes, setNotes] = useState<OrderIssueNote[]>(initialNotes)
  const [draftText, setDraftText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sendingId, setSendingId] = useState<string | null>(null)

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draftText.trim()
    if (!trimmed) return
    setError(null)

    startTransition(async () => {
      const result = await createOrderIssueNote(bookingId, trimmed)
      if (result.error) {
        setError(result.error)
        return
      }
      setNotes(prev => [{
        id: crypto.randomUUID(),
        booking_id: bookingId,
        note: trimmed,
        status: "draft",
        created_by: "admin",
        created_at: new Date().toISOString(),
        sent_at: null,
        sent_by: null,
        sent_email: false,
        sent_sms: false,
      }, ...prev])
      setDraftText("")
    })
  }

  async function handleSend(noteId: string) {
    setSendingId(noteId)
    setError(null)
    const result = await sendOrderIssueNote(noteId)
    setSendingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setNotes(prev => prev.map(n => n.id === noteId
      ? { ...n, status: "sent", sent_at: new Date().toISOString(), sent_email: !!result.sentEmail, sent_sms: !!result.sentSms }
      : n))
  }

  async function handleDelete(noteId: string) {
    const result = await deleteOrderIssueNote(noteId, bookingId)
    if (result.error) {
      setError(result.error)
      return
    }
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-[#0D2240] text-sm uppercase tracking-wide">📝 Customer Notes</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Flag a stain, missing item, damage, or other detail about this order. Nothing sends until you click Send.
      </p>

      <form onSubmit={handleAdd} className="mb-5 space-y-2">
        <textarea
          value={draftText}
          onChange={e => setDraftText(e.target.value)}
          placeholder="e.g. Found a small stain on the white comforter that didn't fully come out — mentioning so it's not a surprise."
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#0D2240] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30"
        />
        {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
        <button
          type="submit"
          disabled={isPending || !draftText.trim()}
          className="px-4 py-2 rounded-lg bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white text-xs font-bold transition-colors"
        >
          {isPending ? "Saving…" : "Save as Draft"}
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">No notes on this order yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="rounded-xl bg-[#f7f8fb] border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  note.status === "sent" ? "bg-green-50 text-green-700 border border-green-100" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {note.status === "sent" ? "✓ Sent" : "Draft"}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(note.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>

              <p className="text-sm text-[#0D2240] whitespace-pre-wrap">{note.note}</p>

              {note.status === "sent" ? (
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Sent via {[note.sent_email && "email", note.sent_sms && "SMS"].filter(Boolean).join(" + ") || "—"}
                  {note.sent_at && ` · ${new Date(note.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                </p>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleSend(note.id)}
                    disabled={sendingId === note.id || (!hasEmail && !hasPhone)}
                    title={!hasEmail && !hasPhone ? "Customer has no email or phone on file" : "Send this note to the customer"}
                    className="px-3 py-1.5 rounded-lg bg-[#E8726A] hover:bg-[#d45f57] disabled:opacity-40 text-white text-[10px] font-bold transition-colors"
                  >
                    {sendingId === note.id ? "Sending…" : `Send to Customer (${[hasEmail && "email", hasPhone && "SMS"].filter(Boolean).join(" + ")})`}
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 text-[10px] font-bold transition-colors"
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
