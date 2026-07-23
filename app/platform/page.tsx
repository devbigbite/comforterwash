import Link from "next/link"
import { PlatformDemoForm } from "@/components/platform-demo-form"

export const metadata = {
  title: "WashFoldClean — Run Your Laundry Pickup & Delivery Business",
  description: "The all-in-one platform for laundry pickup & delivery businesses — your own branded booking site, admin dashboard, billing, driver dispatch, and more. Built for facilities and home-based operators alike.",
}

const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: "🎨", title: "Your Own Branded Site", desc: "Your business name, logo, and colors — plus a bilingual English/Spanish site out of the box." },
  { icon: "📅", title: "Booking & Scheduling", desc: "Pickup/delivery time windows, route capacity limits, holiday blackout dates — all self-service." },
  { icon: "🧭", title: "Simple or Advanced Admin", desc: "A condensed dashboard for solo operators who don't want the clutter, or the full toolset for teams running a facility." },
  { icon: "🏠", title: "Built for Home-Based Operators", desc: "A single-lane \"Today's Work\" board, a daily load cap so you never overbook, and the option to route large orders or comforters to your own saved laundromat when they don't fit a home machine." },
  { icon: "💳", title: "Billing & Subscriptions", desc: "Stripe-powered one-time orders, recurring plans, tips, and promo codes." },
  { icon: "🚚", title: "Driver Dispatch & Tracking", desc: "Optional Shipday integration for live tracking and customer notifications — useful whether you hire drivers or deliver yourself." },
  { icon: "✉️", title: "Your Own Sending Domain", desc: "Send booking confirmations and receipts from your own email domain instead of a shared address." },
  { icon: "🔍", title: "SEO-Ready Pages", desc: "Dedicated pages for each service and each ZIP code you serve, plus an auto-generated sitemap." },
  { icon: "🔒", title: "PIN-Protected Worker Apps", desc: "Separate driver and operator apps so your team only sees what they need." },
  { icon: "🚪", title: "Pickup, Delivery, or Walk-In", desc: "Offer full-service pickup & delivery, walk-in drop-off, or both." },
  { icon: "🏢", title: "Commercial Accounts", desc: "A ready-made page for pitching hotels, gyms, spas, and Airbnbs on recurring commercial laundry." },
  { icon: "✏️", title: "Self-Service Site Content", desc: "Testimonials, promotions, FAQs, and offers — all editable from your dashboard, no code required." },
]

const INTEGRATIONS = [
  { name: "Stripe", desc: "Payments & subscriptions" },
  { name: "Shipday", desc: "Driver dispatch & tracking" },
  { name: "Resend", desc: "Transactional email" },
]

export default function PlatformPage() {
  return (
    <main className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link href="/platform" className="flex items-center gap-2.5">
            <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#0D2240" />
              <path d="M11 19 L17 32 L24 21 L31 32 L37 19" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.22" />
              <path d="M10 17 L16 31 L24 19 L32 31 L38 17" stroke="#E8726A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="font-extrabold text-[#0D2240] text-lg tracking-tight">WashFoldClean</span>
          </Link>
          <a href="#demo" className="bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-6 py-2.5 rounded-full transition-colors uppercase tracking-wide">
            Request a Demo
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#0D2240] px-4 py-20 text-center">
        <p className="text-[#E8726A] font-bold text-xs uppercase tracking-[0.25em] mb-3">For Laundry Pickup &amp; Delivery Businesses</p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight max-w-3xl mx-auto leading-tight">
          Run your laundry business on software that grows with you
        </h1>
        <p className="text-white/60 text-base md:text-lg mt-5 max-w-xl mx-auto leading-relaxed">
          A branded booking site, an admin dashboard built for one person or a full team, billing, dispatch, and everything
          in between — whether you run a facility or wash out of your own home.
        </p>
        <a href="#demo" className="inline-block mt-8 bg-[#E8726A] hover:bg-[#d45f57] text-white font-bold text-sm px-10 py-4 rounded-full uppercase tracking-wide transition-colors shadow-lg">
          Request a Demo
        </a>
      </div>

      {/* Live example */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-extrabold text-[#0D2240] text-center mb-2">See It Running Live</h2>
        <p className="text-center text-sm text-gray-400 mb-8 max-w-lg mx-auto">
          WashFold Orlando runs entirely on this platform — every page below is a real, live business, not a mockup.
        </p>
        <div className="rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
            <span className="w-3 h-3 rounded-full bg-red-300" />
            <span className="w-3 h-3 rounded-full bg-yellow-300" />
            <span className="w-3 h-3 rounded-full bg-green-300" />
            <span className="ml-3 text-xs text-gray-400 font-mono">comforterwash.com</span>
          </div>
          <iframe
            src="https://www.comforterwash.com"
            title="Live example tenant site"
            className="w-full h-[520px] border-0"
            loading="lazy"
          />
        </div>
        <div className="text-center mt-4">
          <a href="https://www.comforterwash.com" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#E8726A] hover:underline">
            Open the live example ↗
          </a>
        </div>
      </div>

      {/* Features */}
      <div className="bg-[#f7f8fb] py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-extrabold text-[#0D2240] text-center mb-2">Everything You Need, Built In</h2>
          <p className="text-center text-sm text-gray-400 mb-10 max-w-lg mx-auto">
            Every tenant gets their own site and dashboard — features below are all part of the same platform.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-extrabold text-[#0D2240] text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-extrabold text-[#0D2240] mb-2">Works With Tools You Already Trust</h2>
        <p className="text-sm text-gray-400 mb-8">No separate accounts to juggle — connect your own and you're covered.</p>
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          {INTEGRATIONS.map(i => (
            <div key={i.name} className="rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="font-extrabold text-[#0D2240] text-sm">{i.name}</p>
              <p className="text-[11px] text-gray-400 mt-1">{i.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Demo request */}
      <div id="demo" className="bg-[#0D2240] py-16 px-4">
        <div className="max-w-3xl mx-auto grid gap-10 md:grid-cols-2 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">See it on your own business</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Tell us a bit about your laundry business and we'll set up a walkthrough — whether you're running a full
              facility or washing out of your own home.
            </p>
          </div>
          <PlatformDemoForm />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8 px-4 text-center">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} WashFoldClean. All rights reserved.</p>
      </footer>
    </main>
  )
}
