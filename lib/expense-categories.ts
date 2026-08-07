export type ExpenseCategory =
  | "rent" | "utilities" | "supplies" | "equipment" | "insurance"
  | "marketing" | "software" | "vehicle" | "facility_processing" | "labor_other" | "other"

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
