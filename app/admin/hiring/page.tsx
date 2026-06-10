import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function HiringHubPage() {
  const supabase = createAdminClient()

  const { data: counts } = await supabase
    .from("workers")
    .select("status, created_at")

  const tally = { pending: 0, approved: 0, active: 0, rejected: 0 }
  counts?.forEach((w) => {
    if (w.status === "pending")  tally.pending++
    if (w.status === "approved") tally.approved++
    if (w.status === "active")   tally.active++
    if (w.status === "rejected") tally.rejected++
  })

  // Last 3 applicants
  const { data: recent } = await supabase
    .from("workers")
    .select("id, name, roles, status, created_at, ic_agreement_role")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(3)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Hiring</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage applications, agreements, and onboarding</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Pending Review", value: tally.pending,  color: "text-amber-500",  bg: "#fffbeb", href: "/admin/workers?tab=pending" },
          { label: "Approved",       value: tally.approved, color: "text-blue-600",   bg: "#eff6ff", href: "/admin/workers?tab=all" },
          { label: "Active",         value: tally.active,   color: "text-green-600",  bg: "#f0fdf4", href: "/admin/workers?tab=active" },
          { label: "Rejected",       value: tally.rejected, color: "text-red-400",    bg: "#fef2f2", href: "/admin/workers?tab=all" },
        ].map((s) => (
          <Link key={s.label} href={s.href}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-all group">
            <div className="rounded-xl p-2.5 shrink-0" style={{ background: s.bg }}>
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            </div>
            <div className="text-xs text-gray-400 font-semibold leading-tight">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">

        {/* Candidate queue */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-extrabold text-[#0D2240] text-base">Candidate Queue</h2>
              <p className="text-xs text-gray-400 mt-0.5">Applications waiting for your review</p>
            </div>
            <Link href="/admin/workers?tab=pending"
              className="text-xs font-bold text-[#E8726A] border border-[#E8726A]/30 px-3 py-1.5 rounded-lg hover:bg-[#fdf6f3] transition-colors">
              View all →
            </Link>
          </div>

          {!recent || recent.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl text-gray-300 text-sm">
              No pending applications
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((w) => (
                <Link key={w.id} href={`/admin/workers?tab=pending`}
                  className="flex items-center justify-between gap-3 bg-gray-50 hover:bg-amber-50 rounded-xl px-4 py-3 border border-gray-100 hover:border-amber-200 transition-all group">
                  <div>
                    <p className="font-semibold text-[#0D2240] text-sm">{w.name}</p>
                    <p className="text-xs text-gray-400">{w.ic_agreement_role ?? (w.roles ?? []).join(", ")}</p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                    Pending
                  </span>
                </Link>
              ))}
              {tally.pending > 3 && (
                <p className="text-center text-xs text-gray-400 pt-1">
                  +{tally.pending - 3} more waiting
                </p>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-50">
            <a href="/apply" target="_blank"
              className="flex items-center justify-center gap-2 w-full text-xs font-bold text-[#0D2240] border border-gray-200 px-4 py-2.5 rounded-xl hover:border-[#0D2240] transition-colors">
              View Apply Page ↗
            </a>
          </div>
        </div>

        {/* IC Agreements */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-extrabold text-[#0D2240] text-base">IC Agreements</h2>
              <p className="text-xs text-gray-400 mt-0.5">Edit the contracts shown to applicants</p>
            </div>
            <Link href="/admin/hiring/agreements"
              className="text-xs font-bold text-[#E8726A] border border-[#E8726A]/30 px-3 py-1.5 rounded-lg hover:bg-[#fdf6f3] transition-colors">
              Manage →
            </Link>
          </div>

          <div className="space-y-2">
            {[
              { role: "driver",   label: "Driver",                    icon: "🚐" },
              { role: "operator", label: "Washing Operator",           icon: "🧺" },
              { role: "combo",    label: "Operator / Driver",          icon: "🚐🧺" },
            ].map((r) => (
              <Link key={r.role} href={`/admin/hiring/agreements?role=${r.role}`}
                className="flex items-center justify-between gap-3 bg-gray-50 hover:bg-blue-50 rounded-xl px-4 py-3 border border-gray-100 hover:border-blue-200 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{r.icon}</span>
                  <div>
                    <p className="font-semibold text-[#0D2240] text-sm">{r.label}</p>
                    <p className="text-xs text-gray-400">EN + ES versions</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                  Edit →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-50 text-xs text-gray-400 leading-relaxed">
            Changes take effect immediately — new applicants will see the updated text.
          </div>
        </div>

      </div>
    </div>
  )
}
