"use client"

import { useRef, useEffect, useState } from "react"
import Script from "next/script"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AddressParts {
  street: string
  city: string
  state: string
  zip: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (street: string) => void
  onPlaceSelect: (parts: AddressParts) => void
  placeholder?: string
  className?: string
}

// ── Singleton script-load tracker (avoids double-init across instances) ───────
let scriptReady = false
const onReadyCallbacks: (() => void)[] = []

function notifyReady() {
  scriptReady = true
  onReadyCallbacks.splice(0).forEach(fn => fn())
}

function whenReady(fn: () => void) {
  if (scriptReady && window.google?.maps?.places) {
    fn()
  } else {
    onReadyCallbacks.push(fn)
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
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [, forceUpdate] = useState(0)

  function initAutocomplete() {
    if (!inputRef.current || acRef.current) return
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components"],
    })

    ac.addListener("place_changed", () => {
      const place = ac.getPlace()
      if (!place?.address_components) return

      let streetNumber = ""
      let route = ""
      let city = ""
      let state = ""
      let zip = ""

      for (const comp of place.address_components) {
        if (comp.types.includes("street_number"))              streetNumber = comp.long_name
        else if (comp.types.includes("route"))                  route = comp.long_name
        else if (comp.types.includes("locality"))               city = comp.long_name
        else if (comp.types.includes("administrative_area_level_1")) state = comp.short_name
        else if (comp.types.includes("postal_code"))            zip = comp.long_name
      }

      const street = [streetNumber, route].filter(Boolean).join(" ")

      // Set native input value to street-only before React re-render
      if (inputRef.current) inputRef.current.value = street

      onPlaceSelect({ street, city, state, zip })
    })

    acRef.current = ac
    forceUpdate(n => n + 1) // trigger re-render so value prop syncs after ac init
  }

  useEffect(() => {
    whenReady(initAutocomplete)
    return () => {
      // Clean up listener if component unmounts
      if (acRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Script
        id="google-places-api"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
        onLoad={notifyReady}
      />
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        key={value} /* re-sync when parent resets the field */
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          // Match shadcn <Input> base styles exactly
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          // Per-site overrides (same as forms use)
          "h-12 border-gray-200 focus:border-[#E8726A] text-sm",
          className
        )}
      />
    </>
  )
}
