import Link from "next/link"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "washfold.com"

// A check is either a BLOCKER (the tenant cannot operate without it) or a
// SETUP item (they can operate, but something is wrong or unbranded). Keeping
// that distinction visible is the whole point of this page — "no ZIP codes" and
// "cannot accept a single payment" should never look the same at a glance.
type Severity = "blocker" | "setup"

interface Check {
  label: string
  ok: boolean
  severity: Severity
  detail: string
  /** Where to go to fix it. */
  fix?: string
}

export default async function TenantReadinessPage() {
  await requireSuperAdmin()

  const supabase = createAdminClient()

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, slug, plan, status, billing_status, custom_domain, logo_url, support_email, support_phone, sending_domain, sending_domain_status, stripe_connect_status, stripe_connect_required, shipday_api_key, operating_mode, operating_mode_confirmed, created_at")
    .order("created_at", { ascending: true })

  const ids = (locations ?? []).map(l => l.id)

  // One round trip per related table, grouped in memory — 40-odd tenants
  // doesn't justify a view, and this keeps the page readable.
  const [admins, zips, facilities, templates, bookings] = await Promise.all([
    supabase.from("location_users").select("location_id").in("location_id", ids),
    supabase.from("service_areas").select("location_id").in("location_id", ids),
    supabase.from("facilities").select("location_id").in("location_id", ids),
    supabase.from("email_templates").select("location_id").in("location_id", ids),
    supabase.from("bookings").select("location_id").in("location_id", ids),
  ])

  function tally(rows: { location_id: string }[] | null): Record<string, number> {
    const out: Record<string, number> = {}
    for (const r of rows ?? []) out[r.location_id] = (out[r.location_id] ?? 0) + 1
    return out
  }
  const adminCount    = tally(admins.data)
  const zipCount      = tally(zips.data)
  const facilityCount = tally(facilities.data)
  const templateCount = tally(templates.data)
  const bookingCount  = tally(bookings.data)

  type Row = NonNullable<typeof locations>[number]

  function checksFor(l: Row): Check[] {
    const connectOk = !l.stripe_connect_required || l.stripe_connect_status === "active"
    return [
      {
        label: "Admin login",
        ok: (adminCount[l.id] ?? 0) > 0,
        severity: "blocker",
        detail: (adminCount[l.id] ?? 0) > 0
          ? `${adminCount[l.id]} user${adminCount[l.id] === 1 ? "" : "s"} linked`
          : "Nobody can log in to this tenant's admin",
        fix: "Locations → Admins → Invite",
      },
      {
        label: "Accepts payments",
        ok: connectOk,
        severity: "blocker",
        detail: !l.stripe_connect_required
          ? "Connect not required (grandfathered)"
          : l.stripe_connect_status === "active"
            ? "Stripe Connect active"
            : `Checkout is BLOCKED — Connect is ${l.stripe_connect_status ?? "not_connected"}`,
        fix: "Tenant's /admin/branding → Get Paid Directly",
      },
      {
        label: "Paying us",
        ok: l.billing_status === "active" || l.billing_status === "trialing",
        severity: "setup",
        detail: `billing_status: ${l.billing_status ?? "none"}${l.plan ? ` · plan: ${l.plan}` : ""}`,
        fix: "Locations → Billing → Set price & send checkout link",
      },
      {
        label: "Order alerts reach them",
        ok: !!l.support_email,
        severity: "blocker",
        detail: l.support_email
          ? `New-order alerts go to ${l.support_email}`
          : "No support_email — their order alerts fall back to the platform inbox, so THEY never see them",
        fix: "Tenant's /admin/branding → Support email",
      },
      {
        label: "Sends from own domain",
        ok: l.sending_domain_status === "verified",
        severity: "setup",
        detail: l.sending_domain_status === "verified"
          ? `Verified: ${l.sending_domain}`
          : "Customer email goes out from the shared WashFold address",
        fix: "Tenant's /admin/branding → Custom Sending Domain",
      },
      {
        label: "Service area",
        ok: (zipCount[l.id] ?? 0) > 0,
        severity: "setup",
        detail: (zipCount[l.id] ?? 0) > 0
          ? `${zipCount[l.id]} ZIP codes`
          : "No ZIPs — the public ZIP checker tells every visitor they're out of range",
        fix: "Tenant's /admin/zip-codes",
      },
      {
        label: "Facility set up",
        ok: l.operating_mode !== "facility" || (facilityCount[l.id] ?? 0) > 0,
        severity: "setup",
        detail: l.operating_mode !== "facility"
          ? `Operating mode: ${l.operating_mode ?? "unset"} — facility not needed`
          : (facilityCount[l.id] ?? 0) > 0
            ? `${facilityCount[l.id]} facilities`
            : "Facility mode with no facilities — orders never get assigned one",
        fix: "Tenant's /admin/facilities",
      },
      {
        label: "Dispatch (Shipday)",
        ok: !!l.shipday_api_key,
        severity: "setup",
        detail: l.shipday_api_key ? "API key set" : "No key — driver dispatch and tracking won't run",
        fix: "Tenant's /admin/branding → Dispatch",
      },
      {
        label: "Email templates",
        ok: (templateCount[l.id] ?? 0) > 0,
        severity: "setup",
        detail: (templateCount[l.id] ?? 0) > 0
          ? `${templateCount[l.id]} editable templates`
          : "None seeded — /admin/templates is empty for them",
        fix: "Reseed via seedNewLocation",
      },
      {
        label: "Branding",
        ok: !!l.logo_url,
        severity: "setup",
        detail: l.logo_url ? "Logo set" : "No logo uploaded",
        fix: "Tenant's /admin/branding",
      },
      {
        label: "Operating mode confirmed",
        ok: !!l.operating_mode_confirmed,
        severity: "setup",
        detail: l.operating_mode_confirmed
          ? `Confirmed: ${l.operating_mode}`
          : `Defaulted to ${l.operating_mode ?? "facility"} — never explicitly chosen`,
        fix: "Tenant's /admin/branding → Operating Mode",
      },
      {
        label: "Own domain",
        ok: !!l.custom_domain,
        severity: "setup",
        detail: l.custom_domain
          ? l.custom_domain
          : `Running on ${l.slug}.${PLATFORM_DOMAIN}`,
        fix: "Locations → Edit → Custom domain (set BEFORE pointing DNS)",
      },
    ]
  }

  const rows = (locations ?? []).map(l => {
    const checks = checksFor(l)
    return {
      l,
      checks,
      blockers: checks.filter(c => !c.ok && c.severity === "blocker").length,
      pending:  checks.filter(c => !c.ok && c.severity === "setup").length,
      done:     checks.filter(c => c.ok).length,
      total:    checks.length,
      isLive:   l.billing_status === "active" || l.billing_status === "trialing" || (bookingCount[l.id] ?? 0) > 0,
    }
  })

  // Real customers first — anyone paying, or anyone with actual bookings. The
  // rest are demo/prospect sites and just create noise up top.
  const live  = rows.filter(r => r.isLive)
  const demos = rows.filter(r => !r.isLive)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Tenant Readiness</h2>
        <p className="text-sm text-slate-500 mt-1">
          What each tenant still needs before they can actually operate.{" "}
          <span className="font-semibold text-red-600">Blockers</span> stop them working at all;
          setup items degrade the experience.
        </p>
      </div>

      <Section title="Live & paying tenants" rows={live} empty="No paying tenants yet." />

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-semibold text-slate-500 hover:text-indigo-600 select-none">
          Demo &amp; prospect sites ({demos.length})
        </summary>
        <div className="mt-4">
          <Section title="" rows={demos} empty="None." />
        </div>
      </details>
    </div>
  )
}

