"use client"

import { Logo } from "@/components/site-nav"
import { useState, useEffect } from "react"
import { getServicesConfig, type ServicesConfig } from "@/app/actions/settings"
import { getBrandingSettings, getOperatorLandingProfile, type OperatorProfile } from "@/app/actions/branding"

// The alternate homepage template for solo / home-based operators --
// selected per-tenant via locations.landing_page_template, set on
// /admin/branding. A tenant on this template also picks a visual style
// (locations.operator_landing_style: classic / bold / scrapbook) -- same
// content (photo, name, bio, booking CTAs), different look. See
// app/page.tsx for the dispatcher that picks between the corporate and
// operator templates in the first place, and components/site-nav.tsx for
// why the standard corporate nav skips itself on this template's homepage.
export function OperatorLanding() {
  const [profile, setProfile] = useState<OperatorProfile | null>(null)
  const [services, setServices] = useState<ServicesConfig | null>(null)
  const [businessName, setBusinessName] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [supportPhone, setSupportPhone] = useState<string | null>(null)
  const [supportEmail, setSupportEmail] = useState<string | null>(null)

  useEffect(() => {
    getOperatorLandingProfile().then(setProfile)
    getServicesConfig().then(setServices)
    getBrandingSettings().then(b => {
      setBusinessName(b.business_name)
      setLogoUrl(b.logo_url ?? null)
      setSupportPhone(b.support_phone ?? null)
      setSupportEmail(b.support_email ?? null)
    })
  }, [])

  if (!profile) return null

  const props: OperatorStyleProps = { profile, services, businessName, logoUrl, supportPhone, supportEmail }
  if (profile.operator_landing_style === "bold") return <BoldStyle {...props} />
  if (profile.operator_landing_style === "scrapbook") return <ScrapbookStyle {...props} />
  return <ClassicStyle {...props} />
}

interface OperatorStyleProps {
  profile: OperatorProfile
  services: ServicesConfig | null
  businessName: string
  logoUrl: string | null
  supportPhone: string | null
  supportEmail: string | null
}

const SERVICE_LINKS: { key: keyof ServicesConfig; href: string; label: string; icon: string }[] = [
  { key: "wash_fold", href: "/book/wash-fold", label: "Wash & Fold", icon: "👕" },
  { key: "comforter_wash", href: "/book/comforter-wash", label: "Comforter Wash", icon: "🛏️" },
  { key: "wash_only", href: "/book/wash-only", label: "Wash Only", icon: "🧺" },
]

function enabledServices(services: ServicesConfig | null) {
  return SERVICE_LINKS.filter(s => !services || services[s.key])
}

// Before the tenant writes their own story on /admin/branding, the page
// still needs something believable in that space rather than dead white
// (or worse, no card at all) -- this is generic-enough copy that's true
// for any solo operator, swapped out the moment they save a real bio.
function displayBio(profile: OperatorProfile, businessName: string) {
  if (profile.operator_bio) return profile.operator_bio
  const name = profile.operator_name || businessName || "I"
  return `Every order goes through my own hands from pickup to delivery — no facility, no outsourcing. Just careful, honest work, done by ${profile.operator_name ? name : "me"} personally.`
}

function firstName(name: string | null) {
  return name ? name.trim().split(" ")[0] : null
}

function CTAs({ services, className, btnClass }: { services: ServicesConfig | null; className?: string; btnClass: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      {enabledServices(services).map(s => (
        <a
          key={s.key}
          href={s.href}
          className={`flex items-center justify-center gap-2 rounded-2xl font-bold py-4 px-6 text-sm transition ${btnClass}`}
        >
          <span className="text-lg">{s.icon}</span>
          Schedule {s.label}
        </a>
      ))}
    </div>
  )
}

function ContactLine({ supportPhone, supportEmail, className, linkClass }: { supportPhone: string | null; supportEmail: string | null; className?: string; linkClass: string }) {
  if (!supportPhone && !supportEmail) return null
  return (
    <p className={`text-xs ${className ?? ""}`}>
      Questions? {supportPhone ? <a href={`tel:${supportPhone}`} className={linkClass}>{supportPhone}</a> : null}
      {supportPhone && supportEmail ? " · " : ""}
      {supportEmail ? <a href={`mailto:${supportEmail}`} className={linkClass}>{supportEmail}</a> : null}
    </p>
  )
}

// Small decorative accents (dots, a soft blob) so each background reads as
// designed rather than a flat, empty fill -- pure CSS/SVG, no assets.
function Dots({ className }: { className: string }) {
  return (
    <svg className={className} width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 5 }).map((_, col) => (
          <circle key={`${row}-${col}`} cx={12 + col * 24} cy={12 + row * 24} r="2.5" fill="currentColor" />
        ))
      )}
    </svg>
  )
}

