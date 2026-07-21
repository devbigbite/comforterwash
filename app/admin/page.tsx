import type React from "react"
import { getBookings } from "@/app/actions/bookings"
import { getFulfillmentMode } from "@/app/actions/walkin"
import { getMyBillingStatus } from "@/app/actions/platform-billing"
import { getBranding, getLocationId, ORLANDO_LOCATION_ID } from "@/lib/location"
import { todayET } from "@/lib/pickup-cutoff"
import {
  Truck,
  Users,
  Factory,
  BarChart2,
  Megaphone,
  UserCog,
  Settings,
  Package,
  Clock,
  TruckIcon,
  CheckCircle2,
  ChevronRight,
  Briefcase,
} from "lucide-react"

export const dynamic = "force-dynamic"

// ── Module definitions ────────────────────────────────────────────────────────

type ModuleLink = { label: string; href: string; external?: boolean }

type Module = {
  id: string
  label: string
  description: string
  color: string        // accent color
  bg: string           // card left-border / icon bg
  icon: React.ReactNode
  primaryHref: string
  links: ModuleLink[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminHub() {
  const [bookings, branding, fulfillmentMode, billingStatus, locationId] = await Promise.all([
    getBookings(), getBranding(), getFulfillmentMode(), getMyBillingStatus(), getLocationId(),
  ])
  const today = todayET()
  const showWalkin = fulfillmentMode === "walkin" || fulfillmentMode === "both"
  const isOrlando = locationId === ORLANDO_LOCATION_ID

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending" || b.status === "confirmed").length,
    inProgress: bookings.filter((b) => b.status === "picked_up" || b.status === "in_progress").length,
    completed: bookings.filter((b) => b.status === "delivered").length,
  }

  const todayCount =
    bookings.filter((b) => b.pickup_date === today && b.status !== "cancelled").length +
    bookings.filter((b) => b.delivery_date === today && b.status !== "cancelled").length

  const MODULES: Module[] = [
    {
      id: "operations",
      label: "Operations",
      description: "Daily dispatch, order lookup, and live run status.",
      color: "#1e3a8a",
      bg: "#eff6ff",
      icon: <Truck className="h-7 w-7" style={{ color: "#1e3a8a" }} />,
      primaryHref: "/admin/dispatch",
      links: [
        { label: "Dispatch Board", href: "/admin/dispatch" },
        { label: "Order Search", href: "/admin/search" },
        { label: "All Bookings", href: "/admin/orders" },
        ...(showWalkin ? [{ label: "Walk-In / Drop-Off", href: "/admin/walkin" }] : []),
      ],
    },
    {
      id: "customers",
      label: "Customers",
      description: "Subscriptions, monthly plans, and customer accounts.",
      color: "#7c3aed",
      bg: "#f5f3ff",
      icon: <Users className="h-7 w-7" style={{ color: "#7c3aed" }} />,
      primaryHref: "/admin/subscriptions",
      links: [
        { label: "Subscriptions", href: "/admin/subscriptions" },
        { label: "Monthly Plans", href: "/admin/plans" },
      ],
    },
    {
      id: "logistics",
      label: "Logistics",
      description: "Facilities, routes, service area, and zip-code coverage.",
      color: "#0891b2",
      bg: "#ecfeff",
      icon: <Factory className="h-7 w-7" style={{ color: "#0891b2" }} />,
      primaryHref: "/admin/facility",
      links: [
        { label: "Facility Board", href: "/admin/facility" },
        { label: "Facility Transfers", href: "/admin/runs" },
        { label: "Delivery Routes", href: "/admin/routes" },
        { label: "Route Optimizer", href: "/admin/routing" },
        { label: "Facilities", href: "/admin/facilities" },
        { label: "Zip Codes", href: "/admin/zip-codes" },
        { label: "Service Area", href: "/admin/service-area" },
        { label: "Holidays", href: "/admin/holidays" },
      ],
    },
    {
      id: "finance",
      label: "Finance",
      description: "Revenue reports, pricing rules, and tip pools.",
      color: "#059669",
      bg: "#ecfdf5",
      icon: <BarChart2 className="h-7 w-7" style={{ color: "#059669" }} />,
      primaryHref: "/admin/reports",
      links: [
        { label: "Reports", href: "/admin/reports" },
        { label: "Pricing", href: "/admin/pricing" },
        { label: "Tips", href: "/admin/tips" },
      ],
    },
    {
      id: "content",
      label: "Content",
      description: "Promotions, site images, email templates, and FAQ.",
      color: "#d97706",
      bg: "#fffbeb",
      icon: <Megaphone className="h-7 w-7" style={{ color: "#d97706" }} />,
      primaryHref: "/admin/promos",
      links: [
        { label: "Branding", href: "/admin/branding" },
        { label: "Promotions", href: "/admin/promos" },
        { label: "Site Images", href: "/admin/images" },
        { label: "Email Templates", href: "/admin/templates" },
        { label: "FAQ Editor", href: "/admin/faq" },
        { label: "Docs & FAQ", href: "/admin/docs" },
      ],
    },
    {
      id: "staff",
      label: "Staff",
      description: "Workers, schedules, and field app access.",
      color: "#be185d",
      bg: "#fdf2f8",
      icon: <UserCog className="h-7 w-7" style={{ color: "#be185d" }} />,
      primaryHref: "/admin/workers",
      links: [
        { label: "Workers", href: "/admin/workers" },
        { label: "Hiring", href: "/admin/hiring" },
        { label: "Schedule", href: "/admin/schedule" },
        { label: "Staff Clock", href: "/staff" },
        { label: "Driver App →", href: "/driver", external: true },
        { label: "Operator App →", href: "/operator", external: true },
        { label: "Print Station Setup", href: "/admin/print-station" },
      ],
    },
    {
      id: "commercial",
      label: "Commercial Sales",
      description: "Pitch templates, prospect pipeline, and proposal generation for commercial accounts.",
      color: "#0f766e",
      bg: "#f0fdfa",
      icon: <Briefcase className="h-7 w-7" style={{ color: "#0f766e" }} />,
      primaryHref: "/super-admin/outreach",
      links: [
        { label: "Pitch Templates", href: "/super-admin/outreach" },
        { label: "Pipeline", href: "/super-admin/outreach?tab=pipeline" },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      description: "Platform configuration, legal docs, and system settings.",
      color: "#64748b",
      bg: "#f8fafc",
      icon: <Settings className="h-7 w-7" style={{ color: "#64748b" }} />,
      primaryHref: "/admin/settings",
      links: [
        { label: "Settings", href: "/admin/settings" },
        { label: "Legal", href: "/admin/legal" },
        { label: "🧪 Test Hub", href: "/admin/test" },
      ],
    },
    // Only shown to the platform owner (Orlando's own admin session) — logging
    // in here already grants super-admin access via single sign-on, this is
    // just the visible door to it.
    ...(isOrlando
      ? [{
          id: "saas-platform",
          label: "SaaS Platform",
          description: "Manage all tenant businesses, billing, and onboarding across the whole platform.",
          color: "#b45309",
          bg: "#fffbeb",
          icon: <Briefcase className="h-7 w-7" style={{ color: "#b45309" }} />,
          primaryHref: "/super-admin",
          links: [
            { label: "All Locations", href: "/super-admin" },
            { label: "Add New Location", href: "/super-admin/locations/new" },
          ],
        } as Module]
      : []),
  ]

  return (
    <div className="bg-[#f0f4fa] min-h-screen">
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* ── Billing banner ───────────────────────────────────────────────── */}
        {(billingStatus === "past_due" || billingStatus === "canceled") && (
          <div className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${
            billingStatus === "canceled" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
          }`}>
            <span className="text-xl">⚠️</span>
            <p className={`text-sm font-semibold ${billingStatus === "canceled" ? "text-red-700" : "text-amber-700"}`}>
              {billingStatus === "canceled"
                ? "Your subscription has been cancelled. Contact the platform to reactivate your account."
                : "Your last payment failed. Please update your billing to keep your account in good standing."}
            </p>
          </div>
        )}

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-[#0D2240]">Control Panel</h1>
          <p className="text-sm text-gray-400 mt-0.5">{branding.business_name || "Your Business"} — select a module to get started</p>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Orders", value: stats.total, href: "/admin/search", icon: <Package className="h-5 w-5 text-[#1e3a8a]" />, bg: "#eff6ff" },
            { label: "Pending", value: stats.pending, href: "/admin/dispatch?status=pending", icon: <Clock className="h-5 w-5 text-yellow-500" />, bg: "#fefce8" },
            { label: "In Progress", value: stats.inProgress, href: "/admin/dispatch?status=in_progress", icon: <TruckIcon className="h-5 w-5 text-blue-500" />, bg: "#eff6ff" },
            { label: "Delivered", value: stats.completed, href: "/admin/search?status=delivered", icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, bg: "#f0fdf4" },
          ].map((s) => (
            <a key={s.label} href={s.href} className="bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center gap-4 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all group">
              <div className="rounded-xl p-2.5" style={{ background: s.bg }}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold text-[#0D2240] group-hover:text-[#1e3a8a] transition-colors">{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            </a>
          ))}
        </div>

        {/* ── Module cards ─────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Modules</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map((mod) => (
              <div
                key={mod.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
                style={{ borderTop: `3px solid ${mod.color}` }}
              >
                {/* Card header */}
                <div className="px-6 pt-5 pb-4 flex items-start gap-4">
                  <div className="rounded-xl p-2.5 shrink-0" style={{ background: mod.bg }}>
                    {mod.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#0D2240] text-base leading-tight">{mod.label}</div>
                    <div className="text-xs text-gray-400 mt-1 leading-snug">{mod.description}</div>
                  </div>
                </div>

                {/* Link grid */}
                <div className="px-6 pb-4 flex-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {mod.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="text-xs font-medium transition-colors"
                        style={{ color: link.external ? "#9ca3af" : mod.color }}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="px-6 pb-5">
                  <a
                    href={mod.primaryHref}
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: mod.color }}
                  >
                    Enter
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: "Dispatch Board", href: "/admin/dispatch", icon: "🚚" },
              { label: "Order Search", href: "/admin/search", icon: "🔍" },
              { label: "Facility Board", href: "/admin/facility", icon: "🏭" },
              { label: "Reports", href: "/admin/reports", icon: "📊" },
              { label: "Promotions", href: "/admin/promos", icon: "🎟️" },
              { label: "Workers", href: "/admin/workers", icon: "👷" },
              { label: "Route Optimizer", href: "/admin/routing", icon: "🗺️" },
              { label: "Commercial Sales", href: "/super-admin/outreach", icon: "💼" },
              { label: "Settings", href: "/admin/settings", icon: "⚙️" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="bg-white border border-gray-100 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group"
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-sm font-medium text-[#0D2240] group-hover:text-[#E8726A] transition-colors leading-tight">
                  {item.label}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#E8726A] ml-auto transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* Today badge */}
        {todayCount > 0 && (
          <a
            href="/admin/dispatch"
            className="flex items-center justify-between bg-[#0D2240] text-white rounded-2xl px-6 py-4 shadow hover:opacity-95 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <span className="bg-[#E8726A] text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                {todayCount}
              </span>
              <div>
                <div className="font-semibold text-sm">Active today</div>
                <div className="text-white/50 text-xs">pickups + deliveries scheduled for today</div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/40" />
          </a>
        )}

      </main>
    </div>
  )
}
