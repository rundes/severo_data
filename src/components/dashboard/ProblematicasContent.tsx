"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import { findCol, valueCounts, detectImageCols, extractImageUrls, COL } from "@/lib/columnMatcher"
import { filterByBarrio } from "@/lib/barriosGeo"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import PieChartComponent from "@/components/charts/PieChartComponent"
import BarChartComponent from "@/components/charts/BarChartComponent"
import LeafletMap from "@/components/charts/LeafletMapWrapper"
import DataTable from "@/components/dashboard/DataTable"
import ImageGallery from "@/components/dashboard/ImageGallery"
import BarrioFilter from "@/components/ui/BarrioFilter"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]

interface Props { sheetId: string }

export default function ProblematicasContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [tabName, setTabName] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedBarrio, setSelectedBarrio] = useState("")

  const filteredRows = useMemo(() => {
    if (!selectedBarrio) return rows
    const iL = findCol(headers, COL.lat)
    const iLo = findCol(headers, COL.lon)
    const iB = findCol(headers, COL.barrio)
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
      const d = await fetchSheetData(sheetId, `${tab.title}!A:Z`, accessToken)
      setHeaders(d.headers); setRows(d.rows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner label="Cargando problemáticas urbanas..." />
  if (error) return <ErrorState message={error} />

  const iTipo    = findCol(headers, COL.tipoProblema)
  const iGravedad= findCol(headers, COL.gravedad)
  const iBarrio  = findCol(headers, COL.barrio)
  const iLat     = findCol(headers, COL.lat)
  const iLon     = findCol(headers, COL.lon)

  // Image columns detection
  const imgCols = detectImageCols(headers, filteredRows)
  const imgNamedCol = findCol(headers, COL.foto)
  const allImgCols = [...new Set([...(imgNamedCol >= 0 ? [imgNamedCol] : []), ...imgCols])]
  const allImageUrls = allImgCols.flatMap(ci => extractImageUrls(filteredRows, ci))

  const total = filteredRows.length

  const tipoData    = iTipo >= 0 ? valueCounts(filteredRows, iTipo, 15) : []
  const gravedadData= iGravedad >= 0 ? valueCounts(filteredRows, iGravedad, 10) : []
  const barrioData  = iBarrio >= 0 ? valueCounts(filteredRows, iBarrio, 15) : []

  // Gravedad promedio por barrio (si gravedad es numérica)
  const gravByBarrio: { name: string; value: number }[] = []
  if (iBarrio >= 0 && iGravedad >= 0) {
    const groups: Record<string, number[]> = {}
    filteredRows.forEach(r => {
      const b = String(r[iBarrio] ?? "Sin dato").trim()
      const g = Number(r[iGravedad])
      if (!isNaN(g)) {
        groups[b] ??= []
        groups[b].push(g)
      }
    })
    Object.entries(groups).forEach(([name, vals]) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      gravByBarrio.push({ name, value: Math.round(avg * 10) / 10 })
    })
    gravByBarrio.sort((a, b) => b.value - a.value)
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

  return (
    <div className="space-y-8">
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

      {/* Barrio filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
        <BarrioFilter value={selectedBarrio} onChange={setSelectedBarrio} />
      </div>

      {/* ★ Mapa + Top 10 */}
      <section>
        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Distribución de problemas</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {scatterData.length > 0 ? (
            <LeafletMap
              data={scatterData}
              title="★ Mapa de problemáticas"
              subtitle="Coloreado por tipo de problema"
              badge="★ CORE"
            />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              <p className="font-medium mb-1">Mapa no disponible</p>
              <p className="text-xs">No se encontraron columnas de coordenadas (lat/lon) en esta hoja.</p>
            </div>
          )}
          {tipoData.length > 0 && (
            <PieChartComponent
              data={tipoData.slice(0, 8)}
              dataKey="value"
              nameKey="name"
              title="★ Tipos de problema más frecuentes"
            />
          )}
        </div>
      </section>

      {/* ● Top 10 */}
      {tipoData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Quick Win — Top 10 problemas</p>
          <HorizontalBarChart
            data={tipoData}
            color="#ef4444"
            title="● Top 10 tipos de problema"
            badge="● QUICK WIN"
            maxItems={10}
          />
        </section>
      )}

      {/* ● Barrio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {barrioData.length > 0 && (
          <HorizontalBarChart
            data={barrioData}
            color="#f59e0b"
            title="● Problemas por barrio"
            badge="● QUICK WIN"
          />
        )}
        {gravByBarrio.length > 0 ? (
          <HorizontalBarChart
            data={gravByBarrio}
            color="#ef4444"
            title="● Gravedad promedio por barrio"
            badge="● QUICK WIN"
          />
        ) : gravedadData.length > 0 && (
          <BarChartComponent
            data={gravedadData}
            dataKey="value"
            nameKey="name"
            color="#ef4444"
            title="● Distribución de gravedad"
          />
        )}
      </div>

      {/* Galería de fotos */}
      {allImageUrls.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Registro fotográfico</p>
          <ImageGallery
            urls={allImageUrls}
            title="Fotos del relevamiento"
            badge="★ CORE"
          />
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Datos completos</h2>
        <DataTable headers={headers} rows={filteredRows} />
      </section>
    </div>
  )
}
