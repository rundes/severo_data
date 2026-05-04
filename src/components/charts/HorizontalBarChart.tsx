"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"

const PALETTE = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

interface Props {
  data: { name: string; value: number }[]
  color?: string
  title: string
  subtitle?: string
  badge?: string
  maxItems?: number
}

export default function HorizontalBarChart({ data, color, title, subtitle, badge, maxItems = 15 }: Props) {
  const sliced = data.slice(0, maxItems)
  const height = Math.max(200, sliced.length * 32)

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
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          layout="vertical"
          data={sliced}
          margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={22}>
            {sliced.map((_, i) => (
              <Cell key={i} fill={color ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
