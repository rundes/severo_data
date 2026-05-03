import type { ChartConfig } from "@/types"
import KPICard from "./KPICard"
import BarChartComponent from "./BarChartComponent"
import LineChartComponent from "./LineChartComponent"
import PieChartComponent from "./PieChartComponent"

interface Props {
  charts: ChartConfig[]
}

export default function ChartGrid({ charts }: Props) {
  const kpis = charts.filter((c) => c.type === "kpi")
  const visuals = charts.filter((c) => c.type !== "kpi")

  return (
    <div className="space-y-6">
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((c, i) => (
            <KPICard
              key={i}
              title={c.title}
              value={c.value ?? 0}
              color={c.color}
              subtitle={c.subtitle}
            />
          ))}
        </div>
      )}

      {visuals.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {visuals.map((c, i) => {
            if (c.type === "bar")
              return (
                <BarChartComponent
                  key={i}
                  data={c.data ?? []}
                  dataKey={c.dataKey}
                  nameKey={c.nameKey ?? "name"}
                  color={c.color}
                  title={c.title}
                />
              )
            if (c.type === "line")
              return (
                <LineChartComponent
                  key={i}
                  data={c.data ?? []}
                  dataKey={c.dataKey}
                  nameKey={c.nameKey ?? "name"}
                  color={c.color}
                  title={c.title}
                />
              )
            if (c.type === "pie")
              return (
                <PieChartComponent
                  key={i}
                  data={c.data ?? []}
                  dataKey={c.dataKey}
                  nameKey={c.nameKey ?? "name"}
                  title={c.title}
                />
              )
            return null
          })}
        </div>
      )}
    </div>
  )
}
