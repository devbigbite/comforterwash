"use server"

import { createClient } from "@/lib/supabase/server"
import { getLocationId } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

export interface EmailTemplateVariable {
  key: string
  label: string
  example: string
}

export interface EmailTemplate {
  key: string
  name: string
  audience: "customer" | "admin" | "staff" | "facility"
  subject: string
  headline: string
  body: string
  cta_text: string | null
  footer_note: string | null
  alert_box: string | null
  contact_note: string | null
  variables: EmailTemplateVariable[]
  updated_at: string
}

// ── Fetch all templates for this location ─────────────────────────────────────
export async function getEmailTemplates(audience?: string): Promise<EmailTemplate[]> {
  const [supabase, locationId] = await Promise.all([createClient(), getLocationId()])
  let query = supabase
    .from("email_templates")
    .select("*")
    .eq("location_id", locationId)
    .order("audience")
    .order("name")

  if (audience) query = query.eq("audience", audience)

  const { data, error } = await query
  if (error) { console.error("[email-templates] getEmailTemplates:", error); return [] }
  return (data ?? []) as EmailTemplate[]
}

// ── Fetch a single template by key for this location ─────────────────────────
export async function getEmailTemplate(key: string): Promise<EmailTemplate | null> {
  const [supabase, locationId] = await Promise.all([createClient(), getLocationId()])
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("location_id", locationId)
    .eq("key", key)
    .single()

  if (error) { console.error("[email-templates] getEmailTemplate:", error); return null }
  return data as EmailTemplate
}

// ── Save (update) a template ──────────────────────────────────────────────────
export async function upsertEmailTemplate(
  key: string,
  updates: {
    subject: string; headline: string; body: string; cta_text?: string | null; footer_note?: string | null; alert_box?: string | null; contact_note?: string | null }
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const [supabase, locationId] = await Promise.all([createClient(), getLocationId()])
  const { error } = await supabase
    .from("email_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("location_id", locationId)
    .eq("key", key)

  if (error) {
    console.error("[email-templates] upsertEmailTemplate:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
