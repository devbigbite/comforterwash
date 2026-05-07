"use client"

import { useLang } from "@/components/lang-provider"

export function BookingPageTitle() {
  const { translations: tr } = useLang()
  return <>{tr.form.schedulePickup}</>
}
