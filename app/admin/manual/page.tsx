import { requireAdmin } from "@/lib/auth-guard"
import {
  BrowserFrame, PhoneFrame, Callout, CalloutList,
  MockHeader, MockCard, MockButton, MockPill,
} from "@/components/admin/docs/mock-screen"

// ── Tenant Manual ──────────────────────────────────────────────────────────────
// This is a generic, evergreen reference for ANY business running on the
// platform — it deliberately contains no tenant-specific data (no real order
// names, no one business's branding) so it's safe to show every tenant from
// their very first login through years of daily use. Screens below are
// labeled diagrams, not live screenshots, for the same reason: they stay
// accurate even as a tenant's own data changes, and they never leak another
// tenant's information.
//
// Structure mirrors how the app itself is organized: Simple mode first (what
// a brand-new, solo/home-based tenant sees), then Advanced mode (the full
// admin surface), then the three field-facing surfaces (Driver app, Operator
// app, and the customer-facing booking site).

const NAV = [
  { id: "getting-started", label: "Getting Started" },
  { id: "simple-mode", label: "Simple Mode" },
  { id: "advanced-mode", label: "Advanced Mode" },
  { id: "driver-app", label: "Driver App" },
  { id: "operator-app", label: "Operator App" },
  { id: "customer-site", label: "Customer Booking Site" },
  { id: "mobile", label: "Using Admin on Mobile" },
  { id: "faq", label: "FAQ & Troubleshooting" },
]

const NAVY = "#0D2240"

