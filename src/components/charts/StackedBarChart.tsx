"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { CHART_COLORS, chartColor, axisTick, gridStroke, tooltipStyle, tooltipLabelStyle, INK_3 } from "@/lib/chartTheme"

// Vote intention keeps a fixed, colorblind-distinct mapping (hue + lightness vary).
const VOTE_COLORS: Record<string, string> = {
  SI: CHART_COLORS[2],     // teal
  NO: CHART_COLORS[3],     // rose
  DUDOSO: CHART_COLORS[1], // amber
  OTRO: CHART_COLORS[7],   // slate
}

interface Props {
  data: Record<string, unknown>[]
  keys: string[]
  title: string
  subtitle?: string
  badge?: string
  percentage?: boolean
}

export default function StackedBarChart({ data, keys, title, subtitle, badge, percentage }: Props) {
  if (!data.length || !keys.length) return null

  const colors = keys.map((k, i) => VOTE_COLORS[k.toUpperCase()] ?? chartColor(i))

  return (
    <div className="bg-surface rounded-md p-5 border border-hairline">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-[0.6875rem] font-medium px-2 py-0.5 rounded border border-hairline bg-panel text-ink-2 tracking-wide flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="name"
            tick={axisTick}
            angle={-35}
            textAnchor="end"
            interval={0}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={percentage ? (v) => `${v}%` : undefined}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            cursor={{ fill: "var(--accent-tint)" }}
          />
          <Legend
            formatter={(v) => <span style={{ fontSize: 11, color: INK_3 }}>{v}</span>}
          />
          {keys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId="a" fill={colors[i]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
