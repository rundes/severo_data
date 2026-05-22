"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import {
  findCol, valueCounts, timeSeries, detectImageCols, extractImageUrls, COL,
} from "@/lib/columnMatcher"
import { filterByBarrio } from "@/lib/barriosGeo"
import KPICard from "@/components/charts/KPICard"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import PieChartComponent from "@/components/charts/PieChartComponent"
import BarChartComponent from "@/components/charts/BarChartComponent"
import LineChartComponent from "@/components/charts/LineChartComponent"
import LeafletMap from "@/components/charts/LeafletMapWrapper"
import DataTable from "@/components/dashboard/DataTable"
import ImageGallery from "@/components/dashboard/ImageGallery"
import BarrioFilter from "@/components/ui/BarrioFilter"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]
type TabId = "resumen" | "tipos" | "gravedad" | "territorio" | "datos"
type MapMode = "scatter" | "heat"

interface Props { sheetId: string }

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen",    label: "Resumen"    },
  { id: "tipos",      label: "Tipos"      },
  { id: "gravedad",   label: "Gravedad"   },
  { id: "territorio", label: "Territorio" },
  { id: "datos",      label: "Datos"      },
]

export default function ProblematicasContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [headers, setHeaders]       = useState<string[]>([])
  const [rows, setRows]             = useState<Row[]>([])
  const [tabName, setTabName]       = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedBarrio, setSelectedBarrio] = useState("")
  const [activeTab, setActiveTab]   = useState<TabId>("resumen")
  const [mapMode, setMapMode]       = useState<MapMode>("scatter")

  const filteredRows = useMemo(() => {
    if (!selectedBarrio) return rows
    const iL  = findCol(headers, COL.lat)
    const iLo = findCol(headers, COL.lon)
    const iB  = findCol(headers, COL.barrio)
    return filterByBarrio(rows, selectedBarrio, iL, iLo, iB)
  }, [rows, headers, selectedBarrio])

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const tabs = await fetchSheetTabs(sheetId, accessToken)
      const tab = tabs.find(t => /problem/i.test(t.title)) ?? tabs[2] ?? tabs[tabs.length - 1]
      if (!tab) throw new Error("No se encontró la hoja de Problemáticas")
      setTabName(tab.title)
      const d = await fetchSheetData(sheetId, `'${tab.title}'!A:ZZ`, accessToken)
      setHeaders(d.headers); setRows(d.rows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  const analytics = useMemo(() => {
    const iTipo    = findCol(headers, COL.tipoProblema)
    const iGravedad = findCol(headers, COL.gravedad)
    const iBarrio  = findCol(headers, COL.barrio)
    const iLat     = findCol(headers, COL.lat)
    const iLon     = findCol(headers, COL.lon)
    const iFecha   = findCol(headers, COL.fecha)

    const imgCols    = detectImageCols(headers, filteredRows)
    const imgNamed   = findCol(headers, COL.foto)
    const allImgCols = [...new Set([...(imgNamed >= 0 ? [imgNamed] : []), ...imgCols])]
    const allImageUrls = allImgCols.flatMap(ci => extractImageUrls(filteredRows, ci))

    const tipoData    = iTipo    >= 0 ? valueCounts(filteredRows, iTipo,    20) : []
    const barrioData  = iBarrio  >= 0 ? valueCounts(filteredRows, iBarrio,  15) : []
    const gravedadData = iGravedad >= 0 ? valueCounts(filteredRows, iGravedad, 10) : []
    const cadencia    = iFecha   >= 0 ? timeSeries(filteredRows, iFecha)        : []

    // Determine if gravity is numeric
    let isNumGrav = false
    if (iGravedad >= 0) {
      const sample = filteredRows.slice(0, 20).map(r => r[iGravedad])
      isNumGrav = sample.filter(v => v !== null && v !== "").some(v => !isNaN(Number(v)))
    }

    // Average gravity per barrio (numeric only)
    const gravByBarrio: { name: string; value: number }[] = []
    if (iBarrio >= 0 && iGravedad >= 0 && isNumGrav) {
      const groups: Record<string, number[]> = {}
      filteredRows.forEach(r => {
        const b = String(r[iBarrio] ?? "Sin dato").trim()
        const g = Number(r[iGravedad])
        if (!isNaN(g) && g > 0) { groups[b] ??= []; groups[b].push(g) }
      })
      Object.entries(groups).forEach(([name, vals]) => {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        gravByBarrio.push({ name, value: Math.round(avg * 10) / 10 })
      })
      gravByBarrio.sort((a, b) => b.value - a.value)
    }

    // Priority matrix: score = 50% freq + 50% avg gravity (when numeric)
    const priorityMatrix: { tipo: string; count: number; avgGrav: number | null; score: number }[] = []
    if (iTipo >= 0) {
      const maxCount = tipoData[0] ? (tipoData[0].value as number) : 1
      const gravMap: Record<string, number[]> = {}
      if (iGravedad >= 0 && isNumGrav) {
        filteredRows.forEach(r => {
          const t = String(r[iTipo] ?? "").trim()
          const g = Number(r[iGravedad])
          if (t && !isNaN(g) && g > 0) { gravMap[t] ??= []; gravMap[t].push(g) }
        })
      }
      const maxGrav = Object.values(gravMap).length > 0
        ? Math.max(...Object.values(gravMap).map(v => v.reduce((a, b) => a + b, 0) / v.length))
        : 1
      tipoData.slice(0, 15).forEach(({ name, value }) => {
        const count = value as number
        const gVals = gravMap[String(name)]
        const avgGrav = gVals ? gVals.reduce((a, b) => a + b, 0) / gVals.length : null
        const freqScore = (count / maxCount) * 50
        const gravScore = avgGrav !== null ? (avgGrav / maxGrav) * 50 : 25
        priorityMatrix.push({ tipo: String(name), count, avgGrav: avgGrav ? Math.round(avgGrav * 10) / 10 : null, score: Math.round(freqScore + gravScore) })
      })
      priorityMatrix.sort((a, b) => b.score - a.score)
    }

    const scatterData = (iLat >= 0 && iLon >= 0)
      ? filteredRows
          .filter(r => r[iLat] && r[iLon])
          .slice(0, 2000)
          .map(r => ({
            x: Number(r[iLon]),
            y: Number(r[iLat]),
            label: iTipo >= 0 ? String(r[iTipo] ?? "") : "",
            colorKey: iTipo >= 0 ? String(r[iTipo] ?? "Otro") : undefined,
          }))
      : []

    const topTipo   = tipoData[0]?.name ?? null
    const topBarrio = barrioData[0]?.name ?? null
    const avgGravNum = (() => {
      if (iGravedad < 0 || !isNumGrav) return null
      const nums = filteredRows.map(r => Number(r[iGravedad])).filter(n => !isNaN(n) && n > 0)
      if (!nums.length) return null
      return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
    })()

    return {
      tipoData, barrioData, gravedadData, cadencia, gravByBarrio, isNumGrav,
      priorityMatrix, scatterData, allImageUrls, topTipo, topBarrio, avgGravNum,
    }
  }, [headers, filteredRows])

  if (loading) return <LoadingSpinner label="Cargando problemáticas urbanas..." />
  if (error)   return <ErrorState message={error} />

  const total = filteredRows.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Problemáticas Urbanas</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Hoja: <span className="font-medium">{tabName}</span> · {total.toLocaleString("es-AR")} registros
            {selectedBarrio && <span className="text-sky-600"> · {rows.length.toLocaleString("es-AR")} totales</span>}
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
        <BarrioFilter value={selectedBarrio} onChange={setSelectedBarrio} />
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

      {/* Tab: Resumen */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <KPICard title="Total problemáticas" value={total} color="#ef4444" />
            {analytics.topTipo && <KPICard title="Problema más frecuente" value={String(analytics.topTipo)} color="#f59e0b" />}
            {analytics.topBarrio && <KPICard title="Barrio más afectado" value={String(analytics.topBarrio)} color="#8b5cf6" />}
            {analytics.avgGravNum !== null && <KPICard title="Gravedad promedio" value={analytics.avgGravNum} color="#ef4444" />}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analytics.tipoData.length > 0 && (
              <PieChartComponent
                data={analytics.tipoData.slice(0, 8)}
                dataKey="value"
                nameKey="name"
                title="Distribución por tipo de problema"
                caption={`El tipo más frecuente es "${analytics.tipoData[0]?.name}" con ${(analytics.tipoData[0]?.value as number)?.toLocaleString("es-AR")} casos.`}
              />
            )}
            {analytics.barrioData.length > 0 && (
              <HorizontalBarChart
                data={analytics.barrioData}
                color="#f59e0b"
                title="Problemáticas por barrio"
                total={total}
                caption={`"${analytics.barrioData[0]?.name}" concentra el mayor número de problemáticas registradas.`}
              />
            )}
          </div>
        </div>
      )}

      {/* Tab: Tipos */}
      {activeTab === "tipos" && (
        <div className="space-y-6">
          {analytics.tipoData.length > 0 ? (
            <HorizontalBarChart
              data={analytics.tipoData}
              color="#ef4444"
              title="Todos los tipos de problema"
              badge="★ CORE"
              total={total}
              caption={`${analytics.tipoData.length} tipos distintos. El más frecuente: "${analytics.tipoData[0]?.name}" (${(analytics.tipoData[0]?.value as number)?.toLocaleString("es-AR")} casos, ${(((analytics.tipoData[0]?.value as number) / total) * 100).toFixed(1)}%).`}
            />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              No se encontró columna de tipo de problema.
            </div>
          )}

          {analytics.cadencia.length > 0 && (
            <LineChartComponent
              data={analytics.cadencia}
              dataKey="value"
              nameKey="name"
              color="#ef4444"
              title="Evolución temporal de problemáticas"
              caption={`Pico: ${analytics.cadencia.reduce((p, c) => c.value > p.value ? c : p, analytics.cadencia[0])?.name ?? "—"} con ${analytics.cadencia.reduce((p, c) => c.value > p.value ? c : p, analytics.cadencia[0])?.value ?? 0} registros.`}
            />
          )}
        </div>
      )}

      {/* Tab: Gravedad */}
      {activeTab === "gravedad" && (
        <div className="space-y-6">
          {analytics.gravByBarrio.length > 0 ? (
            <HorizontalBarChart
              data={analytics.gravByBarrio}
              color="#ef4444"
              title="Gravedad promedio por barrio"
              badge="★ CORE"
              caption={`"${analytics.gravByBarrio[0]?.name}" tiene la mayor gravedad promedio (${analytics.gravByBarrio[0]?.value}).`}
            />
          ) : analytics.gravedadData.length > 0 ? (
            <BarChartComponent
              data={analytics.gravedadData}
              dataKey="value"
              nameKey="name"
              color="#ef4444"
              title="Distribución de gravedad"
              total={total}
              caption={`Categoría de gravedad más frecuente: "${analytics.gravedadData[0]?.name}".`}
            />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              No se encontró columna de gravedad.
            </div>
          )}

          {analytics.priorityMatrix.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Matriz de prioridad</h3>
              <p className="text-xs text-gray-400 mb-4">Score = 50% frecuencia + 50% gravedad promedio. Rojo ≥ 70, Amarillo ≥ 40, Verde &lt; 40.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Tipo</th>
                    <th className="text-right py-2 pr-4 text-gray-500 font-medium">Casos</th>
                    {analytics.isNumGrav && <th className="text-right py-2 pr-4 text-gray-500 font-medium">Grav. prom.</th>}
                    <th className="text-right py-2 text-gray-500 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.priorityMatrix.map(row => (
                    <tr key={row.tipo} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-700">{row.tipo}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{row.count.toLocaleString("es-AR")}</td>
                      {analytics.isNumGrav && (
                        <td className="py-2 pr-4 text-right text-gray-600">{row.avgGrav ?? "—"}</td>
                      )}
                      <td className="py-2 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                          row.score >= 70 ? "bg-red-100 text-red-700" :
                          row.score >= 40 ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        }`}>{row.score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Territorio */}
      {activeTab === "territorio" && (
        <div className="space-y-6">
          {analytics.scatterData.length > 0 ? (
            <>
              <div className="flex gap-2">
                {(["scatter", "heat"] as MapMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMapMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      mapMode === m ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {m === "scatter" ? "Puntos" : "Calor"}
                  </button>
                ))}
              </div>
              <LeafletMap
                data={analytics.scatterData}
                title="Mapa de problemáticas"
                subtitle="Coloreado por tipo de problema"
                badge="★ CORE"
                mode={mapMode}
              />
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              <p className="font-medium mb-1">Mapa no disponible</p>
              <p className="text-xs">No se encontraron columnas de coordenadas (lat/lon).</p>
            </div>
          )}

          {analytics.barrioData.length > 0 && (
            <HorizontalBarChart
              data={analytics.barrioData}
              color="#f59e0b"
              title="Distribución territorial por barrio"
              total={total}
            />
          )}
        </div>
      )}

      {/* Tab: Datos */}
      {activeTab === "datos" && (
        <div className="space-y-6">
          {analytics.allImageUrls.length > 0 && (
            <ImageGallery
              urls={analytics.allImageUrls}
              title="Fotos del relevamiento"
              badge="★ CORE"
            />
          )}
          <DataTable headers={headers} rows={filteredRows} />
        </div>
      )}
    </div>
  )
}
