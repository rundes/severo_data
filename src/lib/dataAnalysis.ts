import type { ColumnInfo, ColumnType, ChartConfig } from "@/types"

const CHART_COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
]

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,
  /^\d{2}\/\d{2}\/\d{4}/,
  /^\d{2}-\d{2}-\d{4}/,
  /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i,
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /^\d{4}$/,
  /^Q[1-4]\s?\d{4}/i,
]

function detectType(values: (string | number | null)[]): ColumnType {
  const nonNull = values.filter((v) => v !== null)
  if (nonNull.length === 0) return "text"

  const numeric = nonNull.filter((v) => typeof v === "number")
  if (numeric.length > nonNull.length * 0.7) return "number"

  const strings = nonNull.map(String)
  const dateCount = strings
    .slice(0, 15)
    .filter((v) => DATE_PATTERNS.some((p) => p.test(v))).length
  if (dateCount > Math.min(strings.length, 15) * 0.6) return "date"

  const unique = new Set(strings)
  if (unique.size <= 30 && unique.size < nonNull.length * 0.6) return "category"

  return "text"
}

export function analyzeColumns(
  headers: string[],
  rows: (string | number | null)[][]
): ColumnInfo[] {
  return headers.map((name, index) => {
    const values = rows.map((r) => r[index])
    const type = detectType(values)
    const info: ColumnInfo = { name, index, type }

    if (type === "number") {
      const nums = values.filter((v): v is number => typeof v === "number")
      if (nums.length > 0) {
        info.sum = nums.reduce((a, b) => a + b, 0)
        info.avg = info.sum / nums.length
        info.min = Math.min(...nums)
        info.max = Math.max(...nums)
        info.count = nums.length
      }
    }

    if (type === "category") {
      info.uniqueValues = [...new Set(values.filter((v) => v !== null).map(String))]
    }

    return info
  })
}

function aggregateBy(
  rows: (string | number | null)[][],
  groupIdx: number,
  valueIdx: number
): Record<string, unknown>[] {
  const groups: Record<string, number[]> = {}

  for (const row of rows) {
    const key = String(row[groupIdx] ?? "Sin dato")
    const val = row[valueIdx]
    if (!groups[key]) groups[key] = []
    groups[key].push(typeof val === "number" ? val : 0)
  }

  return Object.entries(groups)
    .map(([name, vals]) => ({
      name,
      value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
      total: vals.reduce((a, b) => a + b, 0),
      count: vals.length,
    }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 20)
}

function countBy(
  rows: (string | number | null)[][],
  groupIdx: number
): Record<string, unknown>[] {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const key = String(row[groupIdx] ?? "Sin dato")
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 20)
}

export function proposeCharts(
  headers: string[],
  rows: (string | number | null)[][],
  columns: ColumnInfo[]
): ChartConfig[] {
  if (rows.length === 0) return []

  const charts: ChartConfig[] = []
  const numeric = columns.filter((c) => c.type === "number")
  const category = columns.filter((c) => c.type === "category")
  const dates = columns.filter((c) => c.type === "date")

  // KPI cards — up to 4 numeric columns
  numeric.slice(0, 4).forEach((col, i) => {
    const val = col.sum !== undefined && col.sum > 0 ? col.sum : col.avg
    charts.push({
      type: "kpi",
      title: col.name,
      dataKey: col.name,
      color: CHART_COLORS[i % CHART_COLORS.length],
      value: val !== undefined ? Math.round(val * 100) / 100 : col.count ?? 0,
      subtitle: col.sum !== undefined ? `Promedio: ${Math.round((col.avg ?? 0) * 100) / 100}` : undefined,
    })
  })

  // Category columns without numeric partner → count distribution
  if (category.length > 0 && numeric.length === 0) {
    category.slice(0, 2).forEach((cat, i) => {
      const data = countBy(rows, cat.index)
      charts.push({
        type: "bar",
        title: `Distribución de ${cat.name}`,
        dataKey: "value",
        nameKey: "name",
        color: CHART_COLORS[i % CHART_COLORS.length],
        data,
      })
      if ((cat.uniqueValues?.length ?? 0) <= 8) {
        charts.push({
          type: "pie",
          title: `Proporción de ${cat.name}`,
          dataKey: "value",
          nameKey: "name",
          color: CHART_COLORS[(i + 2) % CHART_COLORS.length],
          data,
        })
      }
    })
  }

  // Category + numeric combos
  if (category.length > 0 && numeric.length > 0) {
    category.slice(0, 3).forEach((cat, ci) => {
      numeric.slice(0, 2).forEach((num, ni) => {
        const data = aggregateBy(rows, cat.index, num.index)
        const colorIdx = (ci * 2 + ni) % CHART_COLORS.length
        charts.push({
          type: "bar",
          title: `${num.name} por ${cat.name}`,
          dataKey: "value",
          nameKey: "name",
          color: CHART_COLORS[colorIdx],
          data,
        })
        if ((cat.uniqueValues?.length ?? 0) <= 8 && ni === 0) {
          charts.push({
            type: "pie",
            title: `Distribución: ${num.name} por ${cat.name}`,
            dataKey: "value",
            nameKey: "name",
            color: CHART_COLORS[(colorIdx + 1) % CHART_COLORS.length],
            data,
          })
        }
      })
    })
  }

  // Date + numeric → line chart
  if (dates.length > 0 && numeric.length > 0) {
    const dateCol = dates[0]
    numeric.slice(0, 2).forEach((num, i) => {
      const data = aggregateBy(rows, dateCol.index, num.index)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      charts.push({
        type: "line",
        title: `${num.name} en el tiempo`,
        dataKey: "value",
        nameKey: "name",
        color: CHART_COLORS[(i + 4) % CHART_COLORS.length],
        data,
      })
    })
  }

  return charts
}
