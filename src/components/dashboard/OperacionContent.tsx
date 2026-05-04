"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import { findCol, valueCounts, timeSeries, COL } from "@/lib/columnMatcher"
import KPICard from "@/components/charts/KPICard"
import LineChartComponent from "@/components/charts/LineChartComponent"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]

interface Props { sheetId: string }

export default function OperacionContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ciudadanosRows, setCiudadanosRows] = useState<Row[]>([])
  const [ciudadanosHeaders, setCiudadanosHeaders] = useState<string[]>([])
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const tabs = await fetchSheetTabs(sheetId, accessToken)
      const counts: Record<string, number> = {}
      let cdHeaders: string[] = []
      let cdRows: Row[] = []

      await Promise.all(tabs.map(async (tab) => {
        const d = await fetchSheetData(sheetId, `${tab.title}!A:Z`, accessToken)
        counts[tab.title] = d.rows.length
        if (/ciudadano/i.test(tab.title)) {
          cdHeaders = d.headers
          cdRows = d.rows
        }
      }))

      setTabCounts(counts)
      setCiudadanosHeaders(cdHeaders)
      setCiudadanosRows(cdRows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner label="Cargando datos operativos..." />
  if (error) return <ErrorState message={error} />

  const totalRelevamientos = Object.values(tabCounts).reduce((a, b) => a + b, 0)
  const iFecha    = findCol(ciudadanosHeaders, COL.fecha)
  const iRelev    = findCol(ciudadanosHeaders, COL.relevador)
  const iBarrio   = findCol(ciudadanosHeaders, COL.barrio)

  const cargasDia  = iFecha >= 0 ? timeSeries(ciudadanosRows, iFecha) : []
  const relevRank  = iRelev >= 0 ? valueCounts(ciudadanosRows, iRelev, 20) : []
  const barrioData = iBarrio >= 0 ? valueCounts(ciudadanosRows, iBarrio, 20) : []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Operación</h1>
          <p className="text-gray-400 text-sm mt-0.5">KPIs de productividad del relevamiento territorial</p>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Actualizado {lastUpdated.toLocaleTimeString("es-AR")}</p>}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-50 border border-sky-200 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* ★ KPIs globales */}
      <section>
        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Progreso global</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="Total relevamientos" value={totalRelevamientos} color="#1e3a5f" />
          {Object.entries(tabCounts).map(([tab, count], i) => (
            <KPICard key={tab} title={tab} value={count} color={["#0ea5e9", "#10b981", "#f59e0b"][i % 3]} />
          ))}
        </div>
      </section>

      {/* ★ Cargas por día */}
      {cargasDia.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Ritmo de carga</p>
          <LineChartComponent
            data={cargasDia}
            dataKey="value"
            nameKey="name"
            color="#0ea5e9"
            title="Cargas por día — Ciudadanos"
          />
        </section>
      )}

      {/* ★ Ranking relevadores */}
      {relevRank.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Productividad individual</p>
          <HorizontalBarChart
            data={relevRank}
            color="#1e3a5f"
            title="Cargas por relevador"
            subtitle="Quién tiene más registros asignados"
            badge="★ CORE"
          />
        </section>
      )}

      {/* ● Cobertura por barrio */}
      {barrioData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Quick Win — Cobertura por barrio</p>
          <HorizontalBarChart
            data={barrioData}
            color="#0ea5e9"
            title="Relevamientos por barrio"
            subtitle="Barrios subrepresentados = prioridad"
            badge="● QUICK WIN"
          />
        </section>
      )}

      {/* Tabla relevadores */}
      {ciudadanosHeaders.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Detalle — Hoja Ciudadanos</h2>
          <DataTable headers={ciudadanosHeaders} rows={ciudadanosRows} />
        </section>
      )}
    </div>
  )
}
