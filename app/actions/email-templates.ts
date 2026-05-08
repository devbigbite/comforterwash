"use server"

import { createClient } from "@/lib/supabase/server"

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
  variables: EmailTemplateVariable[]
  updated_at: string
}

// ── Fetch all templates (optionally filtered by audience) ─────────
export async function getEmailTemplates(audience?: string): Promise<EmailTemplate[]> {
  const supabase = await createClient()
  let query = supabase
    .from("email_templates")
    .select("*")
    .order("audience")
    .order("name")

  if (audience) query = query.eq("audience", audience)

  const { data, error } = await query
  if (error) { console.error("[email-templates] getEmailTemplates:", error); return [] }
  return (data ?? []) as EmailTemplate[]
}

// ── Fetch a single template by key ───────────────────────────────
export async function getEmailTemplate(key: string): Promise<EmailTemplate | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("key", key)
    .single()

  if (error) { console.error("[email-templates] getEmailTemplate:", error); return null }
  return data as EmailTemplate
}

// ── Save (upsert) a template ──────────────────────────────────────
export async function upsertEmailTemplate(
  key: string,
  updates: { subject: string; headline: string; body: string; cta_text?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("email_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("key", key)

  if (error) {
    console.error("[email-templates] upsertEmailTemplate:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
