"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts"

const PALETTE = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

interface Props {
  data: { name: string; value: number }[]
  color?: string
  title: string
  subtitle?: string
  badge?: string
  maxItems?: number
  total?: number
}

export default function HorizontalBarChart({ data, color, title, subtitle, badge, maxItems = 15, total }: Props) {
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
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
            badge.startsWith("★") ? "bg-red-50 text-red-600" :
            badge.startsWith("●") ? "bg-sky-50 text-sky-600" :
            "bg-purple-50 text-purple-600"
          }`}>{badge}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          layout="vertical"
          data={sliced}
          margin={{ top: 4, right: total ? 56 : 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
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
            formatter={(v) => [typeof v === "number" ? v.toLocaleString("es-AR") : v, ""]}
          />
          <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={22}>
            {sliced.map((_, i) => (
              <Cell key={i} fill={color ?? PALETTE[i % PALETTE.length]} />
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
                      fill="#94a3b8"
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
    </div>
  )
}
