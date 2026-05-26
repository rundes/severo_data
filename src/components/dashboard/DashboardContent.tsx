"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData } from "@/lib/sheets"
import { analyzeColumns, proposeCharts } from "@/lib/dataAnalysis"
import type { ChartConfig } from "@/types"
import ChartGrid from "@/components/charts/ChartGrid"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

interface Props {
  sheetId: string
  title: string
  description?: string
}

export default function DashboardContent({ sheetId, title, description }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [charts, setCharts] = useState<ChartConfig[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<(string | number | null)[][]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      setError(null)
      const data = await fetchSheetData(sheetId, "A:Z", accessToken)
      const cols = analyzeColumns(data.headers, data.rows)
      const proposed = proposeCharts(data.headers, data.rows, cols)
      setHeaders(data.headers)
      setRows(data.rows)
      setCharts(proposed)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {description && <p className="text-ink-3 text-sm mt-0.5">{description}</p>}
          <p className="text-xs text-ink-3 mt-1">
            {rows.length.toLocaleString("es-AR")} registros
            {lastUpdated && ` · Actualizado ${lastUpdated.toLocaleTimeString("es-AR")}`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent px-3 py-2 rounded-lg hover:bg-accent-tint transition-colors border border-hairline"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      {charts.length === 0 ? (
        <div className="bg-surface rounded-md p-8 border border-hairline text-center text-ink-3 text-sm">
          No se pudieron proponer gráficos para esta hoja. Los datos se muestran en la tabla.
        </div>
      ) : (
        <ChartGrid charts={charts} />
      )}

      <div>
        <h2 className="text-base font-semibold text-ink mb-3">Datos completos</h2>
        <DataTable headers={headers} rows={rows} />
      </div>
    </div>
  )
}
