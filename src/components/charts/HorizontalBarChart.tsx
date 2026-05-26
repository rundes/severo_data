"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { chartColor, axisTick, gridStroke, tooltipStyle, tooltipLabelStyle, fmtNumber, INK_3 } from "@/lib/chartTheme"

interface Props {
  data: { name: string; value: number }[]
  color?: string
  title: string
  subtitle?: string
  badge?: string
  maxItems?: number
  total?: number
  caption?: string
}

export default function HorizontalBarChart({ data, color, title, subtitle, badge, maxItems = 15, total, caption }: Props) {
  const sliced = data.slice(0, maxItems)
  const height = Math.max(200, sliced.length * 32)

  return (
    <div className="bg-surface rounded-md p-5 border border-hairline">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-[0.6875rem] font-medium px-2 py-0.5 rounded border border-hairline bg-panel text-ink-2 tracking-wide whitespace-nowrap flex-shrink-0">{badge}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          layout="vertical"
          data={sliced}
          margin={{ top: 4, right: total ? 56 : 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
          <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            cursor={{ fill: "var(--accent-tint)" }}
            formatter={(v) => [fmtNumber(v), ""]}
          />
          <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={22}>
            {sliced.map((_, i) => (
              <Cell key={i} fill={color ?? chartColor(i)} />
            ))}
            {total && (
              <LabelList
                dataKey="value"
                position="right"
                content={(props) => {
                  const { x, y, width, height: h, value } = props as {
                    x: number; y: number; width: number; height: number; value: number
                  }
                  if (!value) return null
                  const pct = ((value / total) * 100).toFixed(1)
                  return (
                    <text
                      x={x + width + 5}
                      y={y + (h ?? 22) / 2}
                      dominantBaseline="middle"
                      fontSize={9}
                      fill={INK_3}
                    >
                      {pct}%
                    </text>
                  )
                }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {caption && (
        <p className="mt-3 text-xs text-ink-3 border-t border-hairline pt-2">{caption}</p>
      )}
    </div>
  )
}
