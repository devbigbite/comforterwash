/**
 * /admin/test  —  Test station hub
 *
 * Lets you open Admin / Driver / Operator side-by-side on 3 devices.
 * Seeds two test workers (fixed PINs) if they don't already exist.
 * Also lets you create a throwaway test booking to run the full flow.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import Image from "next/image"

export const dynamic = "force-dynamic"

// ── Seed test workers ─────────────────────────────────────────────────────────

const TEST_WORKERS = [
  { name: "Test Driver",   pin: "1111", roles: ["driver"],   location: "Orlando, FL" },
  { name: "Test Operator", pin: "2222", roles: ["operator"], location: "Orlando, FL" },
]

async function ensureTestWorkers() {
  const supabase = createAdminClient()

  for (const w of TEST_WORKERS) {
    const { data: existing } = await supabase
      .from("workers")
      .select("id")
      .eq("name", w.name)
      .maybeSingle()

    if (!existing) {
      await supabase.from("workers").insert({
        name:      w.name,
        email:     `${w.name.toLowerCase().replace(" ", ".")}@test.washfold`,
        phone:     "5550000000",
        roles:     w.roles,
        status:    "active",
        clock_pin: w.pin,
        address:   w.location,
      })
    } else {
      // Make sure PIN is set correctly even if worker already existed
      await supabase.from("workers").update({ clock_pin: w.pin, status: "active" }).eq("id", existing.id)
    }
  }
}

// ── Create a test booking ─────────────────────────────────────────────────────

async function createTestBooking(formData: FormData) {
  "use server"
  const supabase    = createAdminClient()
  const locationId  = formData.get("location_id") as string

  const today       = new Date()
  const pickup      = new Date(today); pickup.setDate(today.getDate() + 1)
  const delivery    = new Date(today); delivery.setDate(today.getDate() + 2)
  const toStr       = (d: Date) => d.toISOString().slice(0, 10)

  const { data } = await supabase.from("bookings").insert({
    location_id:          locationId,
    customer_name:        "Test Customer",
    customer_email:       "test@test.washfold",
    customer_phone:       "5550000001",
    customer_address:     "123 Test Street, Orlando, FL 32801",
    service_type:         "wash_fold",
    num_bags:             2,
    status:               "pending",
    pickup_date:          toStr(pickup),
    delivery_date:        toStr(delivery),
    pickup_time_window:   "9am–12pm",
    delivery_time_window: "9am–12pm",
    phase:                "intake",
    price_per_lb_cents:   250,
  }).select("id, short_code").single()

  if (data) {
    // Add 2 bags
    await supabase.from("order_bags").insert([
      { booking_id: data.id, bag_number: 1, label_code: `${data.short_code ?? data.id.slice(0,6).toUpperCase()}-B1`, status: "pending" },
      { booking_id: data.id, bag_number: 2, label_code: `${data.short_code ?? data.id.slice(0,6).toUpperCase()}-B2`, status: "pending" },
    ])
  }

  revalidatePath("/admin/test")
}

// ── Delete all test data ──────────────────────────────────────────────────────

async function resetTestData(formData: FormData) {
  "use server"
  const supabase   = createAdminClient()
  const locationId = formData.get("location_id") as string

  // Delete test bookings
  await supabase.from("bookings")
    .delete()
    .eq("location_id", locationId)
    .eq("customer_email", "test@test.washfold")

  revalidatePath("/admin/test")
}

// ── QR code image URL (free public API, no install) ───────────────────────────

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(data)}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TestHubPage() {
  await ensureTestWorkers()

  const supabase   = createAdminClient()
  const hdrs       = await headers()

  // Derive base URL from request host
  const host      = hdrs.get("host") ?? "localhost:3000"
  const protocol  = host.startsWith("localhost") ? "http" : "https"
  const base      = `${protocol}://${host}`

  // Fetch location_id
  const { data: loc } = await supabase.from("locations").select("id").limit(1).single()
  const locationId = loc?.id ?? ""

  // Fetch recent test bookings
  const { data: testBookings } = await supabase
    .from("bookings")
    .select("id, short_code, status, phase, pickup_date, delivery_date, created_at")
    .eq("customer_email", "test@test.washfold")
    .order("created_at", { ascending: false })
    .limit(5)

  // ── Station definitions ──────────────────────────────────────────────────────

  const stations = [
    {
      role:    "Admin",
      icon:    "🖥️",
      color:   "#0D2240",
      bg:      "#eff6ff",
      url:     `${base}/admin`,
      pin:     null,
      hint:    "Use your admin password to log in.",
      steps: [
        "Open the Facility Board",
        "Watch orders move through phases",
        "Assign color keys + take placement photo",
        "Toggle Floor vs Storage on finished orders",
      ],
    },
    {
      role:    "Driver",
      icon:    "🚐",
      color:   "#E8726A",
      bg:      "#fdf6f3",
      url:     `${base}/driver`,
      pin:     "1111",
      workerName: "Test Driver",
      hint:    "Enter PIN 1111 on the driver station.",
      steps: [
        "Pick up Test Customer order",
        "Weigh bags + drop at warehouse",
        "Start delivery run",
        "Confirm delivered",
      ],
    },
    {
      role:    "Operator",
      icon:    "🏭",
      color:   "#7c3aed",
      bg:      "#f5f3ff",
      url:     `${base}/operator`,
      pin:     "2222",
      workerName: "Test Operator",
      hint:    "Enter PIN 2222 on the operator station.",
      steps: [
        "Move order through washing phases",
        "Assign color key sticker",
        "Enter folded bag count",
        "Take placement photo",
        "Set Floor or Storage",
      ],
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🧪</span>
          <h1 className="text-2xl font-extrabold text-[#0D2240]">Test Station Hub</h1>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wide">Dev Only</span>
        </div>
        <p className="text-gray-400 text-sm">Open each URL on a separate phone or tablet and run the full order flow side by side.</p>
      </div>

      {/* Station cards */}
      <div className="grid md:grid-cols-3 gap-5 mb-10">
        {stations.map(s => (
          <div key={s.role} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ borderTop: `3px solid ${s.color}` }}>

            {/* Card header */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{s.icon}</span>
                <span className="font-extrabold text-[#0D2240] text-lg">{s.role}</span>
                {s.pin && (
                  <span className="ml-auto font-mono font-extrabold text-white text-sm px-2.5 py-1 rounded-lg" style={{ background: s.color }}>
                    PIN: {s.pin}
                  </span>
                )}
              </div>

              {/* QR code */}
              <div className="flex justify-center mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl(s.url)}
                  alt={`QR for ${s.role}`}
                  width={180} height={180}
                  className="rounded-xl border border-gray-100 shadow-sm"
                />
              </div>

              {/* URL */}
              <a href={s.url} target="_blank" rel="noreferrer"
                className="block text-center text-xs font-bold truncate hover:underline mb-1"
                style={{ color: s.color }}>
                {s.url}
              </a>
              <p className="text-center text-[11px] text-gray-400">{s.hint}</p>
            </div>

            {/* Steps checklist */}
            <div className="px-5 pb-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Test steps</p>
              <ol className="space-y-1.5">
                {s.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white mt-0.5" style={{ background: s.color }}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>

      {/* Test bookings section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="font-extrabold text-[#0D2240] text-base">Test Bookings</h2>
            <p className="text-gray-400 text-xs mt-0.5">Create a dummy order to run through the complete flow</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <form action={createTestBooking}>
              <input type="hidden" name="location_id" value={locationId} />
              <button className="bg-[#E8726A] hover:bg-[#d45f57] text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-colors uppercase tracking-wide">
                + Create Test Order
              </button>
            </form>
            {testBookings && testBookings.length > 0 && (
              <form action={resetTestData}>
                <input type="hidden" name="location_id" value={locationId} />
                <button className="bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors border border-gray-200 hover:border-red-200 uppercase tracking-wide">
                  🗑 Clear Test Data
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Test bookings list */}
        {!testBookings || testBookings.length === 0 ? (
          <div className="text-center py-8 text-gray-300 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="text-lg mb-1">No test orders yet</p>
            <p className="text-xs">Hit "Create Test Order" to generate one</p>
          </div>
        ) : (
          <div className="space-y-2">
            {testBookings.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-extrabold text-[#0D2240] text-sm">
                    {b.short_code?.toUpperCase() ?? b.id.slice(0, 6).toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">pickup {b.pickup_date} → delivery {b.delivery_date}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 uppercase">
                    {b.phase ?? b.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`/admin/orders/${b.id}`} target="_blank" rel="noreferrer"
                    className="text-[10px] font-bold text-[#0D2240] border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg hover:border-[#0D2240] transition-colors">
                    Admin ↗
                  </a>
                  <a href={`/driver/order/${b.id}`} target="_blank" rel="noreferrer"
                    className="text-[10px] font-bold text-[#E8726A] border border-[#E8726A]/30 bg-white px-2.5 py-1.5 rounded-lg hover:bg-[#fdf6f3] transition-colors">
                    Driver ↗
                  </a>
                  <a href={`/admin/facility`} target="_blank" rel="noreferrer"
                    className="text-[10px] font-bold text-purple-600 border border-purple-200 bg-white px-2.5 py-1.5 rounded-lg hover:bg-purple-50 transition-colors">
                    Board ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flow diagram */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-extrabold text-[#0D2240] text-base mb-4">Full Flow Reference</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: "Booking",          actor: "Admin",    color: "#0D2240" },
            { label: "Pickup",           actor: "Driver",   color: "#E8726A" },
            { label: "Warehouse Drop",   actor: "Driver",   color: "#E8726A" },
            { label: "Intake → Washing", actor: "Operator", color: "#7c3aed" },
            { label: "Drying → Folding", actor: "Operator", color: "#7c3aed" },
            { label: "Color Key + Photo",actor: "Operator", color: "#7c3aed" },
            { label: "Floor or Storage", actor: "Operator", color: "#7c3aed" },
            { label: "Driver Collects",  actor: "Driver",   color: "#E8726A" },
            { label: "Delivered ✓",      actor: "Driver",   color: "#E8726A" },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <span className="font-extrabold px-2.5 py-1 rounded-lg text-white text-[11px]" style={{ background: step.color }}>
                  {step.label}
                </span>
                <span className="text-[9px] text-gray-400 mt-0.5 font-semibold">{step.actor}</span>
              </div>
              {i < arr.length - 1 && <span className="text-gray-300 font-bold">→</span>}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
