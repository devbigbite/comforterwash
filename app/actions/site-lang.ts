"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

// Public-site locale cookie — mirrors app/actions/admin-lang.ts. Layouts in
// the App Router can't read searchParams (only page.tsx can), so a cookie
// is the only reliable way for RootLayout to know the visitor's chosen
// language. revalidatePath("/", "layout") invalidates the whole tree so
// every page picks up the new value on next render.
export async function setSiteLangCookie(lang: "en" | "es") {
  const cookieStore = await cookies()
  cookieStore.set("wf_locale", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  })
  revalidatePath("/", "layout")
}

export async function getSiteLangCookie(): Promise<"en" | "es"> {
  const cookieStore = await cookies()
  const val = cookieStore.get("wf_locale")?.value
  return val === "es" ? "es" : "en"
}
