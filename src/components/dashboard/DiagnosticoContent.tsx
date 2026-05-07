"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import { findCol, valueCounts, crossTab, detectImageCols, extractImageUrls, COL } from "@/lib/columnMatcher"
import KPICard from "@/components/charts/KPICard"
import PieChartComponent from "@/components/charts/PieChartComponent"
import StackedBarChart from "@/components/charts/StackedBarChart"
import DataTable from "@/components/dashboard/DataTable"
import ImageGallery from "@/components/dashboard/ImageGallery"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]

interface Props { sheetId: string }

function serviceByBarrio(
  rows: Row[],
  barrioIdx: number,
  serviceIdx: number
) {
  return crossTab(rows, barrioIdx, serviceIdx)
}

export default function DiagnosticoContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [tabName, setTabName] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const tabs = await fetchSheetTabs(sheetId, accessToken)
      const tab = tabs.find(t => /sociohabit/i.test(t.title)) ?? tabs[1] ?? tabs[0]
      if (!tab) throw new Error("No se encontró la hoja Sociohabitacional")
      setTabName(tab.title)
      const d = await fetchSheetData(sheetId, `${tab.title}!A:Z`, accessToken)
      setHeaders(d.headers); setRows(d.rows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner label="Cargando diagnóstico territorial..." />
  if (error) return <ErrorState message={error} />

  const imgCols = detectImageCols(headers, rows)
  const imgNamedCol = findCol(headers, COL.foto)
  const allImgCols = [...new Set([...(imgNamedCol >= 0 ? [imgNamedCol] : []), ...imgCols])]
  const allImageUrls = allImgCols.flatMap(ci => extractImageUrls(rows, ci))

  const iBarrio   = findCol(headers, COL.barrio)
  const iTenencia = findCol(headers, COL.tenencia)
  const iTipoViv  = findCol(headers, COL.tipoVivienda)
  const iMaterial = findCol(headers, COL.materialParedes)
  const iEscritura= findCol(headers, COL.escritura)
  const iCloaca   = findCol(headers, COL.cloaca)
  const iAgua     = findCol(headers, COL.agua)
  const iLuz      = findCol(headers, COL.luz)
  const iGas      = findCol(headers, COL.gas)
  const iDiscap   = findCol(headers, COL.discapacidad)
  const iCUD      = findCol(headers, COL.cud)
  const iTipoDisc = findCol(headers, COL.tipoDiscap)

  const total = rows.length

  // KPIs discapacidad
  const conDiscap = iDiscap >= 0
    ? rows.filter(r => /si|sí|1|yes/i.test(String(r[iDiscap] ?? ""))).length
    : null
  const conCUD = (iCUD >= 0 && conDiscap)
    ? rows.filter(r => /si|sí|1|yes/i.test(String(r[iCUD] ?? ""))).length
    : null

  // Vivienda data
  const tenenciaData  = iTenencia >= 0 ? valueCounts(rows, iTenencia) : []
  const tipoVivData   = iTipoViv >= 0 ? valueCounts(rows, iTipoViv) : []
  const materialData  = iMaterial >= 0 ? valueCounts(rows, iMaterial) : []
  const escrituraData = iEscritura >= 0 ? valueCounts(rows, iEscritura) : []
  const tipoDiscData  = iTipoDisc >= 0 ? valueCounts(rows, iTipoDisc) : []

  // Servicios por barrio
  const cloacaBarrio = (iCloaca >= 0 && iBarrio >= 0) ? serviceByBarrio(rows, iBarrio, iCloaca) : []
  const aguaBarrio   = (iAgua >= 0 && iBarrio >= 0)   ? serviceByBarrio(rows, iBarrio, iAgua)   : []
  const luzBarrio    = (iLuz >= 0 && iBarrio >= 0)     ? serviceByBarrio(rows, iBarrio, iLuz)     : []
  const gasBarrio    = (iGas >= 0 && iBarrio >= 0)     ? serviceByBarrio(rows, iBarrio, iGas)     : []

  const cloacaKeys = iCloaca >= 0 ? [...new Set(rows.map(r => String(r[iCloaca] ?? "")).filter(Boolean))] : []
  const aguaKeys   = iAgua >= 0   ? [...new Set(rows.map(r => String(r[iAgua]   ?? "")).filter(Boolean))] : []
  const luzKeys    = iLuz >= 0    ? [...new Set(rows.map(r => String(r[iLuz]    ?? "")).filter(Boolean))] : []
  const gasKeys    = iGas >= 0    ? [...new Set(rows.map(r => String(r[iGas]    ?? "")).filter(Boolean))] : []

  const hasServiceData = cloacaBarrio.length > 0 || aguaBarrio.length > 0 || luzBarrio.length > 0 || gasBarrio.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Diagnóstico Territorial</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Hoja: <span className="font-medium">{tabName}</span> · {total.toLocaleString("es-AR")} registros
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

      {/* ★ Servicios básicos por barrio — el más fuerte para campaña */}
      {hasServiceData && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Servicios básicos por barrio</p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {cloacaBarrio.length > 0 && cloacaKeys.length > 0 && (
              <StackedBarChart data={cloacaBarrio} keys={cloacaKeys}
                title="★ Desagüe / Cloaca por barrio" badge="★ CORE" />
            )}
            {aguaBarrio.length > 0 && aguaKeys.length > 0 && (
              <StackedBarChart data={aguaBarrio} keys={aguaKeys}
                title="★ Agua potable por barrio" badge="★ CORE" />
            )}
            {luzBarrio.length > 0 && luzKeys.length > 0 && (
              <StackedBarChart data={luzBarrio} keys={luzKeys}
                title="★ Servicio eléctrico por barrio" badge="★ CORE" />
            )}
            {gasBarrio.length > 0 && gasKeys.length > 0 && (
              <StackedBarChart data={gasBarrio} keys={gasKeys}
                title="★ Gas por barrio" badge="★ CORE" />
            )}
          </div>
        </section>
      )}

      {/* ★ Vivienda */}
      {(tenenciaData.length > 0 || tipoVivData.length > 0) && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Bloque 3: Vivienda</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tenenciaData.length > 0 && (
              <PieChartComponent data={tenenciaData} dataKey="value" nameKey="name"
                title="★ Tenencia de la vivienda" />
            )}
            {tipoVivData.length > 0 && (
              <PieChartComponent data={tipoVivData} dataKey="value" nameKey="name"
                title="● Tipo de vivienda" />
            )}
          </div>
          {(materialData.length > 0 || escrituraData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {materialData.length > 0 && (
                <PieChartComponent data={materialData} dataKey="value" nameKey="name"
                  title="● Material de paredes" />
              )}
              {escrituraData.length > 0 && (
                <PieChartComponent data={escrituraData} dataKey="value" nameKey="name"
                  title="● Escritura / título" />
              )}
            </div>
          )}
        </section>
      )}

      {/* ● Discapacidad */}
      {conDiscap !== null && (
        <section>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Quick Win — Bloque 5: Discapacidad</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <KPICard
              title="Hogares con discapacidad"
              value={conDiscap}
              color="#8b5cf6"
              subtitle={`${Math.round(conDiscap / total * 100)}% del relevamiento`}
            />
            {conCUD !== null && (
              <>
                <KPICard title="Con CUD" value={conCUD} color="#10b981"
                  subtitle={`${Math.round(conCUD / conDiscap * 100)}% de los que tienen discap.`} />
                <KPICard title="Sin CUD (gap)" value={conDiscap - conCUD} color="#ef4444"
                  subtitle="Oportunidad de acompañamiento" />
              </>
            )}
          </div>
          {tipoDiscData.length > 0 && (
            <PieChartComponent data={tipoDiscData} dataKey="value" nameKey="name"
              title="● Tipo de discapacidad" />
          )}
        </section>
      )}

      {allImageUrls.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Registro fotográfico</p>
          <ImageGallery urls={allImageUrls} title="Fotos del relevamiento" badge="★ CORE" />
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Datos completos</h2>
        <DataTable headers={headers} rows={rows} />
      </section>
    </div>
  )
}
