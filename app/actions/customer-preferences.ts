"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId } from "@/lib/location"

// Sticky wash preferences (detergent + extras/softener/dryer sheets) keyed by
// customer phone number — the one identifier present on every order, guest
// checkout or signed-in account, one-time or recurring subscription.

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

export interface CustomerPreferences {
  detergentId: string | null
  extraIds: string[]
}

export async function getCustomerPreferences(phone: string): Promise<CustomerPreferences | null> {
  const normalized = normalizePhone(phone)
  if (normalized.length < 10) return null

  const locationId = await getLocationId()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("customer_preferences")
    .select("detergent_id, extra_ids")
    .eq("location_id", locationId)
    .eq("phone", normalized)
    .maybeSingle()

  if (!data) return null
  return { detergentId: data.detergent_id, extraIds: data.extra_ids ?? [] }
}

export async function saveCustomerPreferences(
  phone: string,
  detergentId: string | null,
  extraIds: string[]
): Promise<{ error?: string }> {
  const normalized = normalizePhone(phone)
  if (normalized.length < 10) return { error: "Invalid phone" }

  const locationId = await getLocationId()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("customer_preferences")
    .upsert({
      location_id: locationId,
      phone: normalized,
      detergent_id: detergentId,
      extra_ids: extraIds,
      updated_at: new Date().toISOString(),
    }, { onConflict: "location_id,phone" })

  if (error) return { error: error.message }
  return {}
}
