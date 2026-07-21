import Link from "next/link"

export const metadata = { title: "Super Admin — WashFold Platform" }

// Auth gating for /super-admin now lives in middleware.ts (so the login
// page itself isn't wrapped by the same check that redirects to it — that
// caused an ERR_TOO_MANY_REDIRECTS loop). This layout is just UI chrome.
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
              Super Admin
            </span>
            <Link href="/super-admin" className="text-lg font-bold text-slate-900 hover:text-indigo-600 transition-colors">
              WashFold Platform
            </Link>
            <nav className="flex items-center gap-1 ml-2">
              <Link href="/super-admin" className="text-sm text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                Locations
              </Link>
              <Link href="/super-admin/outreach" className="text-sm text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                📋 Outreach
              </Link>
            </nav>
          </div>
          <span className="text-sm text-slate-500">Super Admin</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
