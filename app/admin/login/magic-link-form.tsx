"use client"

import { useState } from "react"
import { requestAdminMagicLink } from "./actions"

export function MagicLinkForm() {
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    const result = await requestAdminMagicLink(email)
    setSending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
        If <strong>{email}</strong> is an admin for this account, a sign-in link is on its way. Check your inbox.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="admin-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] text-sm transition"
          placeholder="you@company.com"
        />
      </div>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full bg-[#1e3a8a] text-white font-bold py-3 rounded-xl hover:bg-[#1e40af] transition-colors text-sm disabled:opacity-50"
      >
        {sending ? "Sending…" : "Email Me a Sign-In Link →"}
      </button>
    </form>
  )
}
