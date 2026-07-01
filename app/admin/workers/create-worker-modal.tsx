"use client"

import { useRef, useState, useTransition } from "react"
import { createWorkerManually } from "@/app/actions/workers"

export function CreateWorkerModal() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createWorkerManually(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        formRef.current?.reset()
        setOpen(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold text-white bg-[#0D2240] px-4 py-2 rounded-full hover:bg-[#1a3a5c] transition-colors uppercase tracking-wide"
      >
        + Add Staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
            <div className="mb-5">
              <h2 className="text-lg font-extrabold text-[#0D2240]">Add Staff Manually</h2>
              <p className="text-xs text-gray-400 mt-0.5">Creates an approved worker, skipping the application flow.</p>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block mb-1">Full Name *</label>
                <input
                  name="name" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0D2240]"
                  placeholder="Jane Smith"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block mb-1">Email *</label>
                <input
                  name="email" type="email" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0D2240]"
                  placeholder="jane@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block mb-1">Phone</label>
                <input
                  name="phone" type="tel"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0D2240]"
                  placeholder="(407) 555-0100"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block mb-1">Address</label>
                <input
                  name="address"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0D2240]"
                  placeholder="123 Main St, Orlando, FL"
                />
              </div>

              {/* Roles */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block mb-2">Roles *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="role_driver" className="rounded" />
                    <span>🚐 Driver</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="role_operator" className="rounded" />
                    <span>🧺 Operator</span>
                  </label>
                </div>
              </div>

              {/* Has vehicle */}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="has_vehicle" className="rounded" />
                <span className="text-gray-600">Has their own vehicle</span>
              </label>

              {/* Notes */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block mb-1">Notes (optional)</label>
                <textarea
                  name="experience" rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0D2240] resize-none"
                  placeholder="Any relevant background or notes…"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 font-semibold">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-gray-200 text-gray-500 text-xs font-bold py-2.5 rounded-xl hover:border-gray-400 transition-colors uppercase tracking-wide"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl transition-colors uppercase tracking-wide"
                >
                  {isPending ? "Adding…" : "Add Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
