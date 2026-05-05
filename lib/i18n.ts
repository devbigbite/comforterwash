/**
 * Lightweight i18n system.
 *
 * Designed to be drop-in compatible with next-intl when you're ready to upgrade:
 *   - Same namespace pattern: useTranslation("services")
 *   - Same t(key) usage
 *   - Translation files already structured as flat-keyed objects per namespace
 *
 * To upgrade to next-intl later:
 *   1. npm install next-intl
 *   2. Move lib/translations/en.ts → messages/en.json (convert to JSON)
 *   3. Add next-intl middleware + routing
 *   4. Replace useTranslation() with useTranslations() from "next-intl"
 */

import en from "./translations/en"
import es from "./translations/es"

export type Locale = "en" | "es"
export type Namespace = keyof typeof en

const translations = { en, es } as const

export function getTranslations(locale: Locale) {
  return translations[locale] ?? translations.en
}

export function t(locale: Locale, ns: Namespace, key: string): string {
  const dict = getTranslations(locale)
  const section = dict[ns] as Record<string, string>
  return section?.[key] ?? (translations.en[ns] as Record<string, string>)?.[key] ?? key
}
