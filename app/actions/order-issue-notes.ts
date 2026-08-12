"use server"

// Lets staff flag a detail/issue about a specific order (a stain that
// wouldn't come out, a missing or extra item, damage, etc.) and — after
// manual review — send it to the customer by email and/or SMS. Notes start
// as drafts; nothing goes to the customer until someone explicitly clicks
// Send. This is separate from the automated pickup/delivery lifecycle
// emails/texts, and separate from the internal-only order_events audit
// trail (which never reaches the customer — see app/track/[code]/page.tsx's
// publicEventTypes whitelist).

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-guard"
import { getLocationId } from "@/lib/location"
import { revalidatePath } from "next/cache"
import { sendOrderIssueEmail } from "@/lib/email"
import { sendSMS } from "@/lib/sms"

export interface OrderIssueNote {
  id: string
  booking_id: string
  note: string
  status: "draft" | "sent"
  created_by: string | null
  created_at: string
  sent_at: string | null
  sent_by: string | null
  sent_email: boolean
  sent_sms: boolean
}

export async function getOrderIssueNotes(bookingId: string): Promise<OrderIssueNote[]> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("order_issue_notes")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
  return (data ?? []) as OrderIssueNote[]
}

export async function createOrderIssueNote(bookingId: string, note: string): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()
  const trimmed = note.trim()
  if (!trimmed) return { error: "Note can't be empty" }

  const supabase = createAdminClient()
  const locationId = await getLocationId()

  const { error } = await supabase.from("order_issue_notes").insert({
    booking_id: bookingId,
    location_id: locationId,
    note: trimmed,
    status: "draft",
    created_by: "admin",
  })

  if (error) {
    console.error("[order-issue-notes] insert failed:", error)
    return { error: "Failed to save note" }
  }

  revalidatePath(`/admin/orders/${bookingId}`)
  return { success: true }
}

export async function deleteOrderIssueNote(noteId: string, bookingId: string): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  // Sent notes are a record of what the customer was actually told — only
  // drafts can be discarded.
  const { data: existing } = await supabase
    .from("order_issue_notes")
    .select("status")
    .eq("id", noteId)
    .single()
  if (existing?.status === "sent") return { error: "Can't delete a note that's already been sent" }

  const { error } = await supabase.from("order_issue_notes").delete().eq("id", noteId)
  if (error) return { error: "Failed to delete note" }

  revalidatePath(`/admin/orders/${bookingId}`)
  return { success: true }
}

export async function sendOrderIssueNote(noteId: string): Promise<{ success?: boolean; error?: string; sentEmail?: boolean; sentSms?: boolean }> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: noteRow } = await supabase
    .from("order_issue_notes")
    .select("id, booking_id, note, status")
    .eq("id", noteId)
    .single()
  if (!noteRow) return { error: "Note not found" }
  if (noteRow.status === "sent") return { error: "This note has already been sent" }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, short_code, customer_name, customer_email, customer_phone")
    .eq("id", noteRow.booking_id)
    .single()
  if (!booking) return { error: "Order not found" }

  let sentEmail = false
  let sentSms = false

  if (booking.customer_email) {
    const result = await sendOrderIssueEmail({
      customerName: booking.customer_name ?? "there",
      customerEmail: booking.customer_email,
      note: noteRow.note,
      shortCode: booking.short_code ?? undefined,
    })
    sentEmail = !!result && !result.error
  }

  if (booking.customer_phone) {
    const firstName = (booking.customer_name ?? "there").split(" ")[0]
    const smsResult = await sendSMS(
      booking.customer_phone,
      `Hi ${firstName}, a quick note about your order${booking.short_code ? ` #${booking.short_code}` : ""}: ${noteRow.note}`
    )
    sentSms = smsResult.success
  }

  if (!sentEmail && !sentSms) {
    return { error: "Failed to send — no valid contact method reached (check email/SMS config and customer contact info)" }
  }

  await supabase
    .from("order_issue_notes")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: "admin",
      sent_email: sentEmail,
      sent_sms: sentSms,
    })
    .eq("id", noteId)

  revalidatePath(`/admin/orders/${noteRow.booking_id}`)
  return { success: true, sentEmail, sentSms }
}
