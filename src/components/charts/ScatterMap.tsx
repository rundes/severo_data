"use client"

import {
  ScatterChart, Scatter, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"

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
}

const DEFAULT_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

const VOTE_COLOR: Record<string, string> = {
  SI: "#10b981",
  NO: "#ef4444",
  DUDOSO: "#f59e0b",
  OTRO: "#94a3b8",
}

export default function ScatterMap({ data, title, subtitle, badge, colorMap }: Props) {
  if (!data.length) return null

  const keys = [...new Set(data.map((d) => d.colorKey ?? "").filter(Boolean))]
  const getColor = (key?: string) => {
    if (!key) return "#0ea5e9"
    if (colorMap?.[key]) return colorMap[key]
    if (VOTE_COLOR[key.toUpperCase()]) return VOTE_COLOR[key.toUpperCase()]
    return DEFAULT_COLORS[keys.indexOf(key) % DEFAULT_COLORS.length]
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-300 mb-3">Visualización de coordenadas lat/lon — norte arriba</p>

      {keys.length > 1 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(k) }} />
              <span className="text-xs text-gray-500">{k}</span>
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <XAxis
            dataKey="x"
            type="number"
            name="Longitud"
            domain={["auto", "auto"]}
            tick={{ fontSize: 9, fill: "#cbd5e1" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="Latitud"
            domain={["auto", "auto"]}
            tick={{ fontSize: 9, fill: "#cbd5e1" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 11 }}
            formatter={(_, name, props) => [props.payload.label ?? "", name]}
          />
          <Scatter data={data} opacity={0.6}>
            {data.map((pt, i) => (
              <Cell key={i} fill={getColor(pt.colorKey)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
