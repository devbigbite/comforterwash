"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getBrandingSettings } from "@/app/actions/branding"

type Mode = "email" | "phone" | "google"
type PhoneStep = "input" | "verify"

export function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/account"
  const urlError = searchParams.get("error")

  const [mode, setMode] = useState<Mode>("email")
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("input")

  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")

  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(urlError === "auth_failed" ? "Authentication failed. Please try again." : "")

  const supabase = createClient()

  const [businessName, setBusinessName] = useState("Your Business")
  useEffect(() => {
    getBrandingSettings().then(b => setBusinessName(b.business_name))
  }, [])

  async function sendMagicLink() {
    if (!email) return
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/login/callback?next=${next}` },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  async function sendPhoneOtp() {
    if (!phone) return
    setLoading(true)
    setError("")
    const formatted = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)
    if (error) { setError(error.message); return }
    setPhoneStep("verify")
  }

  async function verifyPhoneOtp() {
    if (!otp) return
    setLoading(true)
    setError("")
    const formatted = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: "sms",
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    window.location.href = next
  }

  async function signInWithGoogle() {
    setLoading(true)
    setError("")
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login/callback?next=${next}` },
    })
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--brand-accent)] flex items-center justify-center text-3xl mx-auto mb-4">
            🧺
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--brand-primary)]">Sign in to WashFold</h1>
          <p className="text-sm text-gray-400 mt-1">Track orders · Rebook · Manage your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">

          {/* Mode tabs */}
          <div className="flex rounded-xl bg-[#f7f8fb] p-1 mb-6 gap-1">
            {(["email", "phone", "google"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setSent(false); setPhoneStep("input"); setError("") }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all capitalize ${
                  mode === m
                    ? "bg-white text-[var(--brand-primary)] shadow-sm"
                    : "text-gray-400 hover:text-[var(--brand-primary)]"
                }`}
              >
                {m === "email" ? "✉️ Email" : m === "phone" ? "📱 Phone" : "🔵 Google"}
              </button>
            ))}
          </div>

          {/* Email magic link */}
          {mode === "email" && (
            <div className="space-y-4">
              {sent ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">📬</div>
                  <p className="font-bold text-[var(--brand-primary)]">Check your email</p>
                  <p className="text-sm text-gray-400 mt-1">
                    We sent a magic link to <span className="font-semibold">{email}</span>. Click it to sign in — no password needed.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-4 text-xs text-gray-400 underline"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-[var(--brand-primary)] focus:outline-none focus:border-[var(--brand-accent)] transition-colors"
                    />
                  </div>
                  <button
                    onClick={sendMagicLink}
                    disabled={loading || !email}
                    className="w-full bg-[var(--brand-accent)] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-colors"
                  >
                    {loading ? "Sending…" : "Send Magic Link →"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Phone OTP */}
          {mode === "phone" && (
            <div className="space-y-4">
              {phoneStep === "input" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                      Phone number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendPhoneOtp()}
                      placeholder="(407) 555-0100"
                      className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-[var(--brand-primary)] focus:outline-none focus:border-[var(--brand-accent)] transition-colors"
                    />
                    <p className="text-xs text-gray-400 mt-1">US numbers — we'll add +1 automatically</p>
                  </div>
                  <button
                    onClick={sendPhoneOtp}
                    disabled={loading || !phone}
                    className="w-full bg-[var(--brand-accent)] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-colors"
                  >
                    {loading ? "Sending…" : "Send Code →"}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center mb-2">
                    <p className="text-sm text-gray-500">
                      Code sent to <span className="font-semibold text-[var(--brand-primary)]">{phone}</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                      6-digit code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && verifyPhoneOtp()}
                      placeholder="123456"
                      className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-2xl font-mono font-bold text-center text-[var(--brand-primary)] tracking-widest focus:outline-none focus:border-[var(--brand-accent)] transition-colors"
                    />
                  </div>
                  <button
                    onClick={verifyPhoneOtp}
                    disabled={loading || otp.length < 6}
                    className="w-full bg-[var(--brand-accent)] hover:bg-[#d45f57] disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-colors"
                  >
                    {loading ? "Verifying…" : "Verify & Sign In →"}
                  </button>
                  <button
                    onClick={() => { setPhoneStep("input"); setOtp("") }}
                    className="w-full text-xs text-gray-400 underline"
                  >
                    Change number
                  </button>
                </>
              )}
            </div>
          )}

          {/* Google */}
          {mode === "google" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 text-center">
                Sign in with your Google account — one tap, no password.
              </p>
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] font-bold py-3.5 rounded-2xl text-sm transition-all disabled:opacity-40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {loading ? "Redirecting…" : "Continue with Google"}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm text-red-500 text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}
        </div>

        {/* Back to home */}
        <p className="text-center mt-6 text-xs text-gray-400">
          <a href="/" className="hover:text-[var(--brand-primary)] transition-colors">← Back to {businessName}</a>
        </p>
      </div>
    </div>
  )
}

