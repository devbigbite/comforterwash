"use client"

import { useEffect, useRef } from "react"

// Approximate center coordinates for Orlando-area zip codes
const ZIP_COORDS: Record<string, [number, number]> = {
  "32801": [28.5383, -81.3792],
  "32803": [28.5545, -81.3566],
  "32804": [28.5672, -81.3978],
  "32805": [28.5244, -81.3940],
  "32806": [28.5122, -81.3641],
  "32807": [28.5461, -81.3153],
  "32808": [28.5794, -81.4345],
  "32809": [28.4727, -81.3788],
  "32810": [28.6195, -81.3940],
  "32811": [28.5308, -81.4416],
  "32812": [28.4949, -81.3366],
  "32814": [28.5672, -81.3341],
  "32817": [28.5908, -81.2551],
  "32818": [28.5794, -81.4703],
  "32819": [28.4697, -81.4655],
  "32820": [28.5626, -81.1032],
  "32821": [28.4196, -81.4658],
  "32822": [28.5122, -81.3153],
  "32824": [28.3877, -81.3532],
  "32825": [28.5449, -81.2827],
  "32826": [28.5908, -81.2159],
  "32827": [28.3761, -81.2691],
  "32828": [28.5658, -81.1987],
  "32829": [28.4582, -81.3153],
  "32831": [28.5126, -81.1300],
  "32832": [28.3590, -81.2300],
  "32835": [28.5197, -81.4797],
  "32836": [28.4466, -81.4797],
  "32837": [28.3761, -81.4345],
  "32839": [28.4727, -81.4032],
  "34741": [28.2919, -81.4078],
  "34743": [28.3133, -81.3532],
  "34744": [28.2919, -81.3785],
  "34745": [28.3044, -81.4078],
  "34746": [28.2378, -81.4345],
  "34747": [28.2378, -81.5565],
  "34748": [28.5503, -81.8921],
  "34758": [28.1758, -81.4345],
  "34759": [28.1291, -81.4655],
  "34769": [28.2378, -81.3153],
  "34771": [28.5254, -81.1606],
  "34772": [28.2108, -81.2981],
  "34773": [28.1758, -81.1606],
  "32703": [28.6609, -81.5118],
  "32712": [28.7101, -81.5118],
  "32751": [28.6267, -81.3531],
  "32757": [28.7544, -81.3193],
  "32771": [28.7544, -81.2859],
  "32789": [28.6012, -81.3531],
  "32792": [28.6012, -81.2859],
}

interface ZipArea {
  zip_code: string
  city: string
  active: boolean
}

export function ServiceAreaMap({ areas }: { areas: ZipArea[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link")
      link.id = "leaflet-css"
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }

    // Load Leaflet JS then init map
    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L
      if (!mapRef.current || mapInstance.current) return

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false })
        .setView([28.50, -81.38], 10)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      const active = areas.filter(a => a.active)

      active.forEach(area => {
        const coords = ZIP_COORDS[area.zip_code]
        if (!coords) return

        L.circle(coords, {
          radius: 2200,
          color: "#0D2240",
          weight: 1.5,
          fillColor: "#E8726A",
          fillOpacity: 0.30,
        }).addTo(map).bindPopup(
          `<div style="font-family:sans-serif;padding:2px 4px">
            <strong style="color:#0D2240;font-size:15px">${area.zip_code}</strong><br/>
            <span style="color:#666;font-size:12px">${area.city}, FL</span>
          </div>`
        )
      })

      // Fit map to all shown markers if any
      const validCoords = active
        .map(a => ZIP_COORDS[a.zip_code])
        .filter(Boolean) as [number, number][]

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords)
        map.fitBounds(bounds, { padding: [40, 40] })
      }

      mapInstance.current = map
    }
    document.head.appendChild(script)

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapInstance.current) { (mapInstance.current as any).remove(); mapInstance.current = null }
    }
  }, [areas])

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden shadow-md border border-gray-100"
      style={{ height: "480px" }}
    />
  )
}
