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
  showBarrios?: boolean
}

const DEFAULT_COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6",
]

// Resolve the GeoJSON path accounting for the GitHub Pages basePath
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const BARRIOS_GEOJSON = `${BASE}/barrios-maipu.geojson`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addBarriosLayer(L: any, map: any): Promise<void> {
  try {
    const res = await fetch(BARRIOS_GEOJSON)
    if (!res.ok) return
    const geojson = await res.json()

    L.geoJSON(geojson, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter: (feature: any) => feature.geometry?.type === "Polygon",
      style: {
        color: "#1e3a5f",
        weight: 2,
        opacity: 0.8,
        fillColor: "#0ea5e9",
        fillOpacity: 0.08,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onEachFeature: (feature: any, layer: any) => {
        const name = feature.properties?.name ?? ""
        if (name) {
          layer.bindTooltip(name, {
            permanent: false,
            direction: "center",
            className: "barrio-label",
          })
          layer.bindPopup(`<strong>${name}</strong>`)
        }
      },
    }).addTo(map)
  } catch {
    // silently skip if file not found (e.g., dev without basePath)
  }
}

export default function LeafletMap({
  data,
  title,
  subtitle,
  badge,
  colorMap,
  mode = "scatter",
  height = 420,
  showBarrios = true,
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

      // preferCanvas: true — one <canvas> for all path layers instead of
      // one SVG node per marker; handles 10 000+ points without freezing.
      const map = L.map(mapRef.current!, { zoomControl: true, preferCanvas: true })
      mapInstanceRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
        maxZoom: 18,
      }).addTo(map)

      // Barrio boundary layer (loaded from static GeoJSON)
      if (showBarrios) {
        await addBarriosLayer(L, map)
        if (cancelled) return
      }

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

        // Shared popup reused across all markers (avoids binding 8 000 popups)
        const popup = L.popup({ closeButton: false, className: "leaflet-map-popup" })

        const subset = points.length > 8000 ? points.slice(0, 8000) : points
        subset.forEach((p) => {
          const color = autoColorMap[p.colorKey ?? "default"] ?? "#0ea5e9"
          const marker = L.circleMarker([p.y, p.x], {
            radius: 4,
            fillColor: color,
            color: color,
            weight: 0,
            fillOpacity: 0.75,
          })
          if (p.label) {
            marker.on("click", (e: unknown) => {
              popup.setLatLng((e as { latlng: unknown }).latlng)
                   .setContent(String(p.label))
                   .openOn(map)
            })
          }
          marker.addTo(map)
        })

        // Inline legend for color keys
        if (colorKeys.length > 1) {
          const legendItems = colorKeys
            .map(k => `<div style="display:flex;align-items:center;gap:5px;margin:2px 0">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${autoColorMap[k]};flex-shrink:0"></span>
              <span>${k}</span></div>`)
            .join("")
          const LegendControl = L.Control.extend({
            onAdd: () => {
              const div = L.DomUtil.create("div")
              div.innerHTML = `<div style="background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:8px;font-size:11px;line-height:1.4;box-shadow:0 1px 5px rgba(0,0,0,.2);max-width:180px">${legendItems}</div>`
              return div
            },
          })
          new LegendControl({ position: "bottomright" }).addTo(map)
        }
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
  }, [data, mode, colorMap, showBarrios])

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
