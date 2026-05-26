"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts"
import { ACCENT, axisTick, gridStroke, tooltipStyle, tooltipLabelStyle, fmtNumber, SURFACE } from "@/lib/chartTheme"

interface Props {
  data: Record<string, unknown>[]
  dataKey: string
  nameKey: string
  color?: string
  title: string
  caption?: string
}

export default function LineChartComponent({ data, dataKey, nameKey, color = ACCENT, title, caption }: Props) {
  return (
    <div className="bg-surface rounded-md p-5 border border-hairline">
      <h3 className="text-sm font-semibold text-ink mb-5">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 56 }}>
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
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(v) => [fmtNumber(v), ""]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            dot={<Dot r={4} fill={color} stroke={SURFACE} strokeWidth={2} />}
            activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {caption && (
        <p className="mt-3 text-xs text-ink-3 border-t border-hairline pt-2">{caption}</p>
      )}
    </div>
  )
}
