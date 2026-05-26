"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts"
import { ACCENT, axisTick, gridStroke, tooltipStyle, tooltipLabelStyle, fmtNumber, INK_3 } from "@/lib/chartTheme"

interface Props {
  data: Record<string, unknown>[]
  dataKey: string
  nameKey: string
  color?: string
  title: string
  total?: number
  caption?: string
}

export default function BarChartComponent({ data, dataKey, nameKey, color = ACCENT, title, total, caption }: Props) {
  return (
    <div className="bg-surface rounded-md p-5 border border-hairline">
      <h3 className="text-sm font-semibold text-ink mb-5">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: total ? 20 : 4, right: 16, left: 0, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey={nameKey}
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
            tickFormatter={fmtNumber}
          />
          <Tooltip
            cursor={{ fill: "var(--accent-tint)" }}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(v) => [fmtNumber(v), ""]}
          />
          <Bar dataKey={dataKey} fill={color} radius={[5, 5, 0, 0]} maxBarSize={48}>
            {total && (
              <LabelList
                dataKey={dataKey}
                position="top"
                content={(props) => {
                  const { x, y, width, value } = props as { x: number; y: number; width: number; value: number }
                  if (!value) return null
                  const pct = ((value / total) * 100).toFixed(1)
                  return (
                    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill={INK_3}>
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
