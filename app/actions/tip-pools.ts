"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

/** Returns the Monday of the week containing `date` (UTC) */
function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day  // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function weekEnd(start: Date): Date {
  const d = new Date(start)
  d.setUTCDate(d.getUTCDate() + 6)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]
}

export interface WeekSummary {
  weekStart: string   // "YYYY-MM-DD"
  weekEnd: string
  totalCents: number
  orderCount: number
}

export interface TipPool {
  id: string
  week_start: string
  week_end: string
  total_cents: number
  worker_names: string[]
  worker_count: number
  per_worker_cents: number
  status: "open" | "paid"
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface ApprovedWorker {
  id: string
  name: string
  roles: string[]
}

/** Current week Mon-Sun tip totals from the bookings table */
export async function getCurrentWeekSummary(): Promise<WeekSummary> {
  const supabase = createAdminClient()
  const now = new Date()
  const start = weekStart(now)
  const end = weekEnd(start)

  const { data, error } = await supabase
    .from("bookings")
    .select("tip_cents")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .gt("tip_cents", 0)

  if (error) throw new Error(error.message)

  const totalCents = (data ?? []).reduce((s, b) => s + (b.tip_cents ?? 0), 0)
  return {
    weekStart: toDateStr(start),
    weekEnd: toDateStr(end),
    totalCents,
    orderCount: data?.length ?? 0,
  }
}

/** Approved workers who can be included in a tip pool */
export async function getApprovedWorkers(): Promise<ApprovedWorker[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("workers")
    .select("id, name, roles")
    .eq("status", "approved")
    .order("name")
  if (error) throw new Error(error.message)
  return (data ?? []) as ApprovedWorker[]
}

/** All tip pools, most-recent first */
export async function getTipPoolHistory(): Promise<TipPool[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("tip_pools")
    .select("*")
    .order("week_start", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TipPool[]
}

/** Close (record) the current week's tip pool with the selected workers */
export async function closeTipPool(
  weekStartStr: string,
  weekEndStr: string,
  totalCents: number,
  workerIds: string[],
  workerNames: string[],
  notes?: string,
): Promise<{ error?: string }> {
  if (workerIds.length === 0) return { error: "Select at least one worker." }
  const supabase = createAdminClient()

  const perWorkerCents = Math.floor(totalCents / workerIds.length)

  const { error } = await supabase
    .from("tip_pools")
    .upsert(
      {
        week_start: weekStartStr,
        week_end: weekEndStr,
        total_cents: totalCents,
        worker_ids: workerIds,
        worker_names: workerNames,
        worker_count: workerIds.length,
        per_worker_cents: perWorkerCents,
        status: "paid",
        paid_at: new Date().toISOString(),
        notes: notes ?? null,
      },
      { onConflict: "week_start" },
    )

  if (error) return { error: error.message }
  revalidatePath("/admin/tips")
  return {}
}

/** Reopen (mark as open) a previously closed pool */
export async function reopenTipPool(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("tip_pools")
    .update({ status: "open", paid_at: null })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/tips")
  return {}
}
