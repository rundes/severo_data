"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts"

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
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-5 gap-3">
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
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 48 }}
          barCategoryGap="20%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
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
            tickFormatter={v => `${v}${yUnit}`}
          />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }}
            formatter={(v, name) => [`${v}${yUnit}`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
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
