"use client"

import { useState, useTransition } from "react"
import { changeOwnPassword } from "./actions"

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (newPassword.length < 8) {
      setMessage({ type: "err", text: "Password must be at least 8 characters." })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "err", text: "Passwords don't match." })
      return
    }

    startTransition(async () => {
      const result = await changeOwnPassword(newPassword)
      if (result.error) {
        setMessage({ type: "err", text: result.error })
        return
      }
      setMessage({ type: "ok", text: "Password updated." })
      setNewPassword("")
      setConfirmPassword("")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] text-sm transition"
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] text-sm transition"
          placeholder="Re-enter new password"
        />
      </div>

      {message && (
        <p className={`text-sm font-medium ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#1e3a8a] text-white font-bold py-3 rounded-xl hover:bg-[#1e40af] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  )
}
