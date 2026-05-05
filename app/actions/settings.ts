"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getComforterPromo(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "comforter_flat_rate_promo")
      .single()
    return data?.value === "true"
  } catch {
    return false
  }
}

export async function setComforterPromo(active: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase.from("settings").upsert({
    key: "comforter_flat_rate_promo",
    value: active ? "true" : "false",
    updated_at: new Date().toISOString(),
  })
  revalidatePath("/admin/settings")
}
