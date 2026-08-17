import { LogOut } from "lucide-react"
import { logoutAction } from "@/app/admin/login/actions"
import { AdminLangToggle } from "@/components/admin/admin-lang-toggle"
import { AdminViewToggle } from "@/components/admin/admin-view-toggle"
import { NavDropdown } from "@/components/admin/nav-dropdown"
import { MobileMenu } from "@/components/admin/mobile-menu"
import { getAdminLang } from "@/app/actions/admin-lang"
import { getAdminViewMode, getOperatingMode, type OperatingMode } from "@/app/actions/branding"

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavLink = { href: string; label: string; external?: boolean }
type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "dropdown"; label: string; items: NavLink[] }

// Condensed nav for tenants who haven't opted into the full "Advanced" admin —
// just the handful of things a solo/home-based operator touches day to day.
// Everything here also exists in the Advanced nav; nothing is removed, only
// hidden until the tenant wants more.
function buildSimpleNav(lang: "en" | "es", operatingMode: OperatingMode): NavItem[] {
  const es = lang === "es"
  const isHome = operatingMode === "home"
  return [
    isHome
      ? { type: "link", href: "/admin/home-board", label: es ? "Trabajo de Hoy" : "Today's Work" }
      : { type: "link", href: "/admin/dispatch",    label: es ? "Despacho" : "Dispatch" },
    { type: "link", href: "/admin/orders",     label: es ? "Órdenes" : "Orders" },
    { type: "link", href: "/admin/branding",   label: es ? "Mi Negocio" : "My Business" },
    { type: "link", href: "/admin/pricing",    label: es ? "Precios" : "Pricing" },
    { type: "link", href: "/admin/zip-codes",  label: es ? "Área de Servicio" : "Service Area" },
    ...(isHome
      ? [{ type: "link" as const, href: "/admin/laundromats", label: es ? "Mis Lavanderías" : "My Laundromats" }]
      : [{ type: "link" as const, href: "/admin/workers", label: es ? "Trabajadores" : "Workers" }]),
    { type: "link", href: "/admin/settings",   label: es ? "Configuración" : "Settings" },
    { type: "link", href: "/admin/manual",     label: es ? "📖 Manual" : "📖 Manual" },
  ]
}

function buildNav(lang: "en" | "es", operatingMode: OperatingMode): NavItem[] {
  const es = lang === "es"
  const isHome = operatingMode === "home"
  return [
    isHome
      ? { type: "link", href: "/admin/home-board", label: es ? "Trabajo de Hoy" : "Today's Work" }
      : { type: "link", href: "/admin/dispatch",    label: es ? "Despacho" : "Dispatch" },
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
      type: "link",
      href: "/admin/leads",
      label: es ? "Prospectos" : "Leads",
    },
    {
      type: "dropdown",
      label: es ? "Clientes" : "Customers",
      items: [
        { href: "/admin/subscriptions", label: es ? "Suscripciones" : "Subscriptions" },
        { href: "/admin/plans",         label: es ? "Planes Mensuales" : "Monthly Plans" },
        { href: "/admin/commercial",    label: es ? "Cuentas Comerciales" : "Commercial Accounts" },
      ],
    },
    {
      type: "dropdown",
      label: es ? "Logística" : "Logistics",
      items: isHome
        ? [
            { href: "/admin/laundromats",   label: es ? "Mis Lavanderías" : "My Laundromats" },
            { href: "/admin/zip-codes",     label: es ? "Códigos Postales" : "Zip Codes" },
            { href: "/admin/service-area",  label: es ? "Mapa de Área" : "Area Map" },
            { href: "/admin/holidays",      label: es ? "Días Festivos" : "Holidays" },
          ]
        : [
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
        { href: "/admin/reports",  label: es ? "Reportes" : "Reports" },
        { href: "/admin/expenses", label: es ? "Gastos" : "Expenses" },
        { href: "/admin/facility-payments", label: es ? "🏦 Pagos a Instalaciones" : "🏦 Facility Payments" },
        { href: "/admin/pricing",  label: es ? "Precios" : "Pricing" },
        { href: "/admin/tips",     label: es ? "Propinas" : "Tips" },
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
        { href: "/admin/receipt-text", label: es ? "Texto del Recibo" : "Receipt Text" },
      ],
    },
    {
      type: "link",
      href: "/admin/settings",
      label: es ? "Configuración" : "Settings",
    },
    {
      type: "link",
      href: "/admin/manual",
      label: "📖 " + (es ? "Manual" : "Manual"),
    },
    {
      type: "dropdown",
      label: es ? "Personal" : "Staff",
      items: isHome
        ? [
            { href: "/admin/schedule", label: es ? "Horario" : "Schedule" },
          ]
        : [
            { href: "/admin/workers",  label: es ? "Trabajadores" : "Workers" },
            { href: "/admin/schedule", label: es ? "Horario" : "Schedule" },
            { href: "/staff",          label: es ? "Reloj del Personal" : "Staff Clock" },
            { href: "/driver",         label: es ? "App Conductor →" : "Driver App →", external: true },
            { href: "/operator",       label: es ? "App Operador →" : "Operator App →", external: true },
          ],
    },
  ]
}

