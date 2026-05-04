"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import {
  findCol, valueCounts, ageGroups, p26ByBarrio, normalizeVoto, COL,
} from "@/lib/columnMatcher"
import KPICard from "@/components/charts/KPICard"
import PieChartComponent from "@/components/charts/PieChartComponent"
import StackedBarChart from "@/components/charts/StackedBarChart"
import BarChartComponent from "@/components/charts/BarChartComponent"
import ScatterMap from "@/components/charts/ScatterMap"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]

interface Props { sheetId: string }

export default function IdentificacionContent({ sheetId }: Props) {
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
      const ciudTab = tabs.find(t => /ciudadano/i.test(t.title)) ?? tabs[0]
      if (!ciudTab) throw new Error("No se encontró hoja de Ciudadanos")
      setTabName(ciudTab.title)
      const d = await fetchSheetData(sheetId, `${ciudTab.title}!A:Z`, accessToken)
      setHeaders(d.headers); setRows(d.rows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner label="Cargando identificación electoral..." />
  if (error) return <ErrorState message={error} />

  const iP26    = findCol(headers, COL.p26)
  const iBarrio = findCol(headers, COL.barrio)
  const iClase  = findCol(headers, COL.edadRelevado)
  const iLat    = findCol(headers, COL.lat)
  const iLon    = findCol(headers, COL.lon)

  // P26 distribution
  const p26Raw = iP26 >= 0 ? valueCounts(rows, iP26) : []
  const p26Norm: { name: string; value: number }[] = []
  if (iP26 >= 0) {
    const counts: Record<string, number> = { SI: 0, NO: 0, DUDOSO: 0, OTRO: 0 }
    rows.forEach(r => {
      const v = normalizeVoto(String(r[iP26] ?? ""))
      counts[v]++
    })
    Object.entries(counts).forEach(([name, value]) => {
      if (value > 0) p26Norm.push({ name, value })
    })
  }

  const total = rows.length
  const totalSI = p26Norm.find(d => d.name === "SI")?.value ?? 0
  const totalNO = p26Norm.find(d => d.name === "NO")?.value ?? 0
  const pctSI = total ? Math.round(totalSI / total * 100) : 0

  // P26 × Barrio
  const p26Barrio = (iP26 >= 0 && iBarrio >= 0) ? p26ByBarrio(rows, iBarrio, iP26) : []

  // P26 × Edad
  const ageP26Data = (iClase >= 0 && iP26 >= 0)
    ? (() => {
        const groups = ageGroups(rows, iClase)
        // For simplicity, show SI% by age group
        const siByGroup: Record<string, number> = {}
        const totalByGroup: Record<string, number> = {}
        rows.forEach(r => {
          const age = Number(r[iClase])
          if (isNaN(age)) return
          const currentYear = 2026
          const yearsOld = currentYear - age
          let grp = ""
          if (yearsOld >= 16 && yearsOld <= 18) grp = "16–18"
          else if (yearsOld >= 19 && yearsOld <= 29) grp = "19–29"
          else if (yearsOld >= 30 && yearsOld <= 44) grp = "30–44"
          else if (yearsOld >= 45 && yearsOld <= 64) grp = "45–64"
          else if (yearsOld >= 65) grp = "65+"
          if (!grp) return
          totalByGroup[grp] = (totalByGroup[grp] ?? 0) + 1
          if (normalizeVoto(String(r[iP26] ?? "")) === "SI") {
            siByGroup[grp] = (siByGroup[grp] ?? 0) + 1
          }
        })
        return groups.map(g => ({
          name: g.name,
          value: totalByGroup[g.name]
            ? Math.round((siByGroup[g.name] ?? 0) / totalByGroup[g.name] * 100)
            : 0,
        }))
      })()
    : []

  // Scatter by P26
  const scatterData = (iLat >= 0 && iLon >= 0 && iP26 >= 0)
    ? rows
        .filter(r => r[iLat] && r[iLon])
        .slice(0, 2000)
        .map(r => ({
          x: Number(r[iLon]),
          y: Number(r[iLat]),
          label: normalizeVoto(String(r[iP26] ?? "")),
          colorKey: normalizeVoto(String(r[iP26] ?? "")),
        }))
    : []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Identificación Electoral</h1>
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

      {iP26 < 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          No se encontró la columna P26 (¿nos votaría?) en esta hoja. Verificá que el nombre de la columna contenga &quot;P26&quot; o &quot;votaría&quot;.
        </div>
      )}

      {/* ★ KPIs P26 */}
      {p26Norm.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — P26 ¿Nos votaría?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPICard title="Total SI" value={totalSI} color="#10b981" subtitle={`${pctSI}% del total`} />
            <KPICard title="Total NO" value={totalNO} color="#ef4444" subtitle={`${Math.round(totalNO/total*100)}% del total`} />
            <KPICard title="Relevados total" value={total} color="#1e3a5f" />
            <KPICard title="% identificación" value={`${pctSI}% SI`} color="#0ea5e9" />
          </div>
        </section>
      )}

      {/* ★ Pie P26 + Mapa */}
      {p26Norm.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PieChartComponent
            data={p26Norm}
            dataKey="value"
            nameKey="name"
            title="★ Distribución P26 — ¿Nos votaría?"
          />
          {scatterData.length > 0 && (
            <ScatterMap
              data={scatterData}
              title="★ Mapa de intención de voto (P26)"
              subtitle="Verde=SI · Rojo=NO · Amarillo=DUDOSO"
              badge="★ CORE"
            />
          )}
        </div>
      )}

      {/* ★ P26 × Barrio */}
      {p26Barrio.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — P26 por barrio</p>
          <StackedBarChart
            data={p26Barrio}
            keys={["SI", "NO", "DUDOSO", "OTRO"]}
            title="★ P26 por barrio (cantidad)"
            subtitle="Barrios fuertes vs débiles"
            badge="★ CORE"
          />
        </section>
      )}

      {/* ● P26 × Edad */}
      {ageP26Data.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Quick Win — P26 por rango etario</p>
          <BarChartComponent
            data={ageP26Data}
            dataKey="value"
            nameKey="name"
            color="#10b981"
            title="● % SI por rango de edad"
          />
        </section>
      )}

      {/* Columnas no detectadas */}
      {p26Raw.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Valores raw — P26</h2>
          <div className="flex flex-wrap gap-2">
            {p26Raw.map(d => (
              <div key={d.name} className="px-3 py-1.5 bg-gray-50 rounded-lg text-xs">
                <span className="font-medium text-gray-700">{d.name}</span>
                <span className="text-gray-400 ml-2">{d.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Datos completos</h2>
        <DataTable headers={headers} rows={rows} />
      </section>
    </div>
  )
}
