"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-guard"
import type {
  OutreachSegment,
  ProspectStage,
  PitchTemplate,
  Prospect,
} from "./outreach-types"

// ─── Pitch Template Actions ───────────────────────────────────────────────────

export async function listPitchTemplates(): Promise<PitchTemplate[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("commercial_pitch_templates")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return data as PitchTemplate[]
}

// Intentionally NOT admin-gated — this is what powers the public prospect-facing
// /pitch/[slug] page. The slug itself acts as the access token (unguessable),
// same trust model as e.g. a Stripe payment link.
export async function getPitchTemplate(slug: string): Promise<PitchTemplate | null> {
  const supabase = createAdminClient()
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
  await requireAdmin()
  const supabase = createAdminClient()
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
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("commercial_pitch_templates")
    .update(updates)
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function deletePitchTemplate(id: string): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("commercial_pitch_templates")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

// Intentionally NOT admin-gated — fired from the public pitch page when a
// prospect views their proposal.
export async function incrementTemplateViewCount(id: string) {
  const supabase = createAdminClient()
  await supabase.rpc("increment_pitch_view", { template_id: id })
}

// ─── Prospect / Pipeline Actions ─────────────────────────────────────────────
// All of these carry prospect PII (name, phone, email, business info) and are
// admin/CRM-only — never reachable from a public page.

export async function listProspects(): Promise<Prospect[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("commercial_prospects")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return data as Prospect[]
}

export async function getProspect(id: string): Promise<Prospect | null> {
  await requireAdmin()
  const supabase = createAdminClient()
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
  await requireAdmin()
  const supabase = createAdminClient()
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
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("commercial_prospects")
    .update(updates)
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteProspect(id: string): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
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
