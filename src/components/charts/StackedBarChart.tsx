"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"

const PALETTE = ["#10b981", "#ef4444", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]

const VOTE_COLORS: Record<string, string> = {
  SI: "#10b981",
  NO: "#ef4444",
  DUDOSO: "#f59e0b",
  OTRO: "#94a3b8",
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

  const colors = keys.map((k) => VOTE_COLORS[k.toUpperCase()] ?? PALETTE[keys.indexOf(k) % PALETTE.length])

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-5">
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
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            angle={-35}
            textAnchor="end"
            interval={0}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={percentage ? (v) => `${v}%` : undefined}
          />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Legend
            formatter={(v) => <span style={{ fontSize: 11, color: "#64748b" }}>{v}</span>}
          />
          {keys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId="a" fill={colors[i]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
