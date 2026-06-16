"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function setAdminLangCookie(lang: "en" | "es") {
  const cookieStore = await cookies()
  cookieStore.set("admin_lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  })
  revalidatePath("/admin", "layout")
}

export async function getAdminLang(): Promise<"en" | "es"> {
  const cookieStore = await cookies()
  const val = cookieStore.get("admin_lang")?.value
  return val === "es" ? "es" : "en"
}
