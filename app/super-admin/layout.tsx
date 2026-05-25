import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import Link from "next/link"

export const metadata = { title: "Super Admin — WashFold Platform" }

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const superAdminAuth = cookieStore.get("super_admin_auth")

  if (superAdminAuth?.value !== "authenticated") {
    redirect("/super-admin/login")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
              Super Admin
            </span>
            <Link href="/super-admin" className="text-lg font-bold text-slate-900 hover:text-indigo-600 transition-colors">
              WashFold Platform
            </Link>
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
