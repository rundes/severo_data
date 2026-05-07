"use client"
// This file is loaded dynamically (ssr: false) from LeafletMapWrapper
import { useEffect, useRef } from "react"

interface Point {
  x: number
  y: number
  label?: string
  colorKey?: string
}

interface Props {
  data: Point[]
  title: string
  subtitle?: string
  badge?: string
  colorMap?: Record<string, string>
  mode?: "scatter" | "heat"
  height?: number
}

const DEFAULT_COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6",
]

export default function LeafletMap({
  data,
  title,
  subtitle,
  badge,
  colorMap,
  mode = "scatter",
  height = 420,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || !data.length) return

    let cancelled = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("leaflet").then(async (Lmod: any) => {
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = Lmod.default ?? Lmod

      // Fix default icon paths broken by webpack
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      // Destroy any existing map instance on this div
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      // Filter valid coordinate points
      const points = data.filter(
        (p) => p.x !== 0 && p.y !== 0 && !isNaN(p.x) && !isNaN(p.y)
      )
      if (!points.length) return

      const map = L.map(mapRef.current!, { zoomControl: true })
      mapInstanceRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
        maxZoom: 18,
      }).addTo(map)

      if (mode === "heat") {
        // leaflet.heat adds itself to the global L object
        await import("leaflet.heat")
        const heatPoints = points.map((p) => [p.y, p.x, 1.0])
        L.heatLayer(heatPoints, {
          radius: 20,
          blur: 15,
          maxZoom: 17,
          gradient: {
            0.2: "#3b82f6",
            0.4: "#10b981",
            0.6: "#f59e0b",
            0.8: "#ef4444",
            1.0: "#7c2d12",
          },
        }).addTo(map)
      } else {
        // Build color map from unique colorKeys
        const colorKeys = [...new Set(points.map((p) => p.colorKey ?? "default"))]
        const autoColorMap: Record<string, string> = {}
        colorKeys.forEach((k, i) => {
          autoColorMap[k] = colorMap?.[k] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
        })

        // Limit to 5000 points to keep the browser responsive
        const subset = points.length > 5000 ? points.slice(0, 5000) : points
        subset.forEach((p) => {
          const color = autoColorMap[p.colorKey ?? "default"] ?? "#0ea5e9"
          L.circleMarker([p.y, p.x], {
            radius: 6,
            fillColor: color,
            color: "#fff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.75,
          })
            .bindPopup(p.label ?? "")
            .addTo(map)
        })
      }

      // Fit the map view to all visible points
      const bounds = L.latLngBounds(points.map((p: Point) => [p.y, p.x]))
      map.fitBounds(bounds, { padding: [30, 30] })
      // Ensure the container is properly sized after any layout reflow
      setTimeout(() => { if (!cancelled) map.invalidateSize() }, 200)
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, colorMap])

  if (!data.length) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
        Sin datos de coordenadas para el mapa.
      </div>
    )
  }

  const validCount = data.filter(p => p.x !== 0 && p.y !== 0 && !isNaN(p.x) && !isNaN(p.y)).length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{validCount.toLocaleString("es-AR")} puntos</p>
        </div>
        {badge && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {/* Map container — must have a fixed height for Leaflet to render */}
      <div ref={mapRef} style={{ height }} className="w-full" />
    </div>
  )
}