// ── Classic — split hero: photo beside the greeting, warm accent blob and
// a bio that's never empty, tight single card so there's no dead space. ──
function ClassicStyle({ profile, services, businessName, logoUrl, supportPhone, supportEmail }: OperatorStyleProps) {
  return (
    <main className="min-h-screen bg-[#f7f8fb] font-sans relative overflow-hidden">
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[var(--brand-accent)]/10 blur-2xl" />
      <div className="absolute top-40 -left-16 h-56 w-56 rounded-full bg-[var(--brand-primary)]/5 blur-2xl" />

      <div className="flex justify-center pt-6 pb-2 relative">
        <Logo size={40} src={logoUrl} />
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-16 sm:pb-24 pt-4 relative">
        <div className="grid sm:grid-cols-2 gap-0 rounded-3xl overflow-hidden bg-white shadow-sm border border-gray-100">
          <div className="relative h-64 sm:h-auto bg-gray-100">
            {profile.operator_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.operator_photo_url} alt={profile.operator_name ?? "Operator portrait"} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-6xl text-gray-300">🙂</div>
            )}
          </div>

          <div className="p-8 sm:p-10 flex flex-col justify-center relative">
            <Dots className="absolute top-4 right-4 text-[var(--brand-accent)]/20" />
            <p className="text-xs font-bold text-[var(--brand-accent)] uppercase tracking-widest mb-2">
              {businessName || "Your neighborhood laundry service"}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--brand-primary)] leading-tight">
              {profile.operator_name ? `Hi, I'm ${profile.operator_name} 👋` : "Welcome"}
            </h1>

            <p className="text-gray-500 text-sm sm:text-base leading-relaxed mt-4">
              {displayBio(profile, businessName)}
            </p>

            <CTAs services={services} className="mt-8" btnClass="bg-[var(--brand-primary)] text-white hover:opacity-90" />

            <ContactLine supportPhone={supportPhone} supportEmail={supportEmail} className="text-gray-400 mt-6" linkClass="underline" />
          </div>
        </div>
      </div>
    </main>
  )
}

// ── Bold — full-bleed photo hero, warm overlay, then a tight card that
// carries the bio + CTAs together instead of a big empty block. ─────────
function BoldStyle({ profile, services, businessName, logoUrl, supportPhone, supportEmail }: OperatorStyleProps) {
  return (
    <main className="min-h-screen bg-[#f7f8fb] font-sans">
      <div className="flex justify-center pt-6 pb-2 bg-[#1a1a24]"><Logo size={36} src={logoUrl} /></div>

      <div className="relative h-[420px] sm:h-[480px] bg-[#1a1a24] overflow-hidden">
        {profile.operator_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.operator_photo_url} alt={profile.operator_name ?? "Operator portrait"} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-7xl text-white/20">🙂</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a24] via-[#1a1a24]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-8 text-center">
          <p className="text-[var(--brand-accent)] text-xs font-bold uppercase tracking-widest mb-1">
            {businessName || "Your neighborhood laundry service"}
          </p>
          <h1 className="text-white text-2xl sm:text-4xl font-extrabold drop-shadow-sm">
            {profile.operator_name ? `Hi, I'm ${profile.operator_name} 👋` : "Welcome"}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 -mt-8 relative">
        <div className="bg-white rounded-3xl shadow-lg p-8">
          <p className="text-gray-500 text-sm sm:text-base leading-relaxed text-center">
            {displayBio(profile, businessName)}
          </p>
          <CTAs services={services} className="mt-8 max-w-sm mx-auto" btnClass="bg-[#1a1a24] text-white hover:opacity-90" />
          <ContactLine supportPhone={supportPhone} supportEmail={supportEmail} className="text-gray-400 mt-8 text-center" linkClass="underline" />
        </div>
      </div>
      <div className="h-16" />
    </main>
  )
}

// ── Scrapbook — tilted photo beside a handwritten-feel greeting, warm
// paper texture and decorative accents so the card never reads empty
// even before a bio/name is filled in. ───────────────────────────────────
function ScrapbookStyle({ profile, services, businessName, logoUrl, supportPhone, supportEmail }: OperatorStyleProps) {
  const first = firstName(profile.operator_name)
  return (
    <main className="min-h-screen bg-[#faf3e8] font-sans relative overflow-hidden">
      <div className="absolute top-10 right-8 h-40 w-40 rounded-full bg-[#c17a4f]/10 blur-2xl" />
      <div className="absolute bottom-10 left-0 h-56 w-56 rounded-full bg-[#c17a4f]/10 blur-2xl" />
      <Dots className="absolute top-24 left-6 text-[#c17a4f]/20 hidden sm:block" />

      <div className="flex justify-center pt-6 pb-2 relative"><Logo size={40} src={logoUrl} /></div>

      <div className="mx-auto max-w-3xl px-4 pb-16 sm:pb-24 pt-6 relative">
        <div className="grid sm:grid-cols-[220px_1fr] gap-8 sm:gap-10 items-center mb-8">
          <div className="mx-auto sm:mx-0 h-52 w-44 rounded-2xl overflow-hidden rotate-[-3deg] border-4 border-white shadow-md bg-[#efe3cd]">
            {profile.operator_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.operator_photo_url} alt={profile.operator_name ?? "Operator portrait"} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-5xl text-[#c9b78f]">🙂</div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[#c17a4f] font-bold text-xs uppercase tracking-[0.2em] mb-2">Meet the Owner</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#6b4a2b]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {first ? `Hi, I'm ${first}` : businessName || "Welcome"}
            </h1>
            {businessName && (
              <p className="text-sm font-semibold text-[#c17a4f] uppercase tracking-wide mt-2">{businessName}</p>
            )}
          </div>
        </div>

        <div className="bg-[#f5ecdd] border border-[#e8d9bd] rounded-[2rem] shadow-sm p-8 sm:p-10 relative overflow-hidden">
          <p className="text-[#7a6a52] text-sm sm:text-base leading-relaxed text-center max-w-lg mx-auto">
            {displayBio(profile, businessName)}
          </p>

          <CTAs services={services} className="mt-8 max-w-sm mx-auto" btnClass="bg-[#c17a4f] text-white hover:opacity-90 shadow-sm" />

          <ContactLine supportPhone={supportPhone} supportEmail={supportEmail} className="text-[#a3927a] mt-8 text-center" linkClass="underline" />
        </div>
      </div>
    </main>
  )
}
