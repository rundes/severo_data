"use client"

import {
  ScatterChart, Scatter, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { CHART_COLORS, chartColor, tooltipStyle, tooltipLabelStyle, ACCENT, INK_3 } from "@/lib/chartTheme"

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
}

const VOTE_COLOR: Record<string, string> = {
  SI: CHART_COLORS[2],     // teal
  NO: CHART_COLORS[3],     // rose
  DUDOSO: CHART_COLORS[1], // amber
  OTRO: CHART_COLORS[7],   // slate
}

// Bin points into a grid and return density per cell (0–1 normalized)
function buildDensityGrid(points: Point[], cols = 60, rows = 60) {
  if (!points.length) return { grid: [], minX: 0, maxX: 1, minY: 0, maxY: 1, cols, rows }
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const dx = (maxX - minX) || 1
  const dy = (maxY - minY) || 1
  const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (const p of points) {
    const c = Math.min(cols - 1, Math.floor(((p.x - minX) / dx) * cols))
    const r = Math.min(rows - 1, Math.floor(((p.y - minY) / dy) * rows))
    grid[r][c]++
  }
  const maxVal = Math.max(...grid.flat()) || 1
  const normalized = grid.map(row => row.map(v => v / maxVal))
  return { grid: normalized, minX, maxX, minY, maxY, cols, rows }
}

function heatColor(t: number): string {
  // blue → cyan → green → yellow → red
  if (t < 0.25) {
    const s = t / 0.25
    return `rgba(14,165,233,${0.15 + s * 0.5})`
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25
    return `rgba(16,185,129,${0.5 + s * 0.2})`
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25
    return `rgba(245,158,11,${0.65 + s * 0.2})`
  }
  const s = (t - 0.75) / 0.25
  return `rgba(239,68,68,${0.8 + s * 0.2})`
}

function HeatMapCanvas({ data, width, height }: { data: Point[]; width: number; height: number }) {
  const COLS = 50; const ROWS = 50
  const { grid, minX, maxX, minY, maxY } = buildDensityGrid(data, COLS, ROWS)
  const dx = (maxX - minX) || 1
  const dy = (maxY - minY) || 1
  const cellW = width / COLS
  const cellH = height / ROWS

  return (
    <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {grid.map((row, ri) =>
        row.map((val, ci) => {
          if (val < 0.01) return null
          // map grid coords back to svg coords
          const svgX = ((ci / COLS) * dx + minX - minX) / dx * width
          const svgY = height - ((ri / ROWS) * dy + minY - minY) / dy * height - cellH
          return (
            <rect
              key={`${ri}-${ci}`}
              x={svgX}
              y={svgY}
              width={cellW + 1}
              height={cellH + 1}
              fill={heatColor(val)}
              rx={1}
            />
          )
        })
      )}
    </svg>
  )
}

export default function ScatterMap({ data, title, subtitle, badge, colorMap, mode = "scatter" }: Props) {
  if (!data.length) return null

  const keys = [...new Set(data.map((d) => d.colorKey ?? "").filter(Boolean))]
  const getColor = (key?: string) => {
    if (!key) return ACCENT
    if (colorMap?.[key]) return colorMap[key]
    if (VOTE_COLOR[key.toUpperCase()]) return VOTE_COLOR[key.toUpperCase()]
    return chartColor(keys.indexOf(key))
  }

  return (
    <div className="bg-surface rounded-md p-5 border border-hairline">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-[0.6875rem] font-medium px-2 py-0.5 rounded border border-hairline bg-panel text-ink-2 tracking-wide whitespace-nowrap flex-shrink-0">{badge}</span>
        )}
      </div>
      <p className="text-xs text-ink-4 mb-3">
        {mode === "heat"
          ? "Mapa de calor — densidad de electores georreferenciados"
          : "Visualización de coordenadas lat/lon — norte arriba"}
      </p>

      {mode === "heat" && (
        <div className="flex items-center gap-1 mb-3">
          <span className="text-[10px] text-ink-3 mr-1">Densidad:</span>
          {["Baja", "Media", "Alta", "Máx."].map((l, i) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-4 h-3 rounded-sm" style={{
                background: heatColor([0.1, 0.35, 0.65, 0.9][i])
              }} />
              <span className="text-[10px] text-ink-3">{l}</span>
            </div>
          ))}
        </div>
      )}

      {mode === "scatter" && keys.length > 1 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(k) }} />
              <span className="text-xs text-ink-2">{k}</span>
            </div>
          ))}
        </div>
      )}

      {mode === "heat" ? (
        <div style={{ position: "relative", height: 320 }}>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <XAxis dataKey="x" type="number" domain={["auto", "auto"]}
                tick={{ fontSize: 9, fill: INK_3 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="y" type="number" domain={["auto", "auto"]}
                tick={{ fontSize: 9, fill: INK_3 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(_, name, props) => [props.payload.label ?? "", name]}
              />
              {/* Invisible scatter just to set axis domain */}
              <Scatter data={data} opacity={0}>
                {data.map((_, i) => <Cell key={i} fill="transparent" />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={320} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
            <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <XAxis dataKey="x" type="number" domain={["auto", "auto"]} hide />
              <YAxis dataKey="y" type="number" domain={["auto", "auto"]} hide />
              <Scatter
                data={data}
                shape={(props: { cx?: number; cy?: number }) => {
                  const { cx = 0, cy = 0 } = props
                  return <circle cx={cx} cy={cy} r={5} fill={ACCENT} opacity={0.12} />
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <XAxis dataKey="x" type="number" name="Longitud" domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: INK_3 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="y" type="number" name="Latitud" domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: INK_3 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
              formatter={(_, name, props) => [props.payload.label ?? "", name]}
            />
            <Scatter data={data} opacity={0.6}>
              {data.map((pt, i) => (
                <Cell key={i} fill={getColor(pt.colorKey)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
