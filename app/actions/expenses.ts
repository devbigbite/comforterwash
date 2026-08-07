"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export type ExpenseCategory =
  | "rent" | "utilities" | "supplies" | "equipment" | "insurance"
  | "marketing" | "software" | "vehicle" | "facility_processing" | "labor_other" | "other"

export interface Expense {
  id: string
  location_id: string
  expense_date: string
  category: ExpenseCategory
  amount_cents: number
  note: string | null
  created_by: string
  created_at: string
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "rent",                 label: "Rent" },
  { value: "utilities",            label: "Utilities" },
  { value: "supplies",             label: "Supplies (detergent, bags, tags)" },
  { value: "equipment",            label: "Equipment" },
  { value: "insurance",            label: "Insurance" },
  { value: "marketing",            label: "Marketing" },
  { value: "software",             label: "Software / subscriptions" },
  { value: "vehicle",              label: "Vehicle (gas, maintenance)" },
  { value: "facility_processing",  label: "Facility processing (manual entry)" },
  { value: "labor_other",          label: "Labor (other than driver/operator payouts)" },
  { value: "other",                label: "Other" },
]

// ── List expenses in a date range ────────────────────────────────────────────
export async function getExpenses(from: string, to: string): Promise<Expense[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("location_id", locationId)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })

  return (data ?? []) as Expense[]
}

// ── Add an expense ───────────────────────────────────────────────────────────
export async function addExpense(
  _prev: { success?: boolean; error?: string },
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()

  const expenseDate = formData.get("expense_date") as string
  const category     = formData.get("category") as string
  const amountRaw    = formData.get("amount") as string
  const note          = (formData.get("note") as string)?.trim() || null

  if (!expenseDate) return { error: "Date is required" }
  if (!category) return { error: "Category is required" }

  const amount = parseFloat(amountRaw)
  if (!amountRaw || isNaN(amount) || amount <= 0) return { error: "Enter a valid amount greater than $0" }

  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { error } = await supabase.from("expenses").insert({
    location_id:  locationId,
    expense_date: expenseDate,
    category,
    amount_cents: Math.round(amount * 100),
    note,
    created_by:   "admin",
  })

  if (error) {
    console.error("[expenses] insert failed:", error.message)
    return { error: error.message }
  }

  revalidatePath("/admin/expenses")
  revalidatePath("/admin/reports")
  return { success: true }
}

// ── Delete an expense ────────────────────────────────────────────────────────
export async function deleteExpense(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = formData.get("id") as string
  if (!id) return

  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("location_id", locationId)

  if (error) console.error("[expenses] delete failed:", error.message)

  revalidatePath("/admin/expenses")
  revalidatePath("/admin/reports")
}
