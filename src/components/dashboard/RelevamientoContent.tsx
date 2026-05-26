"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import { analyzeColumns, proposeCharts } from "@/lib/dataAnalysis"
import type { ChartConfig, SheetTab } from "@/types"
import ChartGrid from "@/components/charts/ChartGrid"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

interface Props {
  sheetId: string
}

interface TabState {
  headers: string[]
  rows: (string | number | null)[][]
  charts: ChartConfig[]
}

export default function RelevamientoContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [metaLoading, setMetaLoading] = useState(true)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [tabs, setTabs] = useState<SheetTab[]>([])
  const [activeTab, setActiveTab] = useState("")
  const [tabState, setTabState] = useState<TabState | null>(null)
  const [tabLoading, setTabLoading] = useState(false)
  const [tabError, setTabError] = useState<string | null>(null)

  // Load sheet tabs metadata
  useEffect(() => {
    if (!accessToken) return
    async function loadMeta() {
      try {
        const sheets = await fetchSheetTabs(sheetId, accessToken!)
        setTabs(sheets)
        if (sheets.length > 0) setActiveTab(sheets[0].title)
      } catch (err) {
        setMetaError(err instanceof Error ? err.message : "Error al cargar pestañas")
      } finally {
        setMetaLoading(false)
      }
    }
    loadMeta()
  }, [sheetId, accessToken])

  // Load active tab data
  useEffect(() => {
    if (!activeTab || !accessToken) return
    async function loadTab() {
      try {
        setTabLoading(true)
        setTabError(null)
        const data = await fetchSheetData(sheetId, `'${activeTab}'!A:ZZ`, accessToken!)
        const cols = analyzeColumns(data.headers, data.rows)
        const charts = proposeCharts(data.headers, data.rows, cols)
        setTabState({ headers: data.headers, rows: data.rows, charts })
      } catch (err) {
        setTabError(err instanceof Error ? err.message : "Error al cargar datos")
      } finally {
        setTabLoading(false)
      }
    }
    loadTab()
  }, [activeTab, sheetId, accessToken])

  if (metaLoading) return <LoadingSpinner label="Cargando pestañas..." />
  if (metaError) return <ErrorState message={metaError} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Relevamiento</h1>
        <p className="text-ink-3 text-sm mt-0.5">
          {tabs.length} pestañas disponibles
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto pb-px">
        <div className="flex gap-1 border-b border-hairline min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.title)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-all whitespace-nowrap ${
                activeTab === tab.title
                  ? "border-hairline text-accent bg-accent-tint"
                  : "border-transparent text-ink-2 hover:text-ink hover:bg-panel"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tabLoading ? (
        <LoadingSpinner label={`Cargando "${activeTab}"...`} />
      ) : tabError ? (
        <ErrorState message={tabError} />
      ) : tabState ? (
        <TabContent state={tabState} tabName={activeTab} />
      ) : null}
    </div>
  )
}

function TabContent({ state, tabName }: { state: TabState; tabName: string }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-3">
        {state.rows.length.toLocaleString("es-AR")} registros en &ldquo;{tabName}&rdquo;
      </p>

      {state.charts.length === 0 ? (
        <div className="bg-surface rounded-md p-8 border border-hairline text-center text-ink-3 text-sm">
          No se encontraron columnas numéricas o categóricas para graficar en esta pestaña.
        </div>
      ) : (
        <ChartGrid charts={state.charts} />
      )}

      <div>
        <h2 className="text-base font-semibold text-ink mb-3">Datos completos</h2>
        <DataTable headers={state.headers} rows={state.rows} />
      </div>
    </div>
  )
}
