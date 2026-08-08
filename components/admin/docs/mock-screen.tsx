// ── Labeled UI mockups for the tenant manual ──────────────────────────────────
// These are illustrative diagrams, not live screenshots — built with the same
// colors/shapes as the real app so they read as accurate at a glance, with
// numbered callouts explaining what each part does. Kept as static components
// (no real tenant data) so this page is safe to show any tenant, including
// ones who haven't placed an order yet.

import type { ReactNode } from "react"

const NAVY = "#0D2240"
const CORAL = "#E8726A"

export function BrowserFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 shadow-md overflow-hidden bg-white my-6">
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
        </div>
        <div className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-1 text-[11px] text-gray-400 ml-2 truncate">
          {title}
        </div>
      </div>
      <div className="bg-[#f0f4fa]">{children}</div>
    </div>
  )
}

export function PhoneFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-6 flex flex-col items-center">
      <div className="w-full max-w-[340px] rounded-[2rem] border-8 border-gray-900 shadow-xl overflow-hidden bg-white">
        <div className="bg-gray-900 h-5 flex items-center justify-center">
          <div className="w-20 h-3 bg-black rounded-full" />
        </div>
        <div className="bg-[#f7f8fb] min-h-[300px]">{children}</div>
      </div>
      <p className="text-xs text-gray-400 mt-2">{title}</p>
    </div>
  )
}

export function Callout({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 mb-2 last:mb-0">
      <span
        className="shrink-0 w-5 h-5 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center mt-0.5"
        style={{ background: CORAL }}
      >
        {n}
      </span>
      <p className="text-sm text-gray-600 leading-snug">{children}</p>
    </div>
  )
}

export function CalloutList({ children }: { children: ReactNode }) {
  return <div className="bg-white rounded-xl border border-gray-100 p-4 mt-3">{children}</div>
}

// ── Small reusable mock UI atoms ──────────────────────────────────────────────

export function MockHeader({ items, accent }: { items: string[]; accent?: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-4 text-white text-[11px] font-semibold" style={{ background: NAVY }}>
      <span className="font-extrabold">Wash<span style={{ color: CORAL }}>Fold</span></span>
      {items.map(i => <span key={i} className="text-white/70">{i}</span>)}
      {accent && (
        <span className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: CORAL }}>{accent}</span>
      )}
    </div>
  )
}

export function MockCard({ title, children, color }: { title: string; children?: ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3" style={color ? { borderTop: `3px solid ${color}` } : undefined}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">{title}</p>
      {children}
    </div>
  )
}

export function MockButton({ children, variant = "coral" }: { children: ReactNode; variant?: "coral" | "navy" | "outline" }) {
  const styles =
    variant === "coral" ? { background: CORAL, color: "white" } :
    variant === "navy"  ? { background: NAVY, color: "white" } :
    { background: "white", color: NAVY, border: `1.5px solid ${NAVY}` }
  return (
    <span className="inline-block rounded-lg px-3 py-1.5 text-[11px] font-bold" style={styles}>
      {children}
    </span>
  )
}

export function MockPill({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "amber" | "blue" }) {
  const tones: Record<string, string> = {
    gray:  "bg-gray-100 text-gray-500",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    blue:  "bg-blue-100 text-blue-700",
  }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${tones[tone]}`}>{children}</span>
}
