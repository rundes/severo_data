"use client"
// This file is loaded dynamically (ssr: false) from LeafletMapWrapper
import { useEffect, useRef } from "react"

interface Point {
  x: number
  y: number
  label?: string
  colorKey?: string
  size?: number  // bubble mode: scales circle radius
}

interface Props {
  data: Point[]
  title: string
  subtitle?: string
  badge?: string
  colorMap?: Record<string, string>
  mode?: "scatter" | "heat" | "bubble"
  height?: number
  showBarrios?: boolean
}

const DEFAULT_COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6",
]

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ""
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
          layer.bindTooltip(name, { permanent: false, direction: "center", className: "barrio-label" })
          layer.bindPopup(`<strong>${name}</strong>`)
        }
      },
    }).addTo(map)
  } catch {
    // silently skip if file not found
  }
}

function injectCSS(id: string, href: string) {
  if (typeof document !== "undefined" && !document.getElementById(id)) {
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = href
    document.head.appendChild(link)
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

      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const points = data.filter(
        (p) => p.x !== 0 && p.y !== 0 && !isNaN(p.x) && !isNaN(p.y)
      )
      if (!points.length) return

      const map = L.map(mapRef.current!, { zoomControl: true, preferCanvas: true })
      mapInstanceRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
        maxZoom: 18,
      }).addTo(map)

      if (showBarrios) {
        await addBarriosLayer(L, map)
        if (cancelled) return
      }

      if (mode === "heat") {
        await import("leaflet.heat")
        const heatPoints = points.map((p) => [p.y, p.x, 1.0])
        L.heatLayer(heatPoints, {
          radius: 20,
          blur: 15,
          maxZoom: 17,
          gradient: { 0.2: "#3b82f6", 0.4: "#10b981", 0.6: "#f59e0b", 0.8: "#ef4444", 1.0: "#7c2d12" },
        }).addTo(map)

      } else if (mode === "bubble") {
        // Bubble map: each point as a scaled circle, no clustering
        const colorKeys = [...new Set(points.map((p) => p.colorKey ?? "default"))]
        const autoColorMap: Record<string, string> = {}
        colorKeys.forEach((k, i) => {
          autoColorMap[k] = colorMap?.[k] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
        })

        const maxSize = Math.max(...points.map(p => p.size ?? 1), 1)

        points.forEach((p) => {
          const color = autoColorMap[p.colorKey ?? "default"] ?? "#ef4444"
          const raw = p.size ?? 1
          const radius = 8 + Math.round((raw / maxSize) * 32)
          const circle = L.circleMarker([p.y, p.x], {
            radius,
            fillColor: color,
            color: "#fff",
            weight: 2,
            fillOpacity: 0.78,
          })
          if (p.label) {
            circle.bindPopup(p.label, { closeButton: false, className: "leaflet-map-popup" })
          }
          circle.addTo(map)
        })

        if (colorKeys.length > 1) {
          const legendItems = colorKeys
            .map(k => `<div style="display:flex;align-items:center;gap:5px;margin:2px 0">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${autoColorMap[k]};flex-shrink:0"></span>
              <span>${k}</span></div>`)
            .join("")
          const LegendControl = L.Control.extend({
            onAdd: () => {
              const div = L.DomUtil.create("div")
              div.innerHTML = `<div style="background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:8px;font-size:11px;line-height:1.4;box-shadow:0 1px 5px rgba(0,0,0,.2);max-width:200px">${legendItems}</div>`
              return div
            },
          })
          new LegendControl({ position: "bottomright" }).addTo(map)
        }

      } else {
        // Clustered scatter — groups nearby points into colour-coded circles,
        // expanding into individual markers as the user zooms in.
        await import("leaflet.markercluster")
        injectCSS("mc-css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css")
        injectCSS("mc-def-css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css")

        const colorKeys = [...new Set(points.map((p) => p.colorKey ?? "default"))]
        const autoColorMap: Record<string, string> = {}
        colorKeys.forEach((k, i) => {
          autoColorMap[k] = colorMap?.[k] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
        })

        // One MarkerClusterGroup per colorKey so each colour stays separate
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groups: Record<string, any> = {}
        colorKeys.forEach((k) => {
          const color = autoColorMap[k]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          groups[k] = (L as any).markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            spiderfyOnMaxZoom: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            iconCreateFunction: (cluster: any) => {
              const count = cluster.getChildCount()
              const size = count < 10 ? 28 : count < 100 ? 36 : 44
              return L.divIcon({
                html: `<div style="
                  width:${size}px;height:${size}px;border-radius:50%;
                  background:${color};opacity:0.85;
                  display:flex;align-items:center;justify-content:center;
                  color:#fff;font-size:11px;font-weight:700;
                  box-shadow:0 1px 5px rgba(0,0,0,.35);">${count}</div>`,
                className: "",
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
              })
            },
          })
        })

        points.forEach((p) => {
          const key = p.colorKey ?? "default"
          const color = autoColorMap[key] ?? "#0ea5e9"
          const marker = L.circleMarker([p.y, p.x], {
            radius: 5,
            fillColor: color,
            color: "#fff",
            weight: 1,
            fillOpacity: 0.85,
          })
          if (p.label) {
            marker.bindPopup(String(p.label), { closeButton: false, className: "leaflet-map-popup" })
          }
          groups[key].addLayer(marker)
        })

        colorKeys.forEach((k) => map.addLayer(groups[k]))

        // Legend
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

      const bounds = L.latLngBounds(points.map((p: Point) => [p.y, p.x]))
      map.fitBounds(bounds, { padding: [30, 30] })
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
      <div ref={mapRef} style={{ height }} className="w-full" />
    </div>
  )
}