export default async function TenantManualPage() {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-[#f0f4fa]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex gap-8">

        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">On this page</p>
            <nav className="space-y-1">
              {NAV.map(n => (
                <a key={n.id} href={`#${n.id}`}
                  className="block text-sm text-gray-500 hover:text-[#E8726A] py-1 transition-colors">
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-3xl space-y-16 pb-24">

          {/* ── Header ── */}
          <div>
            <p className="text-[#E8726A] text-xs font-bold uppercase tracking-widest mb-2">Tenant Manual</p>
            <h1 className="text-3xl font-extrabold text-[#0D2240] mb-3">Running Your Business on WashFoldClean</h1>
            <p className="text-gray-500 leading-relaxed">
              This guide walks through everything the platform can do, in the order you'll actually encounter it —
              starting with the simplified view every new account opens into, then the full Advanced admin, then the
              three apps your team uses out in the field and the site your customers book from. Screens shown here
              are labeled diagrams standing in for the real thing; your own dashboard will look the same in layout
              and show your business's real orders, pricing, and branding.
            </p>
          </div>

          {/* ══════════════════════════════════════════════ GETTING STARTED ══ */}
          <section id="getting-started" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-3">Getting Started</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Every account has two ways of viewing the admin panel: <strong>Simple</strong> and <strong>Advanced</strong>.
              They're not separate products — it's the same data and the same account, just two different amounts of it
              on screen at once. You can switch between them any time from the toggle in the top navigation bar, and
              nothing you set up in one view disappears when you switch to the other.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              New accounts start in Simple mode. It's built for a solo operator or a small home-based business who
              mainly needs to see today's work, take orders, and get paid — a handful of clearly-labeled tiles instead
              of a full navigation bar. Advanced mode unlocks the complete system: multi-facility routing, commercial
              accounts, detailed financial reports, promotions, staff scheduling, and platform-wide settings. Most
              tenants start in Simple and move to Advanced naturally as the business grows and those extra tools
              become useful — there's no penalty for switching back and forth as needed.
            </p>
            <CalloutList>
              <Callout n={1}>If you're just getting set up, stay in Simple mode until the basics — business info, pricing, service area — are in place. The Simple hub has a built-in checklist for exactly this.</Callout>
              <Callout n={2}>If you're managing multiple facilities, drivers, or a mix of residential and commercial customers, switch to Advanced — you'll want the fuller Dispatch Board and Logistics tools.</Callout>
              <Callout n={3}>Your operating mode — "I run my own facility" vs. "I route jobs to a partner laundromat" — is set separately from Simple/Advanced, under Branding, and changes what a few screens look like in both modes.</Callout>
            </CalloutList>
          </section>

          {/* ══════════════════════════════════════════════ SIMPLE MODE ══════ */}
          <section id="simple-mode" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-1">Simple Mode</h2>
            <p className="text-gray-500 mb-6">The condensed view — everything a solo or home-based operator touches day to day.</p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2">The Simple Hub</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              This is what you land on after logging in. At the top is a short setup checklist that only shows while
              items remain — business info, at least one service ZIP code, and your first order. Once everything's
              checked off, the checklist disappears and you're left with a clean "Quick Access" grid of the handful of
              screens you'll use constantly.
            </p>
            <BrowserFrame title="yourbusiness.com/admin">
              <div className="p-4">
                <MockHeader items={["Dispatch", "Orders", "My Business", "Pricing"]} accent="Advanced ▸" />
                <div className="p-4">
                  <p className="text-sm font-bold" style={{ color: NAVY }}>Welcome back</p>
                  <div className="bg-white rounded-xl border border-gray-100 p-3 mt-3">
                    <p className="text-[11px] font-bold text-gray-400 mb-2">Getting set up (2/4)</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-green-600"><span>✓</span> Business name &amp; logo added</div>
                      <div className="flex items-center gap-2 text-xs text-green-600"><span>✓</span> Service ZIP codes added</div>
                      <div className="flex items-center gap-2 text-xs text-gray-400"><span>○</span> Take your first order</div>
                      <div className="flex items-center gap-2 text-xs text-gray-400"><span>○</span> Tell us how you work</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {["🚚 Dispatch","📦 Orders","🏠 My Business","💵 Pricing","📍 Service Area","👷 Workers"].map(t => (
                      <div key={t} className="bg-white rounded-lg border border-gray-100 px-2 py-2.5 text-[11px] font-medium" style={{ color: NAVY }}>{t}</div>
                    ))}
                  </div>
                </div>
              </div>
            </BrowserFrame>
            <CalloutList>
              <Callout n={1}>The setup checklist links directly to the screen you need — click any unfinished item to jump straight there.</Callout>
              <Callout n={2}>"Quick Access" always shows the same six tiles: Dispatch, Orders, My Business, Pricing, Service Area, and Workers — the daily-use core of running orders.</Callout>
              <Callout n={3}>Nothing in Advanced mode is hidden or disabled — it's simply not shown here to keep the screen uncluttered.</Callout>
            </CalloutList>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Today's Work / Dispatch</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              This is your live board of every order moving through the pipeline today — from a pending pickup through
              processing to out-for-delivery. If you operate from a home base rather than a fixed facility, this
              screen is called "Today's Work" instead and shows a simplified single-lane view built for one person
              juggling everything themselves, rather than the multi-column board used for larger operations.
            </p>
            <BrowserFrame title="yourbusiness.com/admin/dispatch">
              <div className="p-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Pending", tone: "amber" as const, items: ["#A213 · Customer A."] },
                  { label: "In Process", tone: "blue" as const, items: ["#A198 · Customer B."] },
                  { label: "Out for Delivery", tone: "green" as const, items: ["#A150 · Customer C."] },
                ].map(col => (
                  <div key={col.label} className="bg-white rounded-lg border border-gray-100 p-2">
                    <MockPill tone={col.tone}>{col.label}</MockPill>
                    {col.items.map(i => (
                      <div key={i} className="bg-gray-50 rounded-md px-2 py-1.5 text-[10px] mt-2 text-gray-500">{i}</div>
                    ))}
                  </div>
                ))}
              </div>
            </BrowserFrame>
            <CalloutList>
              <Callout n={1}>Click any order card to open its full detail page — reschedule pickup or delivery, assign a driver, or enter weight and photos.</Callout>
              <Callout n={2}>Cards move columns automatically as status changes come in from the driver and operator apps — you don't need to drag anything.</Callout>
            </CalloutList>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Taking Your First Order</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Most orders come in through your public booking page (see the Customer Booking Site section below) —
              customers pick a service, choose a pickup window, and pay. You can also create an order manually from
              the admin side for phone-in customers or commercial accounts; look for a "New Order" or "Create Order"
              action from Orders or from a specific Commercial Account's page. Manually-created orders skip the public
              checkout but still flow into the same Dispatch board and follow the same pickup-through-delivery pipeline.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">My Business (Branding)</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              This is where your business's identity lives: business name, logo, contact phone and address, and —
              importantly — your <strong>operating mode</strong>. Choosing "I run my own facility" vs. "I route to a
              partner laundromat" changes vocabulary and a few screens throughout the app (for example, "Facility
              Board" becomes "My Laundromats" in home mode). Set this once early on; it's easy to change later if your
              operation grows into a different shape.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Pricing</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Set your per-pound or per-item rates for each service you offer (Wash &amp; Fold, Comforter Wash, Wash
              Only, and any others you enable), plus minimums. These rates drive both what customers see on the public
              booking page and what gets charged automatically once a real weight is entered on an order.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Service Area</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Add the ZIP codes you're willing to pick up and deliver in. Customers outside these ZIP codes won't be
              able to book — this is usually the very first thing to set up, since without it your public site can't
              accept any real orders.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Workers (Simple)</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              A trimmed-down worker list for adding drivers and washing operators, setting their pay rates, and
              generating the 4-digit PINs they'll use to log into the field apps. If you're a true one-person
              operation, you may never need this screen — see "Act As" in Advanced Mode below for how to perform
              driver and operator duties yourself without a separate worker account.
            </p>
          </section>

          {/* ══════════════════════════════════════════════ ADVANCED MODE ════ */}
          <section id="advanced-mode" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-1">Advanced Mode</h2>
            <p className="text-gray-500 mb-6">The full admin surface — every module, unabbreviated.</p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2">Control Panel (Dashboard)</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Advanced mode's home screen shows live order stats (total, pending, in progress, delivered) up top,
              followed by a grid of modules — Operations, Customers, Logistics, Finance, Content, Staff, Commercial
              Accounts, and Settings. Each module card lists its most-used sub-pages directly so you rarely need more
              than two clicks to reach anything in the system.
            </p>
            <BrowserFrame title="yourbusiness.com/admin">
              <div className="p-4">
                <MockHeader items={["Dispatch","Orders","Search","Customers ▾","Logistics ▾","Finance ▾","Content ▾","Settings","Staff ▾"]} accent="🎭 Act As" />
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {["12","3","5","4"].map((n,i) => (
                    <MockCard key={i} title={["Total Orders","Pending","In Progress","Delivered"][i]}>
                      <p className="text-lg font-extrabold" style={{ color: NAVY }}>{n}</p>
                    </MockCard>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {["Operations","Customers","Logistics","Finance","Content","Staff"].map((m,i) => (
                    <MockCard key={m} title={m} color={["#1e3a8a","#7c3aed","#0891b2","#059669","#d97706","#be185d"][i]}>
                      <MockButton variant="outline">Enter →</MockButton>
                    </MockCard>
                  ))}
                </div>
              </div>
            </BrowserFrame>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Dispatch Board</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Dispatch is not a single board — it's four tabs sharing one stats row (Pickups, Transfers, Deliveries,
              At Facility counts for the day), each built for a different logistics job:
            </p>
            <BrowserFrame title="yourbusiness.com/admin/dispatch">
              <div className="p-4">
                <div className="flex gap-2 text-[10px] font-bold">
                  {["🗺️ Aerial View","🚗 Driver Routes","📦 Transfer Runs","🏭 Operator Assignments"].map((t,i) => (
                    <div key={t} className="rounded-md px-2 py-1.5" style={i === 0 ? { background: NAVY, color: "white" } : { background: "white", color: "#94a3b8", border: "1px solid #e5e7eb" }}>{t}</div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {["Pickups","Transfers","Deliveries","At Facility"].map(l => (
                    <div key={l} className="bg-white rounded-lg border border-gray-100 p-2 text-center">
                      <p className="text-[10px] font-bold text-gray-400">{l}</p>
                      <p className="text-sm font-extrabold" style={{ color: "#E8726A" }}>3</p>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserFrame>
            <CalloutList>
              <Callout n={1}><strong>🗺️ Aerial View</strong> — a map-first, drag-and-drop board of every order as a chip you can drag between buckets (derived from the order's real status) to reassign it, without opening the order. Best for a fast visual sweep of "what's where right now."</Callout>
              <Callout n={2}><strong>🚗 Driver Routes</strong> — assigns individual pickup and delivery orders to specific drivers, one order at a time. This is where you build each driver's stop list for the day.</Callout>
              <Callout n={3}><strong>📦 Transfer Runs</strong> — batches orders that need to move between your own facilities (e.g. storage → processing) into a single internal run, separate from customer-facing pickup/delivery driving.</Callout>
              <Callout n={4}><strong>🏭 Operator Assignments</strong> — assigns orders that have arrived at a facility to a specific operator/washer, so the Facility Board work is divided among your processing staff.</Callout>
            </CalloutList>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Orders &amp; Search</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              "Orders" lists every booking with filters by status, date, and service type. "Search" finds a specific
              order fast — by customer name, phone, email, or order code — which is the quickest path when a customer
              calls in asking about their laundry. Opening any order takes you to its detail page: full customer info,
              billing breakdown once weight's been entered, facility assignment, dispatch controls (reschedule, assign
              driver, cancel), a weight-entry card, photo-capture cards, and the full event timeline.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Customers</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Covers everything about who you're serving beyond one-off orders: recurring <strong>Subscriptions</strong>,
              flat-rate <strong>Monthly Plans</strong>, and <strong>Commercial Accounts</strong> — businesses (offices,
              medical practices, gyms) with a card on file, a negotiated rate, and often a recurring pickup schedule
              you set once and let run automatically. <strong>Gift Cards</strong> sold through your site also show up
              here, with balances and redemption history.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Logistics</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              The Logistics dropdown holds every screen for moving orders and managing where they're processed. It
              has more overlap than it looks — several names sound similar but do very different jobs, so the two
              distinctions below are worth reading closely.
            </p>

            <h4 className="text-base font-bold text-[#0D2240] mb-1.5 mt-5">🏭 Facility Board</h4>
            <p className="text-gray-600 leading-relaxed mb-3">
              The operator-facing pipeline for orders physically at a facility — loading, washing, drying, folding,
              and marking ready with a required "finished product &amp; location" photo before an order can move on.
              This is the admin-side mirror of what the Operator app shows (see Operator App below).
            </p>

            <h4 className="text-base font-bold text-[#0D2240] mb-1.5 mt-5">Route Management vs. Facility Routing — two different tools</h4>
            <p className="text-gray-600 leading-relaxed mb-3">
              These two are easy to confuse because both have "route" in the name, but they solve different problems:
            </p>
            <CalloutList>
              <Callout n={1}><strong>Delivery Routes</strong> ("Route Management") — defines your actual named pickup/delivery routes, their service areas, days of the week, and pickup/delivery time windows. This is the structural setup: which routes exist and when they run.</Callout>
              <Callout n={2}><strong>Route Optimizer</strong> ("Facility Routing") — despite the nav name, this page does not sequence a driver's stops. It's a bulk tool: select a batch of orders that are ready to move and assign all of them to a facility at once, with an automatic arrival notification once a driver marks the drop-off complete. Use this when you need to reassign many orders to a facility quickly rather than one at a time from each order's detail page.</Callout>
            </CalloutList>

            <h4 className="text-base font-bold text-[#0D2240] mb-1.5 mt-5">📦 Facility Transfers</h4>
            <p className="text-gray-600 leading-relaxed mb-3">
              Internal batch transfers between your own storage and processing facilities — separate from
              customer-facing pickup and delivery driving. Use this when bags need to physically move from one of
              your locations to another (for example, from a drop-off/storage point to the facility that actually
              washes). This is the same "Transfer Runs" work also reachable from the Dispatch tab of the same name.
            </p>

            <h4 className="text-base font-bold text-[#0D2240] mb-1.5 mt-5">🏢 Facilities</h4>
            <p className="text-gray-600 leading-relaxed mb-3">
              The list of every laundromat/processing facility you work with, each with its own detail page: address,
              contact info, the per-pound rate that determines what you pay that facility, and Stripe Connect payout
              status. This per-pound rate is what drives the "Facility Cost" line on every order processed there and
              the totals on any payout you issue — a missing or zero rate here is the single most common reason a
              payout total looks wrong.
            </p>

            <h4 className="text-base font-bold text-[#0D2240] mb-1.5 mt-5">Service Area Map vs. Service Areas — also two different pages</h4>
            <CalloutList>
              <Callout n={1}><strong>Service Areas</strong> (Zip Codes) — the literal list of ZIP codes you'll pick up and deliver in. Customers outside these ZIP codes can't book. This is the source of truth.</Callout>
              <Callout n={2}><strong>Service Area Map</strong> — a visual map view of that same coverage, useful for eyeballing gaps or overlaps at a glance rather than reading a list of codes.</Callout>
            </CalloutList>

            <h4 className="text-base font-bold text-[#0D2240] mb-1.5 mt-5">📅 Schedule &amp; Availability (Holidays)</h4>
            <p className="text-gray-600 leading-relaxed mb-3">
              Controls blocked dates and your platform's operating hours — block a holiday or a day you're closed so
              customers can't book pickups then, and set the hours during which pickup/delivery windows are offered
              on the public site.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Finance</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Reports gives you a Profit &amp; Loss view — revenue, labor payouts, facility costs, logged expenses, and
              net margin over any date range. Expenses lets you log real-world costs (detergent, gas, repairs)
              category by category so they factor into that P&amp;L. Pricing is the same rate table from Simple mode.
              Tips shows any tip pool collected and how it's being distributed to staff.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Content</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Everything customer-facing that isn't pricing or logistics: <strong>Promotions</strong> (discount codes),
              <strong> Site Images</strong>, <strong>Communication Templates</strong> (the actual text of every
              transactional email and SMS your customers receive — confirmation, on-the-way, delivered, receipt, and
              so on — editable per message), an <strong>FAQ Editor</strong> for your public site's help page, and a
              combined <strong>Docs &amp; FAQ</strong> screen where FAQ entries and your Terms of Service / Privacy
              Policy pages live side by side with a live preview before you publish either one.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Staff</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              The full Workers module — applications, approval, pay rates, Stripe Connect payout setup, PIN
              management, and Deactivate/Reactivate (a reversible way to remove someone from active rotation without
              deleting their history) — plus Hiring (applications, e-signed agreements, and onboarding status for
              new drivers/operators), Schedule (shift planning and roster), Timesheet (clocked hours per pay period),
              Staff Clock (a shared kiosk view anyone can use to clock in/out on a shared device), and direct links
              into the Driver and Operator field apps.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Order Intake Extras</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Two screens exist specifically for orders that don't come in through the normal driver pickup flow.
              <strong> Walk-In / Drop-Off</strong> is quick intake for a customer who brings bags to you in person —
              no pickup driver involved, the order starts already "at facility." <strong>Abandoned Checkouts</strong>
              lists customers who started booking on your public site but didn't finish paying, so you can follow up
              and recover the order manually.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Home Operating Mode: Today's Work &amp; My Laundromats</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              If your operating mode is set to "I route to a partner laundromat" rather than "I run my own facility,"
              two screens replace their facility-based equivalents everywhere in the nav. <strong>Today's Work</strong>
              (the Home-mode Dispatch equivalent) is a simplified single-lane board built for one person handling
              everything themselves, instead of the multi-column Dispatch tabs. <strong>My Laundromats</strong>
              replaces the Facilities list with a lighter-weight directory of the partner laundromats you route
              orders to, since you're not managing your own processing facility or its rate/payout details.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Testing &amp; Setup Tools</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              <strong>Print Station Setup</strong> connects a receipt/bag-label printer (via Web Bluetooth) so drivers
              and operators can print physical bag receipts and color-key labels. <strong>Test Station Hub</strong>
              is a developer-only screen (clearly marked) for exercising order flows without affecting real customer
              data or billing — not part of day-to-day operation.
            </p>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Act As</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              A dedicated pill in the top-right of the header — separate from the rest of the nav on purpose, since
              it's a different kind of action (who you're acting as, not another section to browse). It drops you
              straight into the Driver or Operator app as the account owner, with no PIN required and full visibility
              into every order at that station rather than just one worker's assignments. This exists specifically
              for solo and home-based operators who need to perform every role themselves.
            </p>
            <CalloutList>
              <Callout n={1}>If a real staff PIN was previously used on the same device or browser, Act As always takes priority — you'll land in your own owner view, not a leftover worker session.</Callout>
              <Callout n={2}>Look for the "👑 Owner view" pill in the corner of the driver/operator screen to confirm you're acting as the owner rather than a specific worker.</Callout>
            </CalloutList>

            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-8">Settings</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Platform configuration and legal documents — terms of service, privacy policy, and any account-level
              toggles not covered elsewhere.
            </p>
          </section>

          {/* ══════════════════════════════════════════════ DRIVER APP ═══════ */}
          <section id="driver-app" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-1">Driver App</h2>
            <p className="text-gray-500 mb-6">A phone-friendly station for whoever's doing pickups and deliveries.</p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Drivers log in with a 4-digit PIN set up under Staff → Workers — no email or password needed, so it's
              fast to hand a phone to someone new. Once logged in, they see only their own assigned pickups and
              deliveries for the day (unless acting as the owner via Act As, which shows everything at the station).
            </p>
            <PhoneFrame title="Driver — Today's Queue">
              <div className="p-3">
                <MockHeader items={[]} accent="🕐 Clock In" />
                <p className="text-xs font-bold mt-3" style={{ color: NAVY }}>Today's Queue</p>
                <div className="space-y-2 mt-2">
                  <div className="bg-white rounded-lg border border-gray-100 p-2">
                    <MockPill tone="amber">Pickup · 9am–1pm</MockPill>
                    <p className="text-xs font-semibold mt-1" style={{ color: NAVY }}>#A213 · 2 bags</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 p-2">
                    <MockPill tone="green">Delivery · 3pm–7pm</MockPill>
                    <p className="text-xs font-semibold mt-1" style={{ color: NAVY }}>#A150 · 1 bag</p>
                  </div>
                </div>
              </div>
            </PhoneFrame>
            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-6">The Pickup → Delivery Flow</h3>
            <CalloutList>
              <Callout n={1}><strong>Confirm pickup:</strong> tap an order, confirm the bag count matches what's booked (adjust if it doesn't — this reconciles automatically), and mark picked up.</Callout>
              <Callout n={2}><strong>Weigh &amp; drop off:</strong> weigh each bag, take a required photo showing where the bags were placed (facility or warehouse — internal only, never shown to the customer), and confirm drop-off. This is the step that calculates and charges the customer once weight is in.</Callout>
              <Callout n={3}><strong>Processing happens without the driver</strong> — the operator takes it from here (see Operator App below).</Callout>
              <Callout n={4}><strong>Collect for delivery:</strong> once the operator marks an order ready, the driver picks up the finished, packaged bags — using the operator's "finished product &amp; location" photo to find them — and takes their own pickup-confirmation photo.</Callout>
              <Callout n={5}><strong>Deliver:</strong> hand off to the customer and take a delivery photo — this one <em>is</em> customer-visible, on their order tracking page.</Callout>
            </CalloutList>
            <p className="text-gray-600 leading-relaxed mt-4">
              A built-in clock in/out widget sits right in the header, so drivers never need a separate trip to a
              staff-clock page just to start or end a shift.
            </p>
          </section>

          {/* ══════════════════════════════════════════════ OPERATOR APP ═════ */}
          <section id="operator-app" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-1">Operator App</h2>
            <p className="text-gray-500 mb-6">The in-facility processing station — washer, dryer, folding, and packaging.</p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Also PIN-gated, also acting-as-owner capable. The operator's queue is organized into four physical
              lanes — Needs Loading, In Washer, In Dryer, Ready to Fold — matching how bags actually move through a
              facility, rather than by abstract order status.
            </p>
            <PhoneFrame title="Operator — Today's Queue">
              <div className="p-3">
                <MockHeader items={[]} accent="🖨️ Print Station" />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {["🧺 Needs Loading","🌀 In Washer","💨 In Dryer","👕 Ready to Fold"].map(l => (
                    <div key={l} className="bg-white rounded-lg border border-gray-100 p-2 text-center">
                      <p className="text-[10px] font-bold" style={{ color: NAVY }}>{l}</p>
                      <p className="text-lg font-extrabold" style={{ color: "#E8726A" }}>1</p>
                    </div>
                  ))}
                </div>
              </div>
            </PhoneFrame>
            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-6">Processing an Order</h3>
            <CalloutList>
              <Callout n={1}>Move a bag from Needs Loading into the washer — this is the step where actual weight gets recorded and, for most orders, is exactly what triggers the customer's charge (unless weight was already entered by the driver at drop-off).</Callout>
              <Callout n={2}>Washer → dryer → folded, tracked per bag so a mixed-status order (some bags further along than others) is always visible.</Callout>
              <Callout n={3}>Before an order can leave "finished," the Facility Board requires a photo of the packaged bags and exactly where they're placed — this is what the driver uses later to find and grab the right order without guessing.</Callout>
            </CalloutList>
          </section>

          {/* ══════════════════════════════════════════════ CUSTOMER SITE ════ */}
          <section id="customer-site" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-1">Customer Booking Site</h2>
            <p className="text-gray-500 mb-6">The public-facing side — what your customers actually see and use.</p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Your public site is branded with the business name, logo, and colors set under My Business. Customers
              choose a service (Wash &amp; Fold, Comforter Wash, or any others you've enabled), enter their pickup
              address and preferred window, and pay through Stripe at checkout — for weight-based services, this is
              typically a pre-authorization that gets finalized once the real weight is in, not a final charge
              up front.
            </p>
            <BrowserFrame title="yourbusiness.com">
              <div className="p-6">
                <p className="text-lg font-extrabold text-center" style={{ color: NAVY }}>Book Your Pickup</p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {["👕 Wash & Fold","🛏 Comforter","💧 Wash Only"].map(s => (
                    <div key={s} className="bg-white rounded-lg border border-gray-100 p-2 text-center text-[11px] font-semibold" style={{ color: NAVY }}>{s}</div>
                  ))}
                </div>
                <div className="flex justify-center mt-4">
                  <MockButton>Schedule Pickup →</MockButton>
                </div>
              </div>
            </BrowserFrame>
            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-6">Customer Accounts</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              Customers who create an account can see their order history, live status, pickup/delivery photos
              (customer pickup and delivery photos only — internal handling photos stay private), and paid invoices
              from their own dashboard, without needing to call in for updates. A public order-tracking link works
              even without an account, for guest checkouts.
            </p>
            <h3 className="text-lg font-bold text-[#0D2240] mb-2 mt-6">Gift Cards &amp; Promotions</h3>
            <p className="text-gray-600 leading-relaxed mb-3">
              If enabled, customers can purchase gift cards directly from your site — these show up under Customers →
              Gift Cards in the admin, with balance and redemption tracking. Promo codes set under Content → Promotions
              apply automatically at checkout when a customer enters a valid one.
            </p>
          </section>

          {/* ══════════════════════════════════════════════ MOBILE ═══════════ */}
          <section id="mobile" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-3">Using Admin on Mobile</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              The admin panel is fully usable from a phone. On narrower screens, the full navigation bar collapses
              into a single hamburger button in the top-right; tapping it opens a full-screen menu with the same
              sections as desktop, organized as a single scrollable column with large tap targets — Act As at the
              top, the main nav below it as expandable sections, then view/language toggles, then sign out pinned to
              the bottom.
            </p>
            <PhoneFrame title="Admin — Mobile Menu">
              <div className="p-3">
                <div className="flex items-center justify-between px-1">
                  <span className="font-extrabold text-sm" style={{ color: NAVY }}>Wash<span style={{ color: "#E8726A" }}>Fold</span></span>
                  <span className="text-xs">✕</span>
                </div>
                <div className="mt-3 rounded-lg p-2" style={{ background: NAVY }}>
                  <p className="text-[10px] font-bold" style={{ color: "#E8726A" }}>🎭 ACT AS</p>
                  <div className="bg-white/10 rounded-md px-2 py-1.5 mt-1 text-[10px] text-white">👑 Admin (current)</div>
                </div>
              </div>
            </PhoneFrame>
            <p className="text-gray-600 leading-relaxed mb-3">
              The Driver and Operator apps were designed mobile-first from the start — they're what your field staff
              use on their own phones every day — so those two need no special accommodation on mobile at all.
            </p>
          </section>

          {/* ══════════════════════════════════════════════ FAQ ══════════════ */}
          <section id="faq" className="scroll-mt-6">
            <h2 className="text-2xl font-extrabold text-[#0D2240] mb-3">FAQ &amp; Troubleshooting</h2>

            <div className="space-y-5">
              <div>
                <p className="font-bold text-[#0D2240] text-sm">Why is billing showing "pending" on an order?</p>
                <p className="text-gray-600 text-sm mt-1">Billing can't be calculated until an actual weight has been entered — by the driver at drop-off, by the operator when loading the washer, or manually from the order's admin page. Once weight is in, the customer is charged (or their pre-auth captured) automatically.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D2240] text-sm">A driver or operator was accidentally deactivated / needs to be removed — what happens to their past orders?</p>
                <p className="text-gray-600 text-sm mt-1">Deactivating a worker is reversible and never deletes their history — past orders, time punches, and payouts referencing them stay exactly as they were. They simply stop appearing as available for new PIN logins or assignments until reactivated.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D2240] text-sm">Why don't I see the Act As pill?</p>
                <p className="text-gray-600 text-sm mt-1">It's a dedicated pill in the header, separate from the rest of the nav, next to the Simple/Advanced toggle. If you don't see it, try a hard refresh — browser caching occasionally shows a stale header after an update.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D2240] text-sm">What's the difference between "Facility Drop-off," "Finished Product &amp; Facility Location," and "Driver Pickup of Clean Bags" photos?</p>
                <p className="text-gray-600 text-sm mt-1">Drop-off is the driver's photo of where they left dirty bags (facility or warehouse). Finished Product &amp; Location is the operator's photo once bags are washed, folded, and packaged — showing exactly where to find them. Driver Pickup of Clean Bags is the driver's own accountability photo when collecting those finished bags. All three are internal-only; customers only ever see their own pickup and delivery photos.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D2240] text-sm">A facility payout looks wrong — what determines the amount?</p>
                <p className="text-gray-600 text-sm mt-1">Facility payouts sum each order's facility cost (weight × that facility's per-pound rate) across delivered orders in the chosen date range, then transfer that exact total via Stripe Connect. Double-check the facility's rate under Logistics → Facilities if a payout total looks off — a missing or zero rate is the most common cause.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D2240] text-sm">What's the difference between "Route Optimizer" and "Delivery Routes"?</p>
                <p className="text-gray-600 text-sm mt-1">Delivery Routes defines your named routes, service areas, and time windows — the structural setup. Route Optimizer (in-page titled "Facility Routing") is a bulk-assignment tool: select a batch of ready orders and assign all of them to a facility at once. Neither one sequences a driver's individual stops — that's done per-order from the Driver Routes tab in Dispatch.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D2240] text-sm">Which Dispatch tab should I use?</p>
                <p className="text-gray-600 text-sm mt-1">Aerial View for a fast visual sweep and quick drag-to-reassign; Driver Routes to build out a specific driver's stop list; Transfer Runs for internal facility-to-facility moves; Operator Assignments to divide facility work among your washing/folding staff.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D2240] text-sm">What's the difference between "Service Areas" and "Service Area Map"?</p>
                <p className="text-gray-600 text-sm mt-1">Service Areas (Zip Codes) is the actual list of ZIP codes you cover — the source of truth customers' addresses are checked against. Service Area Map is a visual map of that same coverage, useful for spotting gaps at a glance.</p>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
