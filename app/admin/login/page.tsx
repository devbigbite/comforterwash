import { loginAction } from "./actions"
import { MagicLinkForm } from "./magic-link-form"

export default function LoginPage({ searchParams }: { searchParams: { error?: string; wfo?: string } }) {
  const hasError  = searchParams?.error === "1"
  const isLocked  = searchParams?.error === "locked"
  // Legacy password login is Orlando-only (see actions.ts) and irrelevant to
  // every other tenant — showing it by default just confuses new admins who
  // have no password and don't need one. Hidden unless ?wfo=1, reached via
  // the discreet "wfo" link in the footer that only Orlando staff know to
  // look for.
  const showPassword = searchParams?.wfo === "1"

  return (
    <main className="min-h-screen bg-[#0f2057] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="#1e40af" />
            <path d="M7 20.5 Q10.5 15 14 20.5 Q17.5 26 21 20.5 Q24.5 15 28 20.5 Q29.5 23 31 20.5"
              stroke="#67e8f9" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          </svg>
          <span className="text-white font-extrabold text-xl tracking-tight">
            Wash<span className="text-[#67e8f9]">Fold</span>
            <span className="ml-1.5 text-white/40 text-xs font-semibold uppercase tracking-widest">Admin</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-extrabold text-[#1e3a8a] mb-1">Sign in</h1>
          <p className="text-gray-400 text-sm mb-6">Get a one-time sign-in link sent to your email</p>

          <MagicLinkForm />

          {showPassword && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px bg-gray-100 flex-1" />
                <span className="text-xs text-gray-300 font-semibold uppercase tracking-wide">or</span>
                <div className="h-px bg-gray-100 flex-1" />
              </div>

              <p className="text-gray-400 text-xs mb-3">Legacy password (WashFold Orlando only)</p>

              <form action={loginAction} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoFocus
                    disabled={isLocked}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter password"
                  />
                </div>

                {hasError && (
                  <p className="text-sm text-red-600 font-medium">Incorrect password. Try again.</p>
                )}
                {isLocked && (
                  <p className="text-sm text-red-600 font-medium">
                    Too many failed attempts. Please wait 15 minutes before trying again.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLocked}
                  className="w-full bg-[#1e3a8a] text-white font-bold py-3 rounded-xl hover:bg-[#1e40af] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign In →
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Ordinary-looking footer strip — the password-login link lives here
          as one more piece of routine small print rather than the only
          thing below the card, which was too eye-catching and tempted
          people to click it out of curiosity. */}
      <footer className="border-t border-white/10 py-4 px-4">
        <p className="text-center text-[11px] text-white/25">
          © {new Date().getFullYear()} WashFold Platform · Support ·{" "}
          <a
            href={showPassword ? "/admin/login" : "/admin/login?wfo=1"}
            className="hover:text-white/45 transition-colors"
          >
            wfo
          </a>
        </p>
      </footer>
    </main>
  )
}
