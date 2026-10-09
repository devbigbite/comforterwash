import { createAdminClient } from "@/lib/supabase/admin"
import { verifyRecurringCancelToken } from "@/lib/recurring-cancel-token"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

async function confirmCancel(formData: FormData) {
  "use server"
  const token = (formData.get("token") as string) ?? ""
  const id = verifyRecurringCancelToken(token)
  if (!id) return
  const supabase = createAdminClient()
  await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", id).neq("subscription_type", "monthly_plan")
  revalidatePath(`/cancel-recurring/${token}`)
}

export default async function CancelRecurringPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const decoded = decodeURIComponent(token)
  const id = verifyRecurringCancelToken(decoded)

  let sub: { frequency: string; pickup_day_of_week: string; pickup_time_window: string; status: string } | null = null
  if (id) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("subscriptions")
      .select("frequency, pickup_day_of_week, pickup_time_window, status")
      .eq("id", id)
      .maybeSingle()
    sub = data
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
        {!sub ? (
          <>
            <h1 className="text-xl font-extrabold text-[#0D2240]">Link not valid</h1>
            <p className="text-sm text-gray-500">This cancel link is invalid or expired. Reply to your confirmation email and we&apos;ll take care of it.</p>
          </>
        ) : sub.status === "cancelled" ? (
          <>
            <h1 className="text-xl font-extrabold text-[#0D2240]">Recurring pickup cancelled</h1>
            <p className="text-sm text-gray-500">You won&apos;t be scheduled for any more recurring pickups. Any order already on its way will still be completed.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-[#0D2240]">Cancel your recurring pickup?</h1>
            <p className="text-sm text-gray-500">
              {sub.frequency === "biweekly" ? "Every 2 weeks" : "Every week"} · {sub.pickup_day_of_week ? sub.pickup_day_of_week.charAt(0).toUpperCase() + sub.pickup_day_of_week.slice(1) : ""} · {sub.pickup_time_window}
            </p>
            <form action={confirmCancel}>
              <input type="hidden" name="token" value={decoded} />
              <button type="submit" className="w-full bg-[#0D2240] text-white font-bold text-sm rounded-xl py-3">Yes, cancel recurring</button>
            </form>
            <p className="text-xs text-gray-400">No fees. Cancel anytime.</p>
          </>
        )}
      </div>
    </main>
  )
}
