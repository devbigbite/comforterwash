import { superAdminLoginAction } from "./actions"

export const metadata = { title: "Super Admin Login — WashFold" }

export default function SuperAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wider mb-3">
            Super Admin
          </span>
          <h1 className="text-2xl font-bold text-slate-900">WashFold Platform</h1>
          <p className="text-sm text-slate-500 mt-1">Platform management access</p>
        </div>

        <form action={superAdminLoginAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Super Admin Password
            </label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
