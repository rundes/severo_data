"use client"

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { chartColor, tooltipStyle, tooltipLabelStyle, fmtNumber, INK_3, SURFACE } from "@/lib/chartTheme"

interface Props {
  data: Record<string, unknown>[]
  dataKey: string
  nameKey: string
  title: string
  showPercent?: boolean
  caption?: string
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
    <text x={x} y={y} fill={SURFACE} textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight="700">
      {(percent * 100).toFixed(1)}%
    </text>
  )
}

export default function PieChartComponent({ data, dataKey, nameKey, title, showPercent = true, caption }: Props) {
  return (
    <div className="bg-surface rounded-md p-5 border border-hairline">
      <h3 className="text-sm font-semibold text-ink mb-5">{title}</h3>
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
              <Cell key={i} fill={chartColor(i)} stroke={SURFACE} strokeWidth={1.5} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(v, name) => [fmtNumber(v), name]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 11, color: INK_3 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {caption && (
        <p className="mt-3 text-xs text-ink-3 border-t border-hairline pt-2">{caption}</p>
      )}
    </div>
  )
}
