"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData } from "@/lib/sheets"
import {
  findCol, valueCounts, ageGroups, median, ageFromClase,
  COL, crossTab,
} from "@/lib/columnMatcher"
import KPICard from "@/components/charts/KPICard"
import BarChartComponent from "@/components/charts/BarChartComponent"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import PieChartComponent from "@/components/charts/PieChartComponent"
import StackedBarChart from "@/components/charts/StackedBarChart"
import ScatterMap from "@/components/charts/ScatterMap"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]

interface Props { sheetId: string }

export default function PadronContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const d = await fetchSheetData(sheetId, "A:Z", accessToken)
      setHeaders(d.headers); setRows(d.rows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner label="Cargando padrón..." />
  if (error) return <ErrorState message={error} />

  // ── Column detection ──────────────────────────────────────────────────────
  const iSexo     = findCol(headers, COL.sexo)
  const iClase    = findCol(headers, COL.clase)
  const iMesa     = findCol(headers, COL.mesa)
  const iEstab    = findCol(headers, COL.establecimiento)
  const iLat      = findCol(headers, COL.lat)
  const iLon      = findCol(headers, COL.lon)
  const iProf     = findCol(headers, COL.profesion)
  const iFuerza   = findCol(headers, COL.fuerza)
  const iCirc     = findCol(headers, COL.circuito)

  // ── KPI calculations ─────────────────────────────────────────────────────
  const total = rows.length
  const extranjeros = iMesa >= 0 ? rows.filter(r => String(r[iMesa]).trim() === "9001").length : 0
  const pctExtr = total ? Math.round((extranjeros / total) * 100) : 0

  const ages = iClase >= 0
    ? rows.map(r => ageFromClase(r[iClase])).filter((a): a is number => a !== null)
    : []
  const medianAge = ages.length ? Math.round(median(ages)) : null
  const primerVoto = ages.filter(a => a >= 16 && a <= 18).length
  const adultMayores = ages.filter(a => a >= 65).length
  const sinGeo = iLat >= 0 ? rows.filter(r => !r[iLat] || !r[iLon]).length : null

  // ── Chart data ────────────────────────────────────────────────────────────
  const sexoData = iSexo >= 0 ? valueCounts(rows, iSexo) : []
  const mesaData = iMesa >= 0 ? valueCounts(rows, iMesa, 35).map(d => ({
    name: String(d.name), value: d.value
  })) : []
  const estabData = iEstab >= 0 ? valueCounts(rows, iEstab, 20) : []
  const profData  = iProf >= 0 ? valueCounts(rows, iProf, 20) : []
  const fuerzaData = iFuerza >= 0 ? valueCounts(rows, iFuerza, 20) : []
  const circData  = iCirc >= 0 ? valueCounts(rows, iCirc, 20) : []
  const ageData   = iClase >= 0 ? ageGroups(rows, iClase, iSexo) : []

  const mesaFuerzaData = (iMesa >= 0 && iFuerza >= 0)
    ? crossTab(rows, iMesa, iFuerza).slice(0, 20)
    : []
  const fuerzaKeys = iFuerza >= 0
    ? [...new Set(rows.map(r => String(r[iFuerza] ?? "")).filter(Boolean))]
    : []

  const scatterData = (iLat >= 0 && iLon >= 0)
    ? rows
        .filter(r => r[iLat] && r[iLon])
        .slice(0, 3000)
        .map(r => ({
          x: Number(r[iLon]),
          y: Number(r[iLat]),
          label: iEstab >= 0 ? String(r[iEstab] ?? "") : "",
          colorKey: iMesa >= 0 ? `Mesa ${r[iMesa]}` : undefined,
        }))
    : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Padrón Electoral</h1>
          <p className="text-gray-400 text-sm mt-0.5">Demografía y estructura del padrón de Maipú 2025</p>
          <p className="text-xs text-gray-400 mt-1">
            {total.toLocaleString("es-AR")} registros
            {lastUpdated && ` · ${lastUpdated.toLocaleTimeString("es-AR")}`}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-50 border border-sky-200 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* ★ CORE KPIs — sección 1.1 */}
      <section>
        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Demografía básica</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="Total electores" value={total} color="#1e3a5f" />
          {medianAge && <KPICard title="Mediana de edad" value={`${medianAge} años`} color="#0ea5e9" />}
          {ages.length > 0 && <KPICard title="Primer voto (16–18)" value={primerVoto} color="#10b981" subtitle={`${Math.round(primerVoto/total*100)}% del padrón`} />}
          {ages.length > 0 && <KPICard title="Adultos mayores (65+)" value={adultMayores} color="#8b5cf6" subtitle={`${Math.round(adultMayores/total*100)}% del padrón`} />}
          {iMesa >= 0 && <KPICard title="Electores extranjeros" value={extranjeros} color="#f59e0b" subtitle={`${pctExtr}% — mesa 9001`} />}
        </div>
      </section>

      {/* Sexo + Edad */}
      {(sexoData.length > 0 || ageData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sexoData.length > 0 && (
            <PieChartComponent
              data={sexoData}
              dataKey="value"
              nameKey="name"
              title="★ Distribución por sexo"
            />
          )}
          {ageData.length > 0 && (
            <BarChartComponent
              data={ageData}
              dataKey="value"
              nameKey="name"
              color="#0ea5e9"
              title="★ Pirámide etaria (cohortes)"
            />
          )}
        </div>
      )}

      {/* ★ CORE — Estructura electoral */}
      {mesaData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Estructura electoral</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {iMesa >= 0 && <KPICard title="Cantidad de mesas" value={mesaData.length} color="#0ea5e9" />}
            {mesaData.length > 0 && <KPICard title="Promedio x mesa" value={Math.round(total / mesaData.length)} color="#10b981" />}
            {mesaData.length > 0 && <KPICard title="Mesa más grande" value={mesaData[0]?.value ?? 0} color="#f59e0b" subtitle={mesaData[0]?.name} />}
          </div>
          <BarChartComponent data={mesaData} dataKey="value" nameKey="name" color="#1e3a5f" title="Electores por mesa" />
        </section>
      )}

      {estabData.length > 0 && (
        <HorizontalBarChart
          data={estabData}
          color="#0ea5e9"
          title="★ Electores por establecimiento"
          subtitle="Logística de fiscalización"
        />
      )}

      {/* Cobertura JP */}
      {fuerzaData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Cobertura padrón JP</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartComponent
              data={fuerzaData}
              dataKey="value"
              nameKey="name"
              title="★ Distribución por fuerza política (P23)"
            />
            {mesaFuerzaData.length > 0 && fuerzaKeys.length > 0 && (
              <StackedBarChart
                data={mesaFuerzaData}
                keys={fuerzaKeys}
                title="★ Cobertura JP por mesa"
                subtitle="Identificación de fuerza por mesa"
                badge="★ CORE"
              />
            )}
          </div>
        </section>
      )}

      {/* Mapa */}
      {scatterData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Geografía</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {sinGeo !== null && (
              <KPICard
                title="Sin geocodificación"
                value={sinGeo}
                color={sinGeo > 0 ? "#ef4444" : "#10b981"}
                subtitle={`${Math.round(sinGeo/total*100)}% — a limpiar`}
              />
            )}
            <KPICard title="Georreferenciados" value={scatterData.length} color="#10b981" subtitle={`de ${total} totales`} />
          </div>
          <ScatterMap
            data={scatterData}
            title="★ Mapa de electores (lat/lon)"
            subtitle="Hasta 3.000 puntos — representación espacial aproximada"
            badge="★ CORE"
          />
        </section>
      )}

      {/* Circuitos */}
      {circData.length > 0 && (
        <HorizontalBarChart
          data={circData}
          color="#8b5cf6"
          title="● Distribución por circuito"
          badge="● QUICK WIN"
        />
      )}

      {/* Profesiones */}
      {profData.length > 0 && (
        <HorizontalBarChart
          data={profData}
          title="◆ Top 20 profesiones"
          subtitle="Calidad del dato: % 'SIN INFORM'"
          badge="◆ AVANZADO"
          maxItems={20}
        />
      )}

      {/* Tabla completa */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Datos completos</h2>
        <DataTable headers={headers} rows={rows} />
      </section>
    </div>
  )
}
