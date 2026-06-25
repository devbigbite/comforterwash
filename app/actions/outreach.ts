"use server"

import { createClient } from "@/lib/supabase/server"

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

// ─── Pitch Template Actions ───────────────────────────────────────────────────

export async function listPitchTemplates(): Promise<PitchTemplate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commercial_pitch_templates")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return data as PitchTemplate[]
}

export async function getPitchTemplate(slug: string): Promise<PitchTemplate | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commercial_pitch_templates")
    .select("*")
    .eq("slug", slug)
    .single()
  if (error) return null
  return data as PitchTemplate
}

export async function createPitchTemplate(input: {
  title: string
  slug: string
  segment: OutreachSegment
  tagline?: string
}): Promise<{ id?: string; slug?: string; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commercial_pitch_templates")
    .insert({
      title: input.title,
      slug: input.slug,
      segment: input.segment,
      tagline: input.tagline ?? null,
      status: "draft",
    })
    .select("id, slug")
    .single()
  if (error) return { error: error.message }
  return { id: data.id, slug: data.slug }
}

export async function updatePitchTemplate(
  id: string,
  updates: Partial<Omit<PitchTemplate, "id" | "created_at" | "updated_at" | "view_count">>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("commercial_pitch_templates")
    .update(updates)
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function deletePitchTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("commercial_pitch_templates")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function incrementTemplateViewCount(id: string) {
  const supabase = await createClient()
  await supabase.rpc("increment_pitch_view", { template_id: id })
}

// ─── Prospect / Pipeline Actions ─────────────────────────────────────────────

export async function listProspects(): Promise<Prospect[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commercial_prospects")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return data as Prospect[]
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commercial_prospects")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return null
  return data as Prospect
}

export async function createProspect(input: {
  business_name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  segment: OutreachSegment
  stage?: ProspectStage
  pitch_template_id?: string
  notes?: string
  estimated_lbs_per_week?: number
  estimated_monthly_value?: number
  next_follow_up?: string
  assigned_to?: string
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commercial_prospects")
    .insert({
      business_name: input.business_name,
      contact_name: input.contact_name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      segment: input.segment,
      stage: input.stage ?? "cold",
      pitch_template_id: input.pitch_template_id ?? null,
      notes: input.notes ?? null,
      estimated_lbs_per_week: input.estimated_lbs_per_week ?? null,
      estimated_monthly_value: input.estimated_monthly_value ?? null,
      next_follow_up: input.next_follow_up ?? null,
      assigned_to: input.assigned_to ?? null,
    })
    .select("id")
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function updateProspect(
  id: string,
  updates: Partial<Omit<Prospect, "id" | "created_at" | "updated_at">>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("commercial_prospects")
    .update(updates)
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteProspect(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("commercial_prospects")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function markProposalSent(
  prospectId: string
): Promise<{ error?: string }> {
  return updateProspect(prospectId, {
    proposal_sent_at: new Date().toISOString(),
    stage: "proposal_sent",
  })
}
