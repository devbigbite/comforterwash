"use client"

import { useRef, useEffect } from "react"
import Script from "next/script"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AddressParts {
  street: string
  /**
   * Apartment / unit / suite. Sourced from Google's `subpremise` component
   * when the picked suggestion carries one, otherwise salvaged from whatever
   * the customer typed into the street box (see extractUnit).
   *
   * This used to not exist, and the consequences were invisible and bad: the
   * form had no unit field at all, and selecting a Google suggestion
   * overwrote the input with just "<number> <route>" — so a customer who
   * typed "10229 Dwell Court Apt 302" and then tapped the suggestion had
   * "Apt 302" silently deleted in front of them. Orders from multi-unit
   * buildings arrived undeliverable with no indication anything was lost.
   */
  unit: string
  city: string
  state: string
  zip: string
}

// Trailing unit designator in a hand-typed street line: "123 Main St Apt 4B",
// "500 Oak Ave #12", "9 Pine Rd, Suite 200". Deliberately anchored to the end
// so it can't eat part of a street name (e.g. the "Fl" in "Flagler St" is not
// matched — a designator must be followed by an actual unit token).
const UNIT_RE = /[,\s]+((?:apt|apartment|unit|ste|suite|bldg|building|rm|room|fl|floor|lot|trlr|#)\.?\s*#?\s*[\w-]+)\s*$/i

/** Pull a trailing "Apt 4B" / "#12" / "Suite 200" off a typed street line. */
export function extractUnit(raw: string): { street: string; unit: string } {
  const m = raw.match(UNIT_RE)
  if (!m) return { street: raw.trim(), unit: "" }
  return {
    street: raw.slice(0, m.index).replace(/[,\s]+$/, "").trim(),
    unit:   m[1].replace(/\s+/g, " ").trim(),
  }
}

interface AddressAutocompleteProps {
  value: string
  onChange: (street: string) => void
  onPlaceSelect: (parts: AddressParts) => void
  placeholder?: string
  className?: string
}

// ── Singleton script-load tracker ────────────────────────────────────────────
// Shared across all instances so the script only loads + inits once.
let scriptReady = false
const pendingInits: (() => void)[] = []

function onScriptLoad() {
  scriptReady = true
  pendingInits.splice(0).forEach(fn => fn())
}

function whenReady(fn: () => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (scriptReady && (window as any).google?.maps?.places) {
    fn()
  } else {
    pendingInits.push(fn)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Street address",
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null)

  // Keep callback refs up to date without re-running effects
  const onChangeRef      = useRef(onChange)
  const onPlaceSelectRef = useRef(onPlaceSelect)
  useEffect(() => { onChangeRef.current      = onChange      })
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect })

  // Sync external value changes (e.g. profile pre-fill, sameAddress copy)
  // directly to the DOM via ref — avoids remounting and killing autocomplete.
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = value
    }
  }, [value])

  // Init autocomplete once after the Maps script loads
  useEffect(() => {
    function init() {
      if (!inputRef.current || acRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).google?.maps?.places?.Autocomplete) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ac = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["address_components"],
      })

      ac.addListener("place_changed", () => {
        const place = ac.getPlace()
        if (!place?.address_components) return

        // Whatever the customer actually typed, captured BEFORE we overwrite
        // the box below — this is the only place a hand-typed unit still
        // exists, and it is about to be destroyed.
        const typed = inputRef.current?.value ?? ""

        let streetNumber = ""
        let route        = ""
        let subpremise   = ""
        let city         = ""
        let state        = ""
        let zip          = ""

        for (const comp of place.address_components) {
          if      (comp.types.includes("street_number"))               streetNumber = comp.long_name
          else if (comp.types.includes("route"))                       route        = comp.long_name
          else if (comp.types.includes("subpremise"))                  subpremise   = comp.long_name
          else if (comp.types.includes("locality"))                    city         = comp.long_name
          else if (comp.types.includes("administrative_area_level_1")) state        = comp.short_name
          else if (comp.types.includes("postal_code"))                 zip          = comp.long_name
        }

        const street = [streetNumber, route].filter(Boolean).join(" ")

        // Prefer Google's own subpremise; fall back to salvaging the unit the
        // customer typed. Never emit "" when they gave us something — losing
        // it here is exactly the bug this component used to have.
        const unit = subpremise || extractUnit(typed).unit

        // Overwrite what Google put in the box (full address) with just the
        // street. Safe now only because `unit` was rescued above and is
        // surfaced in its own field by the caller.
        if (inputRef.current) inputRef.current.value = street

        onPlaceSelectRef.current({ street, unit, city, state, zip })
      })

      acRef.current = ac
    }

    whenReady(init)

    return () => {
      if (acRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).google?.maps?.event?.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
    // Effect intentionally runs only once — callbacks are kept live via refs above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Script
        id="google-places-api"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
        onLoad={onScriptLoad}
        onError={() => { /* script failed to load — input remains functional as plain text */ }}
      />
      {/*
        Uncontrolled input (defaultValue, not value) so React never fights
        Google Places over the DOM node's content. External value changes are
        pushed in via the useEffect + ref above.
      */}
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={e => onChangeRef.current(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          // Matches shadcn <Input> base styles exactly
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          // Per-site colour overrides (same as the booking forms use)
          "h-12 border-gray-200 focus:border-[#E8726A] text-sm",
          className
        )}
      />
    </>
  )
}
