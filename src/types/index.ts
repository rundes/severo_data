export interface SheetData {
  headers: string[]
  rows: (string | number | null)[][]
}

export interface SheetTab {
  id: number
  title: string
}

export type ColumnType = "date" | "number" | "category" | "text"

export interface ColumnInfo {
  name: string
  index: number
  type: ColumnType
  uniqueValues?: string[]
  min?: number
  max?: number
  sum?: number
  avg?: number
  count?: number
}

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "kpi"
  title: string
  dataKey: string
  nameKey?: string
  color: string
  data?: Record<string, unknown>[]
  value?: number | string
  subtitle?: string
}
