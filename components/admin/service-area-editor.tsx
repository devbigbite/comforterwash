"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { setServiceAreaPolygon, deleteServiceAreaPolygon } from "@/app/actions/settings"

interface Props {
  initialPolygon: object | null
}

export function ServiceAreaEditor({ initialPolygon }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const drawnItems = useRef<unknown>(null)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "cleared">("idle")
  const [hasShape, setHasShape] = useState(!!initialPolygon)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    // Load Leaflet CSS
    function loadCSS(href: string, id: string) {
      if (document.getElementById(id)) return
      const link = document.createElement("link")
      link.id = id
      link.rel = "stylesheet"
      link.href = href
      document.head.appendChild(link)
    }

    loadCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "leaflet-css")
    loadCSS("https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css", "leaflet-draw-css")

    function loadScript(src: string, onload: () => void) {
      const existing = document.querySelector(`script[src="${src}"]`)
      if (existing) { onload(); return }
      const s = document.createElement("script")
      s.src = src
      s.onload = onload
      document.head.appendChild(s)
    }

    loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", () => {
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L
        if (!mapRef.current || mapInstance.current) return

        const map = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([28.48, -81.35], 10)

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map)

        // Layer to hold drawn shapes
        const drawn = new L.FeatureGroup()
        map.addLayer(drawn)
        drawnItems.current = drawn

        // Load existing polygon if any
        if (initialPolygon) {
          try {
            const layer = L.geoJSON(initialPolygon, {
              style: {
                color: "#0D2240",
                weight: 2,
                fillColor: "#E8726A",
                fillOpacity: 0.25,
              },
            })
            layer.eachLayer((l: unknown) => drawn.addLayer(l))
            map.fitBounds(layer.getBounds(), { padding: [40, 40] })
          } catch {
            // ignore parse errors
          }
        }

        // Draw controls
        const drawControl = new L.Control.Draw({
          edit: { featureGroup: drawn },
          draw: {
            polygon: {
              allowIntersection: false,
              shapeOptions: {
                color: "#0D2240",
                weight: 2,
                fillColor: "#E8726A",
                fillOpacity: 0.25,
              },
            },
            polyline: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
          },
        })
        map.addControl(drawControl)

        // When a new shape is drawn, replace any existing one
        map.on(L.Draw.Event.CREATED, (e: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const event = e as any
          drawn.clearLayers()
          drawn.addLayer(event.layer)
          setHasShape(true)
        })

        map.on(L.Draw.Event.DELETED, () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((drawn as any).getLayers().length === 0) setHasShape(false)
        })

        mapInstance.current = map
      })
    })

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapInstance.current) { (mapInstance.current as any).remove(); mapInstance.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSave() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawn = drawnItems.current as any
    if (!drawn) return
    const layers = drawn.getLayers()
    if (layers.length === 0) return

    // Convert to GeoJSON FeatureCollection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L
    const geojson = drawn.toGeoJSON ? drawn.toGeoJSON() : L.featureGroup(layers).toGeoJSON()

    setStatus("saving")
    startTransition(async () => {
      await setServiceAreaPolygon(geojson)
      setStatus("saved")
      setTimeout(() => setStatus("idle"), 3000)
    })
  }

  function handleClear() {
    if (!confirm("Remove the saved service area? Customers will see no map shape.")) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawn = drawnItems.current as any
    if (drawn) drawn.clearLayers()
    setHasShape(false)
    startTransition(async () => {
      await deleteServiceAreaPolygon()
      setStatus("cleared")
      setTimeout(() => setStatus("idle"), 3000)
    })
  }

  return (
    <div className="space-y-4">

      {/* Instructions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#0D2240] flex items-center justify-center text-white text-xs font-bold">✏</span>
            <span>Click the polygon tool (left toolbar) to start drawing your service boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#0D2240] flex items-center justify-center text-white text-xs font-bold">✓</span>
            <span>Click each point of your boundary, then click the first point to close the shape</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#E8726A] flex items-center justify-center text-white text-xs font-bold">↑</span>
            <span>Hit <strong>Save Area</strong> to publish — customers see it instantly</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full rounded-2xl overflow-hidden shadow-md border border-gray-100"
        style={{ height: "560px" }}
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {status === "saved" && <span className="text-green-600 font-semibold">✓ Area saved — live on site</span>}
          {status === "cleared" && <span className="text-amber-600 font-semibold">Area removed from site</span>}
          {status === "idle" && hasShape && <span className="text-gray-400">Shape ready — save to publish</span>}
          {status === "idle" && !hasShape && <span className="text-gray-300">No service area drawn yet</span>}
        </div>
        <div className="flex gap-3">
          {hasShape && (
            <button
              onClick={handleClear}
              disabled={isPending}
              className="rounded-xl border border-red-200 text-red-400 hover:bg-red-50 font-bold text-sm px-5 py-2.5 transition-colors disabled:opacity-50"
            >
              Clear Area
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasShape || isPending || status === "saving"}
            className="rounded-xl bg-[#0D2240] hover:bg-[#1a3a5c] disabled:opacity-40 text-white font-bold text-sm px-6 py-2.5 transition-colors"
          >
            {status === "saving" ? "Saving…" : "Save Area"}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-300 text-center">
        Use the edit tool (left toolbar) to adjust points after drawing. Only one service area shape is supported at a time.
      </p>
    </div>
  )
}
