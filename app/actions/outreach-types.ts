// ─── Types ───────────────────────────────────────────────────────────────────

export type OutreachSegment =
  | "airbnb_property_manager"
  | "hotel_bnb"
  | "corporate_office"
  | "government_institutional"
  | "fitness_spa"
  | "other"

export type ProspectStage =
  | "cold"
  | "contacted"
  | "interested"
  | "proposal_sent"
  | "negotiating"
  | "closed_won"
  | "closed_lost"

export type PitchTemplate = {
  id: string
  slug: string
  title: string
  segment: OutreachSegment
  status: "draft" | "active" | "archived"
  tagline: string | null
  cover_headline: string | null
  intro_paragraph: string | null
  services_offered: ServiceItem[]
  value_props: ValueProp[]
  pricing_table: PricingRow[]
  closing_statement: string | null
  view_count: number
  created_at: string
  updated_at: string
}

export type ServiceItem = {
  name: string
  description: string
  price_note: string
}

export type ValueProp = {
  icon: string
  title: string
  body: string
}

export type PricingRow = {
  item: string
  unit: string
  price: string
  notes: string
}

export type Prospect = {
  id: string
  business_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  segment: OutreachSegment
  stage: ProspectStage
  pitch_template_id: string | null
  proposal_sent_at: string | null
  proposal_viewed_at: string | null
  estimated_lbs_per_week: number | null
  estimated_monthly_value: number | null
  notes: string | null
  next_follow_up: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

// ─── Segment & Stage Labels ───────────────────────────────────────────────────

export const SEGMENT_LABELS: Record<OutreachSegment, string> = {
  airbnb_property_manager: "Airbnb / STR Manager",
  hotel_bnb: "Hotel & B&B",
  corporate_office: "Corporate / Office",
  government_institutional: "Government / Institutional",
  fitness_spa: "Fitness & Spa",
  other: "Other",
}

export const STAGE_LABELS: Record<ProspectStage, string> = {
  cold: "Cold",
  contacted: "Contacted",
  interested: "Interested",
  proposal_sent: "Proposal Sent",
  negotiating: "Negotiating",
  closed_won: "Closed — Won",
  closed_lost: "Closed — Lost",
}

export const STAGE_COLORS: Record<ProspectStage, string> = {
  cold: "bg-slate-100 text-slate-600",
  contacted: "bg-blue-100 text-blue-700",
  interested: "bg-yellow-100 text-yellow-700",
  proposal_sent: "bg-purple-100 text-purple-700",
  negotiating: "bg-orange-100 text-orange-700",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-red-100 text-red-600",
}
