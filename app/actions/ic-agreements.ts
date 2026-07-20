"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

export async function getIcAgreements() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("ic_agreements")
    .select("id, role, lang, body, version, updated_at, updated_by")
    .order("role")
    .order("lang")
  return data ?? []
}

export async function getIcAgreement(role: string, lang: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("ic_agreements")
    .select("body, version")
    .eq("role", role)
    .eq("lang", lang)
    .maybeSingle()
  return data?.body ?? null
}

export async function saveIcAgreement(role: string, lang: string, body: string) {
  await requireAdmin()
  const supabase = createAdminClient()

  // Fetch current version to increment
  const { data: current } = await supabase
    .from("ic_agreements")
    .select("version")
    .eq("role", role)
    .eq("lang", lang)
    .maybeSingle()

  const nextVersion = (current?.version ?? 0) + 1

  const { error } = await supabase
    .from("ic_agreements")
    .upsert(
      {
        role,
        lang,
        body: body.trim(),
        version: nextVersion,
        updated_at: new Date().toISOString(),
        updated_by: "admin",
      },
      { onConflict: "role,lang", ignoreDuplicates: false }
    )

  if (error) return { error: error.message }

  revalidatePath("/admin/hiring/agreements")
  revalidatePath("/apply")
  return { success: true }
}
