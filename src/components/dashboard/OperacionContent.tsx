"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import { findCol, valueCounts, timeSeries, COL } from "@/lib/columnMatcher"
import KPICard from "@/components/charts/KPICard"
import LineChartComponent from "@/components/charts/LineChartComponent"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import BarChartComponent from "@/components/charts/BarChartComponent"
import PieChartComponent from "@/components/charts/PieChartComponent"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]
type TabId = "produccion" | "relevadores" | "cobertura" | "datos"

interface Props { sheetId: string }

const TABS: { id: TabId; label: string }[] = [
  { id: "produccion", label: "Producción" },
  { id: "relevadores", label: "Relevadores" },
  { id: "cobertura", label: "Cobertura" },
  { id: "datos", label: "Datos" },
]

export default function OperacionContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("produccion")
  const [mainTabName, setMainTabName] = useState("")

  const [padronTotal, setPadronTotal] = useState<number | null>(null)
  const [padronLoading, setPadronLoading] = useState(false)
  const padronSheetId = process.env.NEXT_PUBLIC_SHEET_PADRON_ID ?? ""

  const setMainTab = useCallback((allData: { title: string; headers: string[]; rows: Row[] }[]) => {
    const MAIN_RE = /ciudadano|identificac|encuesta|formulario|respuesta|datos?\b/i
    const main = allData.find(t => MAIN_RE.test(t.title))
      ?? allData.reduce((a, b) => b.rows.length > a.rows.length ? b : a, allData[0])
    setMainTabName(main.title)
    setHeaders(main.headers)
    setRows(main.rows)
  }, [])

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const tabs = await fetchSheetTabs(sheetId, accessToken)

      // Collect all tab data deterministically (no race condition)
      const allData = await Promise.all(
        tabs.map(async tab => {
          const d = await fetchSheetData(sheetId, `'${tab.title}'!A:ZZ`, accessToken)
          return { title: tab.title, headers: d.headers, rows: d.rows }
        })
      )

      const counts: Record<string, number> = {}
      allData.forEach(t => { counts[t.title] = t.rows.length })
      setTabCounts(counts)
      setMainTab(allData)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken, setMainTab])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (activeTab !== "cobertura" || padronTotal !== null || !accessToken || !padronSheetId) return
    setPadronLoading(true)
    fetchSheetData(padronSheetId, "A:A", accessToken)
      .then(d => setPadronTotal(d.rows.length))
      .catch(() => setPadronTotal(0))
      .finally(() => setPadronLoading(false))
  }, [activeTab, padronTotal, accessToken, padronSheetId])

  const analytics = useMemo(() => {
    const iFecha  = findCol(headers, COL.fecha)
    const iBarrio = findCol(headers, COL.barrio)
    const iVoto   = findCol(headers, COL.voto)
    const iDni    = findCol(headers, COL.documento)

    // Prefer "nombre y apellido" column over email/relevador for display
    const iNombreRelev = findCol(headers, COL.nombreRelevador)
    const iRelevBase   = findCol(headers, COL.relevador)
    const iRelev = iNombreRelev >= 0 ? iNombreRelev : iRelevBase

    const cargasDia  = iFecha  >= 0 ? timeSeries(rows, iFecha)        : []
    const relevRank  = iRelev  >= 0 ? valueCounts(rows, iRelev,  30)  : []
    const barrioData = iBarrio >= 0 ? valueCounts(rows, iBarrio, 20)  : []
    const votoData   = iVoto   >= 0 ? valueCounts(rows, iVoto,   10)  : []

    const last7      = cargasDia.slice(-7)
    const totalLast7 = last7.reduce((s, d) => s + d.value, 0)
    const hoy        = cargasDia.at(-1)?.value ?? 0
    const uniqueDnis = iDni >= 0 ? new Set(rows.map(r => String(r[iDni] ?? "").trim()).filter(Boolean)).size : null

    const tabPie = Object.entries(tabCounts).map(([name, value]) => ({ name, value }))

    const topDay = cargasDia.length > 0
      ? cargasDia.reduce((p, c) => c.value > p.value ? c : p, cargasDia[0])
      : null
    const avgDay = cargasDia.length > 0
      ? Math.round(cargasDia.reduce((s, d) => s + d.value, 0) / cargasDia.length)
      : 0

    return { cargasDia, relevRank, barrioData, votoData, totalLast7, hoy, uniqueDnis, tabPie, topDay, avgDay }
  }, [headers, rows, tabCounts])

  if (loading) return <LoadingSpinner label="Cargando datos operativos..." />
  if (error) return <ErrorState message={error} />

  const totalRelevamientos = Object.values(tabCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Operación</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            KPIs de productividad · {totalRelevamientos.toLocaleString("es-AR")} registros totales
          </p>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Actualizado {lastUpdated.toLocaleTimeString("es-AR")}</p>}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-50 border border-sky-200 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {Object.keys(tabCounts).length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="font-medium">Analizando pestaña:</span>
          {Object.entries(tabCounts).map(([title, count]) => (
            <button key={title}
              onClick={async () => {
                if (!accessToken) return
                setLoading(true)
                try {
                  const d = await fetchSheetData(sheetId, `'${title}'!A:ZZ`, accessToken)
                  setMainTabName(title); setHeaders(d.headers); setRows(d.rows)
                } finally { setLoading(false) }
              }}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                title === mainTabName
                  ? "bg-sky-600 text-white border-sky-600 font-semibold"
                  : "border-gray-200 hover:border-sky-300 hover:text-sky-700"
              }`}>
              {title} <span className="opacity-70">({(count as number).toLocaleString("es-AR")})</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard title="Total registros" value={totalRelevamientos} color="#1e3a5f" />
        <KPICard title="Hoy" value={analytics.hoy} color="#10b981" />
        <KPICard title="Últimos 7 días" value={analytics.totalLast7} color="#0ea5e9" />
        {analytics.uniqueDnis !== null
          ? <KPICard title="DNIs únicos" value={analytics.uniqueDnis} color="#8b5cf6" />
          : <KPICard title="Hojas" value={Object.keys(tabCounts).length} color="#f59e0b" />
        }
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "produccion" && (
        <div className="space-y-6">
          {analytics.cargasDia.length > 0 ? (
            <LineChartComponent
              data={analytics.cargasDia}
              dataKey="value"
              nameKey="name"
              color="#0ea5e9"
              title="Cargas por día"
              caption={analytics.topDay
                ? `Pico: ${analytics.topDay.name} con ${analytics.topDay.value} registros. Promedio diario: ${analytics.avgDay}.`
                : undefined}
            />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              No se encontró columna de fecha para generar la serie temporal.
            </div>
          )}

          {analytics.tabPie.length > 1 && (
            <PieChartComponent
              data={analytics.tabPie}
              dataKey="value"
              nameKey="name"
              title="Distribución de registros por hoja"
              caption={(() => {
                const sorted = [...analytics.tabPie].sort((a, b) => (b.value as number) - (a.value as number))
                return `La hoja con más registros es "${sorted[0]?.name}" con ${(sorted[0]?.value as number)?.toLocaleString("es-AR")} entradas.`
              })()}
            />
          )}

          {analytics.votoData.length > 0 && (
            <BarChartComponent
              data={analytics.votoData}
              dataKey="value"
              nameKey="name"
              color="#10b981"
              title="Distribución por voto declarado"
              total={rows.length}
              caption={`Respuesta más frecuente: "${analytics.votoData[0]?.name}" con ${(analytics.votoData[0]?.value as number)?.toLocaleString("es-AR")} casos.`}
            />
          )}
        </div>
      )}

      {activeTab === "relevadores" && (
        <div className="space-y-6">
          {analytics.relevRank.length > 0 ? (
            <>
              <HorizontalBarChart
                data={analytics.relevRank}
                color="#1e3a5f"
                title="Cargas por relevador"
                subtitle="Volumen total de registros por operador"
                badge="★ CORE"
                total={totalRelevamientos}
                caption={`${analytics.relevRank[0]?.name} lidera con ${(analytics.relevRank[0]?.value as number)?.toLocaleString("es-AR")} registros (${(((analytics.relevRank[0]?.value as number) / totalRelevamientos) * 100).toFixed(1)}% del total).`}
              />
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Tabla de relevadores</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-gray-500 font-medium">#</th>
                      <th className="text-left py-2 pr-4 text-gray-500 font-medium">Relevador</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Registros</th>
                      <th className="text-right py-2 pl-4 text-gray-500 font-medium">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.relevRank.map((r, i) => (
                      <tr key={String(r.name)} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                        <td className="py-2 pr-4 text-gray-700 font-medium">{String(r.name)}</td>
                        <td className="py-2 text-right text-gray-900 font-semibold">{(r.value as number).toLocaleString("es-AR")}</td>
                        <td className="py-2 pl-4 text-right text-gray-500">{(((r.value as number) / totalRelevamientos) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              No se encontró columna de relevador en los datos.
            </div>
          )}
        </div>
      )}

      {activeTab === "cobertura" && (
        <div className="space-y-6">
          {padronLoading ? (
            <LoadingSpinner label="Cargando padrón para calcular cobertura..." />
          ) : padronTotal !== null && padronTotal > 0 ? (
            (() => {
              const pct = Math.min(100, (totalRelevamientos / padronTotal) * 100)
              return (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Cobertura vs padrón</h3>
                  <div className="flex items-end gap-4 mb-3">
                    <span className="text-4xl font-bold text-sky-600">{pct.toFixed(1)}%</span>
                    <span className="text-sm text-gray-500 mb-1">
                      {totalRelevamientos.toLocaleString("es-AR")} de {padronTotal.toLocaleString("es-AR")} en padrón
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    {pct < 30
                      ? "Cobertura baja — se recomienda intensificar el relevamiento."
                      : pct < 60
                      ? "Cobertura media — buen avance, continuar en zonas pendientes."
                      : "Cobertura alta — relevamiento extenso completado."}
                  </p>
                </div>
              )
            })()
          ) : !padronSheetId ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              Variable NEXT_PUBLIC_SHEET_PADRON_ID no configurada.
            </div>
          ) : null}

          {analytics.barrioData.length > 0 && (
            <HorizontalBarChart
              data={analytics.barrioData}
              color="#0ea5e9"
              title="Relevamientos por barrio"
              subtitle="Barrios con menos registros = prioridad de cobertura"
              badge="● QUICK WIN"
              total={totalRelevamientos}
              caption={`Barrio con mayor cobertura: "${analytics.barrioData[0]?.name}" (${(analytics.barrioData[0]?.value as number)?.toLocaleString("es-AR")} registros).`}
            />
          )}
        </div>
      )}

      {activeTab === "datos" && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Datos completos</h2>
          <DataTable headers={headers} rows={rows} />
        </section>
      )}
    </div>
  )
}
