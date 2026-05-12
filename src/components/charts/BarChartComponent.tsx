"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts"

interface Props {
  data: Record<string, unknown>[]
  dataKey: string
  nameKey: string
  color: string
  title: string
  total?: number
  caption?: string
}

export default function BarChartComponent({ data, dataKey, nameKey, color, title, total, caption }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-5">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: total ? 20 : 4, right: 16, left: 0, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey={nameKey}
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
            tickFormatter={(v) => typeof v === "number" ? v.toLocaleString("es-AR") : v}
          />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }}
            formatter={(v) => [typeof v === "number" ? v.toLocaleString("es-AR") : v, ""]}
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
                    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">
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
        <p className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2">{caption}</p>
      )}
    </div>
  )
}
