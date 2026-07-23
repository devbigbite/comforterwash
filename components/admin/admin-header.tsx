import { LogOut, ChevronDown } from "lucide-react"
import { logoutAction } from "@/app/admin/login/actions"
import { AdminLangToggle } from "@/components/admin/admin-lang-toggle"
import { AdminViewToggle } from "@/components/admin/admin-view-toggle"
import { getAdminLang } from "@/app/actions/admin-lang"
import { getAdminViewMode } from "@/app/actions/branding"

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavLink = { href: string; label: string; external?: boolean }
type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "dropdown"; label: string; items: NavLink[] }

// Condensed nav for tenants who haven't opted into the full "Advanced" admin —
// just the handful of things a solo/home-based operator touches day to day.
// Everything here also exists in the Advanced nav; nothing is removed, only
// hidden until the tenant wants more.
function buildSimpleNav(lang: "en" | "es"): NavItem[] {
  const es = lang === "es"
  return [
    { type: "link", href: "/admin/dispatch",  label: es ? "Despacho" : "Dispatch" },
    { type: "link", href: "/admin/orders",     label: es ? "Órdenes" : "Orders" },
    { type: "link", href: "/admin/branding",   label: es ? "Mi Negocio" : "My Business" },
    { type: "link", href: "/admin/pricing",    label: es ? "Precios" : "Pricing" },
    { type: "link", href: "/admin/zip-codes",  label: es ? "Área de Servicio" : "Service Area" },
    { type: "link", href: "/admin/workers",    label: es ? "Trabajadores" : "Workers" },
    { type: "link", href: "/admin/settings",   label: es ? "Configuración" : "Settings" },
  ]
}

function buildNav(lang: "en" | "es"): NavItem[] {
  const es = lang === "es"
  return [
    {
      type: "link",
      href: "/admin/dispatch",
      label: es ? "Despacho" : "Dispatch",
    },
    {
      type: "link",
      href: "/admin/orders",
      label: es ? "Órdenes" : "Orders",
    },
    {
      type: "link",
      href: "/admin/search",
      label: es ? "Buscar" : "Search",
    },
    {
      type: "dropdown",
      label: es ? "Clientes" : "Customers",
      items: [
        { href: "/admin/subscriptions", label: es ? "Suscripciones" : "Subscriptions" },
        { href: "/admin/plans",         label: es ? "Planes Mensuales" : "Monthly Plans" },
      ],
    },
    {
      type: "dropdown",
      label: es ? "Logística" : "Logistics",
      items: [
        { href: "/admin/facility",      label: es ? "🏭 Tablero de Instalación" : "🏭 Facility Board" },
        { href: "/admin/runs",          label: es ? "Transferencias" : "Facility Transfers" },
        { href: "/admin/routes",        label: es ? "Rutas de Entrega" : "Delivery Routes" },
        { href: "/admin/routing",       label: es ? "Optimizador de Rutas" : "Route Optimizer" },
        { href: "/admin/facilities",    label: es ? "Instalaciones" : "Facilities" },
        { href: "/admin/zip-codes",     label: es ? "Códigos Postales" : "Zip Codes" },
        { href: "/admin/service-area",  label: es ? "Mapa de Área" : "Area Map" },
        { href: "/admin/holidays",      label: es ? "Días Festivos" : "Holidays" },
      ],
    },
    {
      type: "dropdown",
      label: es ? "Finanzas" : "Finance",
      items: [
        { href: "/admin/reports", label: es ? "Reportes" : "Reports" },
        { href: "/admin/pricing", label: es ? "Precios" : "Pricing" },
        { href: "/admin/tips",    label: es ? "Propinas" : "Tips" },
      ],
    },
    {
      type: "dropdown",
      label: es ? "Contenido" : "Content",
      items: [
        { href: "/admin/promos",    label: es ? "Promociones" : "Promotions" },
        { href: "/admin/images",    label: es ? "Imágenes del Sitio" : "Site Images" },
        { href: "/admin/templates", label: es ? "Plantillas de Email" : "Email Templates" },
        { href: "/admin/faq",       label: es ? "Editor de FAQ" : "FAQ Editor" },
        { href: "/admin/docs",      label: es ? "Docs y FAQ" : "Docs & FAQ" },
      ],
    },
    {
      type: "link",
      href: "/admin/settings",
      label: es ? "Configuración" : "Settings",
    },
    {
      type: "dropdown",
      label: es ? "Personal" : "Staff",
      items: [
        { href: "/admin/workers",  label: es ? "Trabajadores" : "Workers" },
        { href: "/admin/schedule", label: es ? "Horario" : "Schedule" },
        { href: "/staff",          label: es ? "Reloj del Personal" : "Staff Clock" },
        { href: "/driver",         label: es ? "App Conductor →" : "Driver App →", external: true },
        { href: "/operator",       label: es ? "App Operador →" : "Operator App →", external: true },
      ],
    },
  ]
}

// ── Dropdown component ────────────────────────────────────────────────────────

function Dropdown({ label, items }: { label: string; items: NavLink[] }) {
  return (
    <div className="relative group">
      <button className="flex items-center gap-1 text-white/60 hover:text-white text-sm font-medium transition-colors py-1 whitespace-nowrap">
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-150 group-hover:rotate-180" />
      </button>
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

export async function AdminHeader() {
  const [lang, viewMode] = await Promise.all([getAdminLang(), getAdminViewMode()])
  const navItems = viewMode === "simple" ? buildSimpleNav(lang) : buildNav(lang)

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
        {navItems.map((item, i) =>
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

      {/* Simple / Advanced toggle */}
      <div className="flex items-center px-3 shrink-0">
        <AdminViewToggle mode={viewMode} lang={lang} />
      </div>

      {/* Language toggle */}
      <div className="flex items-center px-3 shrink-0 border-l border-white/10">
        <AdminLangToggle lang={lang} />
      </div>

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
    </header>
  )
}
