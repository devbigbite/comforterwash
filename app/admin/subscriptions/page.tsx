import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

async function pauseSub(id: string) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("subscriptions").update({ status: "paused" }).eq("id", id)
  revalidatePath("/admin/subscriptions")
}

async function resumeSub(id: string) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("subscriptions").update({ status: "active" }).eq("id", id)
  revalidatePath("/admin/subscriptions")
}

async function cancelSub(id: string) {
  "use server"
  const supabase = createAdminClient()
  await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", id)
  revalidatePath("/admin/subscriptions")
}

const DAY_LABEL: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri",
}

const TIME_LABEL: Record<string, string> = {
  "9am-1pm": "9am–1pm",
  "3pm-7pm": "3pm–7pm",
}

export default async function SubscriptionsPage() {
  const supabase = createAdminClient()
  const { data: subs = [] } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false })

  const active    = subs.filter(s => s.status === "active")
  const paused    = subs.filter(s => s.status === "paused")
  const cancelled = subs.filter(s => s.status === "cancelled")

  const totalActive    = active.length
  const totalPaused    = paused.length
  const totalCancelled = cancelled.length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Subscriptions</h1>
        <p className="text-sm text-gray-400">Recurring wash &amp; fold customers — weekly and biweekly schedules.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Active",    value: totalActive,    color: "text-green-700 bg-green-50"  },
          { label: "Paused",    value: totalPaused,    color: "text-amber-700 bg-amber-50"  },
          { label: "Cancelled", value: totalCancelled, color: "text-gray-500 bg-gray-100"   },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-3xl font-extrabold text-[#0D2240]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Active */}
      <SectionHeader title="Active Subscriptions" count={totalActive} />
      <div className="space-y-3 mb-8">
        {active.length === 0 && <Empty text="No active subscriptions yet." />}
        {active.map(s => (
          <SubCard key={s.id} sub={s}>
            <form action={pauseSub.bind(null, s.id)}>
              <button className="text-[10px] font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors uppercase tracking-wide">
                Pause
              </button>
            </form>
            <form action={cancelSub.bind(null, s.id)}>
              <button className="text-[10px] font-bold text-red-400 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors uppercase tracking-wide">
                Cancel
              </button>
            </form>
          </SubCard>
        ))}
      </div>

      {/* Paused */}
      {paused.length > 0 && (
        <>
          <SectionHeader title="Paused" count={totalPaused} muted />
          <div className="space-y-3 mb-8">
            {paused.map(s => (
              <SubCard key={s.id} sub={s} dim>
                <form action={resumeSub.bind(null, s.id)}>
                  <button className="text-[10px] font-bold text-green-700 border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors uppercase tracking-wide">
                    Resume
                  </button>
                </form>
                <form action={cancelSub.bind(null, s.id)}>
                  <button className="text-[10px] font-bold text-red-400 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors uppercase tracking-wide">
                    Cancel
                  </button>
                </form>
              </SubCard>
            ))}
          </div>
        </>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <>
          <SectionHeader title="Cancelled" count={totalCancelled} muted />
          <div className="space-y-2 opacity-50">
            {cancelled.slice(0, 10).map(s => (
              <div key={s.id} className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-500 line-through">{s.customer_name}</p>
                  <p className="text-xs text-gray-400">{s.customer_email}</p>
                </div>
                <span className="text-xs text-gray-400 capitalize">{s.frequency}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, count, muted }: { title: string; count: number; muted?: boolean }) {
  return (
    <h2 className={`font-extrabold text-sm uppercase tracking-wide mb-3 ${muted ? "text-gray-400" : "text-[#0D2240]"}`}>
      {title} ({count})
    </h2>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-4">{text}</p>
}

const DAY_LABEL2: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday",
}

function SubCard({
  sub,
  children,
  dim,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sub: Record<string, any>
  children?: React.ReactNode
  dim?: boolean
}) {
  const hasStripe   = !!sub.stripe_customer_id
  const nextPickup  = sub.next_pickup_date
    ? new Date(sub.next_pickup_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "—"

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${dim ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-extrabold text-[#0D2240]">{sub.customer_name}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
              sub.status === "active" ? "bg-green-50 text-green-700"
                : sub.status === "paused" ? "bg-amber-50 text-amber-700"
                : "bg-gray-100 text-gray-500"
            }`}>{sub.status}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
              {sub.frequency}
            </span>
            {hasStripe && (
              <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                ✓ Card saved
              </span>
            )}
          </div>

          {/* Contact */}
          <p className="text-xs text-gray-400 mb-3">{sub.customer_email} · {sub.customer_phone}</p>

          {/* Schedule */}
          <div className="flex gap-6 text-xs mb-2">
            <div>
              <span className="font-bold text-[#E8726A] mr-1">↑ Pickup</span>
              <span className="text-gray-600">
                Every {DAY_LABEL2[sub.pickup_day_of_week] ?? sub.pickup_day_of_week}
                {" · "}{TIME_LABEL[sub.pickup_time_window] ?? sub.pickup_time_window}
              </span>
            </div>
            <div>
              <span className="font-bold text-[#0D2240] mr-1">↓ Delivery</span>
              <span className="text-gray-600">
                Every {DAY_LABEL2[sub.delivery_day_of_week] ?? sub.delivery_day_of_week}
                {" · "}{TIME_LABEL[sub.delivery_time_window] ?? sub.delivery_time_window}
              </span>
            </div>
          </div>

          {/* Next pickup + rate */}
          <div className="flex gap-4 text-xs text-gray-500">
            <span>Next pickup: <strong className="text-[#0D2240]">{nextPickup}</strong></span>
            <span>${(sub.price_per_lb_cents / 100).toFixed(2)}/lb</span>
            {sub.detergent && sub.detergent !== "standard" && (
              <span className="capitalize text-gray-400">{sub.detergent}</span>
            )}
          </div>

          {/* Add-ons */}
          {(sub.fabric_softener || sub.oxi_clean || sub.color_safe_bleach) && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {sub.fabric_softener   && <span className="text-[9px] bg-pink-50   text-pink-600   px-2 py-0.5 rounded-full font-bold">🌸 Fabric Softener</span>}
              {sub.oxi_clean         && <span className="text-[9px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">✨ OXI Clean</span>}
              {sub.color_safe_bleach && <span className="text-[9px] bg-blue-50   text-blue-600   px-2 py-0.5 rounded-full font-bold">🎨 Color-Safe Bleach</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">{children}</div>
      </div>
    </div>
  )
}