// "Act As" — one click into the driver or operator station, no PIN, no
// separate login. ?as=owner tells PinGate (components/pin-gate.tsx) to skip
// straight past the PIN screen for an already-authenticated admin; once in,
// the owner sentinel sees every order at that station (not filtered to one
// worker) so an admin can actually process a real order end to end — enter
// weight, mark picked up/delivered, etc. — from whichever station view has
// those actions, without needing a worker PIN. Kept separate from the rest
// of the nav (own slot next to the Simple/Advanced toggle) rather than mixed
// in with Customers/Logistics/Finance — it's a different kind of action
// (who you're acting as), not another admin section to browse into.
function actAsItems(lang: "en" | "es"): NavLink[] {
  const es = lang === "es"
  return [
    { href: "/admin",              label: es ? "👑 Admin (actual)" : "👑 Admin (current)" },
    { href: "/driver?as=owner",    label: "🚐 " + (es ? "Conductor" : "Driver"), external: true },
    { href: "/operator?as=owner",  label: "🏭 " + (es ? "Operador" : "Operator"), external: true },
  ]
}

// ── Header ────────────────────────────────────────────────────────────────────

export async function AdminHeader() {
  const [lang, viewMode, operatingMode] = await Promise.all([getAdminLang(), getAdminViewMode(), getOperatingMode()])
  const navItems = viewMode === "simple" ? buildSimpleNav(lang, operatingMode) : buildNav(lang, operatingMode)

  return (
    <header className="bg-[#0D2240] px-4 md:px-6 py-0 flex items-stretch min-h-[52px]">
      {/* Logo */}
      <a
        href="/admin"
        className="flex items-center gap-2.5 group pr-4 md:pr-6 md:border-r border-white/10 mr-2 md:mr-6 shrink-0"
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
          <span className="ml-1.5 text-white/30 text-[10px] font-semibold uppercase tracking-widest hidden sm:inline">Admin</span>
        </span>
      </a>

      {/* Desktop nav — collapses into MobileMenu below md */}
      <nav className="hidden md:flex items-center gap-5 flex-1 flex-wrap">
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
            <NavDropdown key={i} label={item.label} items={item.items} />
          )
        )}
      </nav>

      {/* Act As — own slot, distinct from the rest of the nav */}
      <div className="hidden md:flex items-center px-3 shrink-0 border-l border-white/10">
        <NavDropdown label={`🎭 ${lang === "es" ? "Actuar Como" : "Act As"}`} items={actAsItems(lang)} accent />
      </div>

      {/* Simple / Advanced toggle */}
      <div className="hidden md:flex items-center px-3 shrink-0">
        <AdminViewToggle mode={viewMode} lang={lang} />
      </div>

      {/* Language toggle */}
      <div className="hidden md:flex items-center px-3 shrink-0 border-l border-white/10">
        <AdminLangToggle lang={lang} />
      </div>

      {/* Sign out */}
      <div className="hidden md:flex items-center pl-4 border-l border-white/10 ml-4 shrink-0">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Mobile: everything above collapses into a hamburger + full-screen drawer */}
      <div className="flex md:hidden items-center ml-auto">
        <MobileMenu navItems={navItems} actAsItems={actAsItems(lang)} lang={lang} viewMode={viewMode} />
      </div>
    </header>
  )
}
