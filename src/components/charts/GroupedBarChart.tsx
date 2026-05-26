"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts"
import { axisTick, gridStroke, tooltipStyle, tooltipLabelStyle, INK_3 } from "@/lib/chartTheme"

interface DataItem {
  name: string
  [key: string]: string | number
}

interface Series {
  key: string
  label: string
  color: string
}

interface Props {
  data: DataItem[]
  series: Series[]
  title: string
  subtitle?: string
  badge?: string
  yUnit?: string
  layout?: "vertical" | "horizontal"
}

export default function GroupedBarChart({ data, series, title, subtitle, badge, yUnit = "" }: Props) {
  return (
    <div className="bg-surface rounded-md p-5 border border-hairline">
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-[0.6875rem] font-medium px-2 py-0.5 rounded border border-hairline bg-panel text-ink-2 tracking-wide whitespace-nowrap flex-shrink-0">{badge}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 48 }}
          barCategoryGap="20%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ ...axisTick, fontSize: 10 }}
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
            tickFormatter={v => `${v}${yUnit}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            cursor={{ fill: "var(--accent-tint)" }}
            formatter={(v, name) => [`${v}${yUnit}`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8, color: INK_3 }}
            iconType="circle"
            iconSize={8}
          />
          {series.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
