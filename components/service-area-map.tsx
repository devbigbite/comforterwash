"use client"

import { useEffect, useRef } from "react"

interface Props {
  polygon: object | null
}

export function ServiceAreaMap({ polygon }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link")
      link.id = "leaflet-css"
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }

    const existing = document.querySelector('script[src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"]')
    const load = (onload: () => void) => {
      if (existing) { onload(); return }
      const s = document.createElement("script")
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      s.onload = onload
      document.head.appendChild(s)
    }

    load(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L
      if (!mapRef.current || mapInstance.current) return

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([28.48, -81.35], 10)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      if (polygon) {
        try {
          const layer = L.geoJSON(polygon, {
            style: {
              color: "#0D2240",
              weight: 2.5,
              fillColor: "#E8726A",
              fillOpacity: 0.20,
              dashArray: "",
            },
          })
          layer.addTo(map)
          map.fitBounds(layer.getBounds(), { padding: [40, 40] })

          layer.on("click", () => {
            layer.bindPopup(
              `<div style="font-family:sans-serif;padding:4px 6px">
                <strong style="color:#0D2240;font-size:14px">WashFold Orlando</strong><br/>
                <span style="color:#666;font-size:12px">Service delivery zone</span>
              </div>`
            ).openPopup()
          })
        } catch {
          // invalid geojson — show default view
        }
      }

      mapInstance.current = map
    })

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapInstance.current) { (mapInstance.current as any).remove(); mapInstance.current = null }
    }
  }, [polygon])

  if (!polygon) {
    return (
      <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 flex items-center justify-center shadow-sm" style={{ height: "480px" }}>
        <div className="text-center text-gray-400">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="font-semibold text-sm">Service area map coming soon</p>
          <p className="text-xs mt-1">Use the ZIP checker below to see if we serve your area</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden shadow-md border border-gray-100"
      style={{ height: "480px" }}
    />
  )
}
