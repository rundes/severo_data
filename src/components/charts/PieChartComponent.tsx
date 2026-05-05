"use client"

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]

interface Props {
  data: Record<string, unknown>[]
  dataKey: string
  nameKey: string
  title: string
  showPercent?: boolean
}

type LabelProps = {
  cx: number; cy: number; midAngle: number
  innerRadius: number; outerRadius: number
  percent: number; name: string; value: number
}

function PctLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: LabelProps) {
  if (percent < 0.04) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.6
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight="700">
      {(percent * 100).toFixed(1)}%
    </text>
  )
}

export default function PieChartComponent({ data, dataKey, nameKey, title, showPercent = true }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-5">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="45%"
            outerRadius={90}
            innerRadius={40}
            paddingAngle={2}
            labelLine={false}
            label={showPercent ? PctLabel : undefined}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }}
            formatter={(v, name) => [
              typeof v === "number" ? v.toLocaleString("es-AR") : v,
              name,
            ]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 11, color: "#64748b" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
