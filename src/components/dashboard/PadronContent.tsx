"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData } from "@/lib/sheets"
import {
  findCol, valueCounts, ageGroups, ageFromClase,
  COL, crossTab,
} from "@/lib/columnMatcher"
import { filterByBarrio } from "@/lib/barriosGeo"
import KPICard from "@/components/charts/KPICard"
import BarChartComponent from "@/components/charts/BarChartComponent"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import PieChartComponent from "@/components/charts/PieChartComponent"
import StackedBarChart from "@/components/charts/StackedBarChart"
import LeafletMap from "@/components/charts/LeafletMapWrapper"
import DataTable from "@/components/dashboard/DataTable"
import BarrioFilter from "@/components/ui/BarrioFilter"
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
  const [selectedBarrio, setSelectedBarrio] = useState("")

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

  // ── Column detection ─────────────────────────────────────────────────────
  const iSexo   = findCol(headers, COL.sexo)
  const iClase  = findCol(headers, COL.clase)
  const iMesa   = findCol(headers, COL.mesa)
  const iEstab  = findCol(headers, COL.establecimiento)
  const iLat    = findCol(headers, COL.lat)
  const iLon    = findCol(headers, COL.lon)
  const iProf   = findCol(headers, COL.profesion)
  const iFuerza = findCol(headers, COL.fuerza)
  const iCirc   = findCol(headers, COL.circuito)

  // ── KPI calculations ─────────────────────────────────────────────────────
  const total       = filteredRows.length
  const extranjeros = iMesa >= 0 ? filteredRows.filter(r => String(r[iMesa]).trim() === "9001").length : 0
  const nativos     = total - extranjeros
  const pctExtr     = total ? Math.round((extranjeros / total) * 100) : 0
  const pctNat      = total ? 100 - pctExtr : 0

  const ages      = iClase >= 0
    ? filteredRows.map(r => ageFromClase(r[iClase])).filter((a): a is number => a !== null)
    : []
  const avgAge    = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null
  const primerVoto    = ages.filter(a => a >= 16 && a <= 18).length
  const adultMayores  = ages.filter(a => a >= 65).length
  const sinGeo    = iLat >= 0 ? filteredRows.filter(r => !r[iLat] || !r[iLon]).length : null

  // ── Chart data ────────────────────────────────────────────────────────────
  const sexoData    = iSexo   >= 0 ? valueCounts(filteredRows, iSexo) : []
  const mesaData    = iMesa   >= 0 ? valueCounts(filteredRows, iMesa, 35).map(d => ({ name: String(d.name), value: d.value })) : []
  const estabData   = iEstab  >= 0 ? valueCounts(filteredRows, iEstab, 20) : []
  const profData    = iProf   >= 0 ? valueCounts(filteredRows, iProf, 20) : []
  const fuerzaData  = iFuerza >= 0 ? valueCounts(filteredRows, iFuerza, 20) : []
  const circData    = iCirc   >= 0 ? valueCounts(filteredRows, iCirc, 20) : []
  const ageData     = iClase  >= 0 ? ageGroups(filteredRows, iClase, iSexo) : []

  // Nativos vs extranjeros pie
  const origenData = extranjeros > 0
    ? [
        { name: "Nativos (argentinos)", value: nativos },
        { name: "Extranjeros (mesa 9001)", value: extranjeros },
      ]
    : []

  // Extranjeros breakdown by sex
  const extranjerosRows = iMesa >= 0 ? filteredRows.filter(r => String(r[iMesa]).trim() === "9001") : []
  const extSexoData = (iSexo >= 0 && extranjerosRows.length > 0)
    ? valueCounts(extranjerosRows, iSexo)
    : []

  // Nativos breakdown by sex
  const nativosRows = iMesa >= 0 ? filteredRows.filter(r => String(r[iMesa]).trim() !== "9001") : filteredRows
  const natSexoData = (iSexo >= 0 && nativosRows.length > 0)
    ? valueCounts(nativosRows, iSexo)
    : []

  const mesaFuerzaData = (iMesa >= 0 && iFuerza >= 0)
    ? crossTab(filteredRows, iMesa, iFuerza).slice(0, 20)
    : []
  const fuerzaKeys = iFuerza >= 0
    ? [...new Set(filteredRows.map(r => String(r[iFuerza] ?? "")).filter(Boolean))]
    : []

  const geoRows = (iLat >= 0 && iLon >= 0)
    ? filteredRows.filter(r => r[iLat] && r[iLon])
    : []

  const scatterData = geoRows
    .slice(0, 3000)
    .map(r => ({
      x: Number(r[iLon]),
      y: Number(r[iLat]),
      label: iEstab >= 0 ? String(r[iEstab] ?? "") : "",
      colorKey: iMesa >= 0 ? `Mesa ${r[iMesa]}` : undefined,
    }))

  const heatData = geoRows
    .slice(0, 5000)
    .map(r => ({ x: Number(r[iLon]), y: Number(r[iLat]) }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Padrón Electoral</h1>
          <p className="text-ink-3 text-sm mt-0.5">Demografía y estructura del padrón de Maipú 2025</p>
          <p className="text-xs text-ink-3 mt-1">
            {total.toLocaleString("es-AR")} registros
            {selectedBarrio && <span className="text-accent"> · {rows.length.toLocaleString("es-AR")} totales</span>}
            {lastUpdated && ` · ${lastUpdated.toLocaleTimeString("es-AR")}`}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-accent px-3 py-2 rounded-lg hover:bg-accent-tint border border-hairline transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Barrio filter */}
      <div className="bg-surface rounded-md border border-hairline px-4 py-3">
        <BarrioFilter value={selectedBarrio} onChange={setSelectedBarrio} />
      </div>

      {/* ★ KPIs demografía */}
      <section>
        <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Demografía básica</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="Total electores" value={total} color="#5b50e6" />
          {avgAge !== null && <KPICard title="Promedio de edad" value={`${avgAge} años`} color="#3c9bd6" />}
          {ages.length > 0 && <KPICard title="Primer voto (16–18)" value={primerVoto} color="#0f9b8e" subtitle={`${Math.round(primerVoto / total * 100)}% del padrón`} />}
          {ages.length > 0 && <KPICard title="Adultos mayores (65+)" value={adultMayores} color="#5b50e6" subtitle={`${Math.round(adultMayores / total * 100)}% del padrón`} />}
          {iMesa >= 0 && <KPICard title="Electores extranjeros" value={extranjeros} color="#e0921a" subtitle={`${pctExtr}% — mesa 9001`} />}
        </div>
      </section>

      {/* ★ Sexo + Edad */}
      {(sexoData.length > 0 || ageData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sexoData.length > 0 && (
            <PieChartComponent data={sexoData} dataKey="value" nameKey="name" title="★ Distribución por sexo" />
          )}
          {ageData.length > 0 && (
            <BarChartComponent
              data={ageData} dataKey="value" nameKey="name"
              color="#3c9bd6" title="★ Pirámide etaria (cohortes)" total={total}
            />
          )}
        </div>
      )}

      {/* ★ Nativos vs Extranjeros */}
      {origenData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Nativos y extranjeros</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KPICard title="Electores nativos" value={nativos.toLocaleString("es-AR")} color="#5b50e6" subtitle={`${pctNat}% del padrón`} />
            <KPICard title="Electores extranjeros" value={extranjeros.toLocaleString("es-AR")} color="#e0921a" subtitle={`${pctExtr}% — mesa 9001`} />
            {extSexoData.find(d => /^[Ff]/i.test(String(d.name))) && (
              <KPICard
                title="Extranjeras (F)"
                value={extSexoData.find(d => /^[Ff]/i.test(String(d.name)))?.value ?? 0}
                color="#c0497f"
                subtitle={`de ${extranjeros} extranjeros`}
              />
            )}
            {extSexoData.find(d => /^[Mm]/i.test(String(d.name))) && (
              <KPICard
                title="Extranjeros (M)"
                value={extSexoData.find(d => /^[Mm]/i.test(String(d.name)))?.value ?? 0}
                color="#3c9bd6"
                subtitle={`de ${extranjeros} extranjeros`}
              />
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartComponent
              data={origenData} dataKey="value" nameKey="name"
              title="★ Nativos vs extranjeros"
            />
            {extSexoData.length > 0 && natSexoData.length > 0 && (
              <div className="bg-surface rounded-md p-6 border border-hairline">
                <h3 className="text-sm font-semibold text-ink mb-5">Distribución por sexo — nativos vs extranjeros</h3>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-medium text-ink-2 mb-3">Nativos ({nativos.toLocaleString("es-AR")})</p>
                    <div className="space-y-2">
                      {natSexoData.map(d => (
                        <div key={String(d.name)}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-ink-2">{String(d.name)}</span>
                            <span className="font-semibold text-ink">
                              {d.value.toLocaleString("es-AR")}
                              <span className="text-ink-3 font-normal ml-1">({(d.value / nativos * 100).toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-panel rounded-full overflow-hidden">
                            <div className="h-full bg-[#5b50e6] rounded-full" style={{ width: `${d.value / nativos * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-2 mb-3">Extranjeros ({extranjeros.toLocaleString("es-AR")})</p>
                    <div className="space-y-2">
                      {extSexoData.map(d => (
                        <div key={String(d.name)}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-ink-2">{String(d.name)}</span>
                            <span className="font-semibold text-ink">
                              {d.value.toLocaleString("es-AR")}
                              <span className="text-ink-3 font-normal ml-1">({(d.value / extranjeros * 100).toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-panel rounded-full overflow-hidden">
                            <div className="h-full bg-warn rounded-full" style={{ width: `${d.value / extranjeros * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ★ Estructura electoral */}
      {mesaData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Estructura electoral</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {iMesa >= 0 && <KPICard title="Cantidad de mesas" value={mesaData.length} color="#3c9bd6" />}
            <KPICard title="Promedio x mesa" value={Math.round(total / mesaData.length)} color="#0f9b8e" />
            <KPICard title="Mesa más grande" value={mesaData[0]?.value ?? 0} color="#e0921a" subtitle={mesaData[0]?.name} />
          </div>
          <BarChartComponent
            data={mesaData} dataKey="value" nameKey="name"
            color="#5b50e6" title="Electores por mesa" total={total}
          />
        </section>
      )}

      {estabData.length > 0 && (
        <HorizontalBarChart
          data={estabData} color="#3c9bd6"
          title="★ Electores por establecimiento"
          subtitle="Logística de fiscalización"
          total={total}
        />
      )}

      {/* ★ Cobertura JP */}
      {fuerzaData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Cobertura padrón JP</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartComponent
              data={fuerzaData} dataKey="value" nameKey="name"
              title="★ Distribución por fuerza política (P23)"
            />
            {mesaFuerzaData.length > 0 && fuerzaKeys.length > 0 && (
              <StackedBarChart
                data={mesaFuerzaData} keys={fuerzaKeys}
                title="★ Cobertura JP por mesa"
                subtitle="Identificación de fuerza por mesa"
                badge="★ CORE"
              />
            )}
          </div>
        </section>
      )}

      {/* ★ Mapa de calor geográfico */}
      {heatData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Geografía</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KPICard title="Georreferenciados" value={geoRows.length} color="#0f9b8e" subtitle={`${Math.round(geoRows.length / total * 100)}% del padrón`} />
            {sinGeo !== null && sinGeo > 0 && (
              <KPICard title="Sin geocodificación" value={sinGeo} color="#d6456a" subtitle={`${Math.round(sinGeo / total * 100)}% — a limpiar`} />
            )}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeafletMap
              data={heatData}
              title="★ Mapa de calor — densidad de electores"
              subtitle={`${heatData.length.toLocaleString("es-AR")} electores georreferenciados`}
              badge="★ CORE"
              mode="heat"
            />
            <LeafletMap
              data={scatterData}
              title="★ Mapa de electores por establecimiento"
              subtitle="Coloreado por mesa electoral"
              badge="★ CORE"
              mode="scatter"
            />
          </div>
        </section>
      )}

      {/* ● Circuitos */}
      {circData.length > 0 && (
        <HorizontalBarChart
          data={circData} color="#5b50e6"
          title="● Distribución por circuito"
          badge="● QUICK WIN"
          total={total}
        />
      )}

      {/* ◆ Profesiones */}
      {profData.length > 0 && (
        <HorizontalBarChart
          data={profData}
          title="◆ Top 20 profesiones"
          subtitle="Calidad del dato: % 'SIN INFORM'"
          badge="◆ AVANZADO"
          maxItems={20}
          total={total}
        />
      )}

      {/* Tabla completa */}
      <section>
        <h2 className="text-base font-semibold text-ink mb-3">Datos completos</h2>
        <DataTable headers={headers} rows={filteredRows} />
      </section>
    </div>
  )
}
