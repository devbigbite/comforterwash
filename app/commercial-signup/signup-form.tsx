"use client"

import { useActionState } from "react"

type SignupResult = { error?: string } | undefined

export function CommercialSignupForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | undefined>
}) {
  const [state, formAction, pending] = useActionState<SignupResult, FormData>(
    async (_prev, formData) => action(formData),
    undefined
  )

  const inp = "rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 w-full"

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Business Name *</label>
        <input name="business_name" required placeholder="Sunrise Diner" className={inp} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Name</label>
          <input name="contact_name" placeholder="Maria Rodriguez" className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</label>
          <input name="contact_phone" type="tel" placeholder="(407) 555-0100" className={inp} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Email *</label>
        <input name="contact_email" type="email" required placeholder="ap@sunrisediner.com" className={inp} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pickup Address</label>
        <input name="address" placeholder="123 Main St, Orlando FL" className={inp} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pickup &amp; Access Instructions (optional)</label>
        <textarea name="access_instructions" rows={2} placeholder="Which entrance to use, loading area, gate code, ask for…" className={`${inp} resize-none`} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes (optional)</label>
        <input name="notes" placeholder="Estimated volume, preferred pickup days…" className={inp} />
      </div>

      {/* Wash preferences — applied to every order generated for this
          account (manual or recurring) so staff never has to guess or ask
          again per order. Optional at signup since staff can always fill
          these in later from the admin side if the business skips them. */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Detergent Preference (optional)</label>
        <input name="detergent" placeholder="e.g. Free & Clear, Original Scent…" className={inp} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Add-ons (optional)</label>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-[#0D2240]">
            <input type="checkbox" name="fabric_softener" className="rounded border-gray-300" />
            Fabric Softener
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0D2240]">
            <input type="checkbox" name="oxi_clean" className="rounded border-gray-300" />
            OxiClean
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0D2240]">
            <input type="checkbox" name="color_safe_bleach" className="rounded border-gray-300" />
            Color-Safe Bleach
          </label>
        </div>
      </div>

      {state?.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#E8726A] text-white font-bold text-sm px-6 py-3 hover:bg-[#d45f57] transition-colors disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Continue to Agreement →"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Next you&apos;ll review and sign a short service agreement and add a payment method — no charge happens until your first order is weighed.
      </p>
    </form>
  )
}
