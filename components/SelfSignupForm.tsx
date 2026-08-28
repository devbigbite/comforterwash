"use client"
import { useActionState, useState, useEffect, useRef } from "react"
import { startSelfSignup, checkSlugAvailable } from "@/app/actions/self-signup"

const initialState: { url?: string; error?: string } = {}
const inp = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#0D2240] focus:outline-none focus:ring-2 focus:ring-[#E8726A]/30 bg-white"

function slugPreview(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
}

export function SelfSignupForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => startSelfSignup(formData),
    initialState,
  )
  const [slugInput, setSlugInput] = useState("")
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const preview = slugPreview(slugInput)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!preview || preview.length < 3) { setSlugStatus("idle"); return }
    setSlugStatus("checking")
    debounceRef.current = setTimeout(async () => {
      const res = await checkSlugAvailable(preview)
      setSlugStatus(res.available ? "available" : "taken")
      setSuggestion(res.suggestion ?? null)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [preview])

  // Redirect to Stripe once we get a URL back
  useEffect(() => {
    if (state.url) window.location.href = state.url
  }, [state.url])

  return (
    <form action={formAction} className="space-y-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Business Name</label>
        <input name="business_name" required placeholder="Sunshine Laundry Co." className={inp} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Choose Your Subdomain</label>
        <div className="flex items-center gap-2">
          <input
            name="slug"
            required
            placeholder="sunshine"
            value={slugInput}
            onChange={e => setSlugInput(e.target.value)}
            className={inp}
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">.washfoldclean.com</span>
        </div>
        {preview.length >= 3 && (
          <p className="text-xs mt-0.5">
            {slugStatus === "checking" && <span className="text-gray-400">Checking availability…</span>}
            {slugStatus === "available" && <span className="text-green-600 font-semibold">✓ {preview}.washfoldclean.com is available</span>}
            {slugStatus === "taken" && (
              <span className="text-red-500 font-semibold">
                ✕ Taken{suggestion ? ` — try "${suggestion}"` : ""}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Your Name</label>
          <input name="contact_name" required placeholder="Jamie Rivera" className={inp} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Phone</label>
          <input name="contact_phone" type="tel" placeholder="(407) 555-0100" className={inp} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Email</label>
        <input name="contact_email" type="email" required placeholder="jamie@sunshinelaundry.com" className={inp} />
      </div>

      {state.error && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          ⚠️ {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || slugStatus === "taken"}
        className="w-full text-sm font-bold text-white bg-[#0D2240] hover:bg-[#16305c] px-6 py-3.5 rounded-xl transition-colors uppercase tracking-wide disabled:opacity-50"
      >
        {pending ? "Redirecting to checkout…" : "Continue to Payment →"}
      </button>
    </form>
  )
}
