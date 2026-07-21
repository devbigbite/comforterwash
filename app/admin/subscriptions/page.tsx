import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { pauseSubscription, resumeSubscription, cancelSubscription, forcecancelSubscription } from "@/app/actions/subscriptions"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

async function pauseSub(id: string) {
  "use server"
  await pauseSubscription(id)
  revalidatePath("/admin/subscriptions")
}

async function resumeSub(id: string) {
  "use server"
  await resumeSubscription(id)
  revalidatePath("/admin/subscriptions")
}

async function cancelSub(id: string) {
  "use server"
  await cancelSubscription(id)
  revalidatePath("/admin/subscriptions")
}

async function forceCancelSub(id: string) {
  "use server"
  await forcecancelSubscription(id)
  revalidatePath("/admin/subscriptions")
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function daysUntil(d?: string | null): number {
  if (!d) return 0
  const diff = new Date(d + "T12:00:00").getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

const DAY_LABEL: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday",
}

export default async function SubscriptionsPage() {
  await requireAdmin()
  const [supabase, locationId] = [createAdminClient(), await getLocationId()]
  const { data: subsData, error: subsError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
  if (subsError) console.error("[admin/subscriptions] Failed to load subscriptions:", subsError.message)
  const subs = subsData ?? []

  const perPickup   = subs.filter(s => s.subscription_type !== "monthly_plan")
  const monthly     = subs.filter(s => s.subscription_type === "monthly_plan")

  const activeCount    = subs.filter(s => s.status === "active").length
  const pausedCount    = subs.filter(s => s.status === "paused").length
  const cancelledCount = subs.filter(s => s.status === "cancelled").length
  const monthlyActive  = monthly.filter(s => s.status === "active").length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0D2240]">Subscriptions</h1>
        <p className="text-sm text-gray-400 mt-1">Recurring customers — per-pickup schedules and monthly plans.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active",         value: activeCount,    color: "text-green-700 bg-green-50"  },
          { label: "Paused",         value: pausedCount,    color: "text-amber-700 bg-amber-50"  },
          { label: "Cancelled",      value: cancelledCount, color: "text-gray-500  bg-gray-100"  },
          { label: "Monthly plans",  value: monthlyActive,  color: "text-blue-700  bg-blue-50"   },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-extrabold text-[#0D2240]`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Monthly Plans ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-extrabold text-sm uppercase tracking-wide text-[#0D2240] mb-3">
          Monthly Plans ({monthly.filter(s => s.status === "active").length} active)
        </h2>
        <div className="space-y-4">
          {monthly.length === 0 && <p className="text-sm text-gray-400 py-4">No monthly plan subscribers yet.</p>}
          {monthly.map(s => {
            const lbsUsed     = s.lbs_used_this_cycle   ?? 0
            const lbsTotal    = s.lbs_included           ?? 0
            const pct         = lbsTotal > 0 ? Math.min(100, Math.round((lbsUsed / lbsTotal) * 100)) : 0
            const daysLeft    = daysUntil(s.cycle_end)
            const committed   = daysUntil(s.commitment_ends_at) > 0
            const canCancel   = !committed && s.status !== "cancelled"
            const isOver      = lbsUsed > lbsTotal && lbsTotal > 0

            return (
              <div key={s.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${s.status === "cancelled" ? "opacity-50" : "border-gray-100"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Name + badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-extrabold text-[#0D2240]">{s.customer_name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        s.status === "active" ? "bg-green-50 text-green-700"
                          : s.status === "paused" ? "bg-amber-50 text-amber-700"
                          : "bg-gray-100 text-gray-500"}`}>{s.status}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">Monthly plan</span>
                      {committed && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                          Committed until {fmtDate(s.commitment_ends_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-3">{s.customer_email} · {s.customer_phone}</p>

                    {/* Usage bar */}
                    {lbsTotal > 0 && s.status !== "cancelled" && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className={`font-bold ${isOver ? "text-red-600" : "text-[#0D2240]"}`}>
                            {lbsUsed} / {lbsTotal} lbs used this cycle
                            {isOver && <span className="ml-1 text-red-500">⚠ over by {lbsUsed - lbsTotal} lbs</span>}
                          </span>
                          <span className="text-gray-400">{pct}% · {daysLeft}d left</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-[#0D2240]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>Cycle: {fmtDate(s.cycle_start)} – {fmtDate(s.cycle_end)}</span>
                          {s.overage_rate_cents && <span>Overage: ${(s.overage_rate_cents / 100).toFixed(2)}/lb</span>}
                        </div>
                      </div>
                    )}

                    {/* Schedule */}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                      <span><span className="font-bold text-[#E8726A]">↑</span> {DAY_LABEL[s.pickup_day_of_week] ?? s.pickup_day_of_week} · {s.pickup_time_window}</span>
                      <span><span className="font-bold text-[#0D2240]">↓</span> {DAY_LABEL[s.delivery_day_of_week] ?? s.delivery_day_of_week} · {s.delivery_time_window}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {s.status === "active" && (
                      <form action={pauseSub.bind(null, s.id)}>
                        <button className="text-[10px] font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors uppercase tracking-wide">Pause</button>
                      </form>
                    )}
                    {s.status === "paused" && (
                      <form action={resumeSub.bind(null, s.id)}>
                        <button className="text-[10px] font-bold text-green-700 border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors uppercase tracking-wide">Resume</button>
                      </form>
                    )}
                    {canCancel ? (
                      <form action={cancelSub.bind(null, s.id)}>
                        <button className="text-[10px] font-bold text-red-400 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors uppercase tracking-wide">Cancel</button>
                      </form>
                    ) : committed && s.status !== "cancelled" ? (
                      <span title={`Commitment ends ${fmtDate(s.commitment_ends_at)}`}
                        className="text-[10px] font-bold text-gray-300 border border-gray-100 bg-gray-50 px-3 py-1.5 rounded-lg uppercase tracking-wide cursor-not-allowed">
                        Locked
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Per-Pickup Subscriptions ──────────────────────────────────────── */}
      <section>
        <h2 className="font-extrabold text-sm uppercase tracking-wide text-[#0D2240] mb-3">
          Per-Pickup Subscriptions ({perPickup.filter(s => s.status === "active").length} active)
        </h2>
        <div className="space-y-3">
          {perPickup.length === 0 && <p className="text-sm text-gray-400 py-4">No per-pickup subscribers yet.</p>}
          {perPickup.filter(s => s.status !== "cancelled").map(s => {
            const nextPickup = s.next_pickup_date
              ? new Date(s.next_pickup_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
              : "—"
            const completed   = s.pickups_completed ?? 0
            const inCommitment = completed < 3
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-extrabold text-[#0D2240]">{s.customer_name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        s.status === "active" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{s.status}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full capitalize">{s.frequency}</span>
                      {s.stripe_customer_id && <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">✓ Card saved</span>}
                      {inCommitment && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                          🔒 Compromiso: {completed}/3 recogidas
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{s.customer_email} · {s.customer_phone}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2">
                      <span><span className="font-bold text-[#E8726A]">↑</span> Every {DAY_LABEL[s.pickup_day_of_week] ?? s.pickup_day_of_week} · {s.pickup_time_window}</span>
                      <span><span className="font-bold text-[#0D2240]">↓</span> Every {DAY_LABEL[s.delivery_day_of_week] ?? s.delivery_day_of_week} · {s.delivery_time_window}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Next pickup: <strong className="text-[#0D2240]">{nextPickup}</strong></span>
                      {s.price_per_lb_cents > 0 && <span>${(s.price_per_lb_cents / 100).toFixed(2)}/lb</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {s.status === "active" && (
                      inCommitment ? (
                        <span title="Cliente aún en compromiso mínimo (3 recogidas)"
                          className="text-[10px] font-bold text-gray-300 border border-gray-100 bg-gray-50 px-3 py-1.5 rounded-lg uppercase tracking-wide cursor-not-allowed">
                          Pausar 🔒
                        </span>
                      ) : (
                        <form action={pauseSub.bind(null, s.id)}>
                          <button className="text-[10px] font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors uppercase tracking-wide">Pause</button>
                        </form>
                      )
                    )}
                    {s.status === "paused" && (
                      <form action={resumeSub.bind(null, s.id)}>
                        <button className="text-[10px] font-bold text-green-700 border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors uppercase tracking-wide">Resume</button>
                      </form>
                    )}
                    {inCommitment ? (
                      <details className="relative">
                        <summary className="text-[10px] font-bold text-gray-300 border border-gray-100 bg-gray-50 px-3 py-1.5 rounded-lg uppercase tracking-wide cursor-pointer list-none">
                          Cancelar 🔒
                        </summary>
                        <div className="absolute right-0 top-8 z-10 bg-white border border-red-200 rounded-xl shadow-lg p-3 w-56 text-xs">
                          <p className="text-red-700 font-semibold mb-2">⚠ Cliente en compromiso ({completed}/3 recogidas)</p>
                          <p className="text-gray-500 mb-3">¿Cancelar de todas formas? Esto anula el compromiso mínimo.</p>
                          <form action={forceCancelSub.bind(null, s.id)}>
                            <button className="w-full text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg uppercase tracking-wide transition-colors">
                              Sí, cancelar igual
                            </button>
                          </form>
                        </div>
                      </details>
                    ) : (
                      <form action={cancelSub.bind(null, s.id)}>
                        <button className="text-[10px] font-bold text-red-400 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors uppercase tracking-wide">Cancel</button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {/* Cancelled (collapsed) */}
          {perPickup.filter(s => s.status === "cancelled").length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 py-2">
                Show {perPickup.filter(s => s.status === "cancelled").length} cancelled
              </summary>
              <div className="space-y-2 mt-2 opacity-50">
                {perPickup.filter(s => s.status === "cancelled").map(s => (
                  <div key={s.id} className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-500 line-through">{s.customer_name}</p>
                      <p className="text-xs text-gray-400">{s.customer_email}</p>
                    </div>
                    <span className="text-xs text-gray-400 capitalize">{s.frequency}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>
    </div>
  )
}
