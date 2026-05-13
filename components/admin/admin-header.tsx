import { LogOut, ChevronDown } from "lucide-react"
import { logoutAction } from "@/app/admin/login/actions"

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavLink = { href: string; label: string; external?: boolean }
type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "dropdown"; label: string; items: NavLink[] }

const NAV_ITEMS: NavItem[] = [
  {
    type: "link",
    href: "/admin/dispatch",
    label: "Dispatch",
  },
  {
    type: "link",
    href: "/admin/search",
    label: "Search",
  },
  {
    type: "dropdown",
    label: "Customers",
    items: [
      { href: "/admin/subscriptions", label: "Subscriptions" },
    ],
  },
  {
    type: "dropdown",
    label: "Logistics",
    items: [
      { href: "/admin/facility",      label: "🏭 Facility Board" },
      { href: "/admin/runs",         label: "Facility Transfers" },
      { href: "/admin/routes",       label: "Delivery Routes" },
      { href: "/admin/routing",      label: "Route Optimizer" },
      { href: "/admin/facilities",   label: "Facilities" },
      { href: "/admin/zip-codes",    label: "Zip Codes" },
      { href: "/admin/service-area", label: "Area Map" },
      { href: "/admin/holidays",     label: "Holidays" },
    ],
  },
  {
    type: "dropdown",
    label: "Finance",
    items: [
      { href: "/admin/reports", label: "Reports" },
      { href: "/admin/pricing", label: "Pricing" },
      { href: "/admin/tips",    label: "Tips" },
    ],
  },
  {
    type: "dropdown",
    label: "Content",
    items: [
      { href: "/admin/promos",    label: "Promotions" },
      { href: "/admin/images",    label: "Site Images" },
      { href: "/admin/templates", label: "Email Templates" },
      { href: "/admin/docs",      label: "Docs & FAQ" },
    ],
  },
  {
    type: "link",
    href: "/admin/settings",
    label: "Settings",
  },
  {
    type: "dropdown",
    label: "Staff",
    items: [
      { href: "/admin/workers",  label: "Workers" },
      { href: "/admin/schedule", label: "Schedule" },
      { href: "/staff",          label: "Staff Clock" },
      { href: "/driver",         label: "Driver App →", external: true },
      { href: "/operator",       label: "Operator App →", external: true },
    ],
  },
]

// ── Dropdown component ────────────────────────────────────────────────────────

function Dropdown({ label, items }: { label: string; items: NavLink[] }) {
  return (
    <div className="relative group">
      {/* Trigger */}
      <button className="flex items-center gap-1 text-white/60 hover:text-white text-sm font-medium transition-colors py-1 whitespace-nowrap">
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-150 group-hover:rotate-180" />
      </button>

      {/* Dropdown panel — pt-2 fills the gap so hover isn't lost */}
      <div className="absolute top-full left-0 pt-2 hidden group-hover:block z-50">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 min-w-[170px] overflow-hidden">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 text-sm transition-colors whitespace-nowrap ${
                item.external
                  ? "text-gray-400 hover:text-[#E8726A] hover:bg-[#E8726A]/5"
                  : "text-[#0D2240] hover:text-[#E8726A] hover:bg-[#E8726A]/5"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

export function AdminHeader() {
  return (
    <header className="bg-[#0D2240] px-6 py-0 flex items-stretch min-h-[52px]">
      {/* Logo */}
      <a
        href="/admin"
        className="flex items-center gap-2.5 group pr-6 border-r border-white/10 mr-6 shrink-0"
      >
        <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="24" fill="#0D2240" />
          <circle cx="24" cy="24" r="22" fill="#142d52" />
          <path
            d="M8 24 Q11 19 14 24 Q17 29 20 24 Q23 19 26 24 Q29 29 32 24 Q35 19 38 24"
            stroke="#E8726A" strokeWidth="3" strokeLinecap="round" fill="none"
          />
        </svg>
        <span className="text-white font-extrabold text-base tracking-tight group-hover:opacity-80 transition-opacity">
          Wash<span className="text-[#E8726A]">Fold</span>
          <span className="ml-1.5 text-white/30 text-[10px] font-semibold uppercase tracking-widest">Admin</span>
        </span>
      </a>

      {/* Nav */}
      <nav className="flex items-center gap-5 flex-1 flex-wrap">
        {NAV_ITEMS.map((item, i) =>
          item.type === "link" ? (
            <a
              key={i}
              href={item.href}
              className="text-white/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap py-1"
            >
              {item.label}
            </a>
          ) : (
            <Dropdown key={i} label={item.label} items={item.items} />
          )
        )}
      </nav>

      {/* Sign out */}
      <div className="flex items-center pl-4 border-l border-white/10 ml-4 shrink-0">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
  