"use client"

import { useActionState } from "react"

type SignResult = { error?: string; success?: boolean }

export function SignAgreementForm({
  code,
  action,
}: {
  code: string
  action: (formData: FormData) => Promise<SignResult>
}) {
  const [state, formAction, pending] = useActionState<SignResult, FormData>(
    async (_prev, formData) => action(formData),
    {}
  )

  if (state.success) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
        <p className="font-bold text-green-700">✅ Agreement signed successfully!</p>
        <p className="text-sm text-green-700/80 mt-1">Thank you — we&apos;ll be in touch to confirm your service schedule.</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="code" value={code} />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Type your full name to sign *</label>
        <input
          name="signed_name"
          required
          placeholder="Jane Smith"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 w-full"
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" name="agreed" required className="mt-0.5 rounded" />
        <span>I have read and agree to the terms of this Commercial Laundry Service Agreement, and I am authorized to sign on behalf of this business.</span>
      </label>

      {state.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#E8726A] text-white font-bold text-sm px-6 py-3 hover:bg-[#d45f57] transition-colors disabled:opacity-50"
      >
        {pending ? "Signing…" : "Sign Agreement"}
      </button>
    </form>
  )
}