function Section({
  title, rows, empty,
}: {
  title: string
  rows: {
    l: { id: string; name: string; slug: string; status: string | null }
    checks: Check[]
    blockers: number
    pending: number
    done: number
    total: number
  }[]
  empty: string
}) {
  if (rows.length === 0) {
    return (
      <div>
        {title && <h3 className="text-sm font-bold text-slate-700 mb-3">{title}</h3>}
        <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">{empty}</p>
      </div>
    )
  }

  return (
    <div>
      {title && <h3 className="text-sm font-bold text-slate-700 mb-3">{title}</h3>}
      <div className="space-y-3">
        {rows.map(({ l, checks, blockers, pending, done, total }) => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{l.name}</p>
                <p className="text-xs text-slate-400 font-mono">{l.slug}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {blockers > 0 ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                    {blockers} blocker{blockers === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                    No blockers
                  </span>
                )}
                {pending > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {pending} to set up
                  </span>
                )}
                <span className="text-xs text-slate-400 tabular-nums">{done}/{total}</span>
              </div>
            </div>

            <details className="border-t border-slate-100">
              <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-400 hover:text-indigo-600 select-none">
                Details
              </summary>
              <div className="px-4 pb-4 pt-1 divide-y divide-slate-50">
                {checks.map(c => (
                  <div key={c.label} className="py-2 flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {c.ok ? "✅" : c.severity === "blocker" ? "⛔" : "⚠️"}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${c.ok ? "text-slate-700" : c.severity === "blocker" ? "text-red-700" : "text-amber-700"}`}>
                        {c.label}
                      </p>
                      <p className="text-xs text-slate-500">{c.detail}</p>
                      {!c.ok && c.fix && (
                        <p className="text-[11px] text-slate-400 mt-0.5">Fix: {c.fix}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  )
}
