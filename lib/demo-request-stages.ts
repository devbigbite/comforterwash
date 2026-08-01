// Shared between app/actions/platform-demo-requests.ts (a "use server" file,
// which can only export async functions — no plain constants or types) and
// the client-side funnel UI at app/super-admin/demo-requests/page.tsx.
export type DemoRequestStatus = "new" | "contacted" | "demo_viewed" | "negotiating" | "won" | "lost"

export const DEMO_REQUEST_STAGES: { value: DemoRequestStatus; label: string }[] = [
  { value: "new",         label: "New" },
  { value: "contacted",   label: "Contacted" },
  { value: "demo_viewed", label: "Demo Viewed" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won",         label: "Won" },
  { value: "lost",        label: "Lost" },
]
