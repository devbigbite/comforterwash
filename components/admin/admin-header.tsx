import { LogOut } from "lucide-react"
import { logoutAction } from "@/app/admin/login/actions"

const NAV_LINKS = [
  { href: "/admin/dispatch",      label: "Dispatch" },
  { href: "/admin/search",        label: "Search" },
  { href: "/admin/workers",       label: "Workers" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/routes",        label: "Routes" },
  { href: "/admin/promos",        label: "Promotions" },
  { href: "/admin/holidays",      label: "Holidays" },
  { href: "/admin/reports",       label: "Reports" },
  { href: "/admin/pricing",       label: "Pricing" },
  { href: "/admin/images",        label: "Images" },
  { href: "/admin/tips",          label: "Tips" },
  { href: "/admin/facilities",    label: "Facilities" },
  { href: "/admin/zip-codes",     label: "Areas" },
  { href: "/admin/service-area",  label: "Area Map" },
  { href: "/operator",            label: "Operator →" },
]

export function AdminHeader() {
  return (
    <header className="bg-[#0D2240] px-6 py-4 flex items-center justify-between">
      <a href="/admin" className="flex items-center gap-2.5 group">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="24" fill="#0D2240" />
          <circle cx="24" cy="24" r="22" fill="#142d52" />
          <path d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
            stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        <span className="text-white font-extrabold text-lg tracking-tight group-hover:opacity-80 transition-opacity">
          Wash<span className="text-[#E8726A]">Fold</span>
          <span className="ml-1.5 text-white/40 text-xs font-semibold uppercase tracking-widest">Admin</span>
        </span>
      </a>

      <div className="flex items-center gap-4 flex-wrap">
        {NAV_LINKS.map(link => (
          <a key={link.href} href={link.href}
            className="text-white/60 hover:text-white text-sm transition-colors whitespace-nowrap">
            {link.label}
          </a>
        ))}
        <form action={logoutAction}>
          <button type="submit"
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
