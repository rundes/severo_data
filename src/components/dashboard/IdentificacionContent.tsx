"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import {
  findCol, findAllCols, valueCounts, ageGroups, p26ByBarrio, normalizeVoto,
  detectImageCols, extractImageUrls, timeSeries, normalizaParticipacion, COL,
} from "@/lib/columnMatcher"
import { segmentar, type SegCols } from "@/lib/dataUtils"
import { filterByBarrio } from "@/lib/barriosGeo"
import KPICard from "@/components/charts/KPICard"
import PieChartComponent from "@/components/charts/PieChartComponent"
import StackedBarChart from "@/components/charts/StackedBarChart"
import BarChartComponent from "@/components/charts/BarChartComponent"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import LineChartComponent from "@/components/charts/LineChartComponent"
import LeafletMap from "@/components/charts/LeafletMapWrapper"
import DataTable from "@/components/dashboard/DataTable"
import ImageGallery from "@/components/dashboard/ImageGallery"
import BarrioFilter from "@/components/ui/BarrioFilter"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]
type TabId = "resumen" | "analisis" | "cruce" | "territorio" | "datos"

interface Props { sheetId: string }

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "resumen",   label: "Resumen",      icon: "▦" },
  { id: "analisis",  label: "Análisis",     icon: "◉" },
  { id: "cruce",     label: "Cruce Padrón", icon: "⊗" },
  { id: "territorio",label: "Territorio",   icon: "⊞" },
  { id: "datos",     label: "Datos",        icon: "◈" },
]

function pct(n: number, total: number) { return total ? Math.round(n / total * 100) : 0 }

export default function IdentificacionContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [headers, setHeaders]     = useState<string[]>([])
  const [rows, setRows]           = useState<Row[]>([])
  const [tabName, setTabName]     = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedBarrio, setSelectedBarrio] = useState("")
  const [activeTab, setActiveTab] = useState<TabId>("resumen")

  const [padronRows, setPadronRows]       = useState<Row[]>([])
  const [padronHeaders, setPadronHeaders] = useState<string[]>([])
  const [padronLoading, setPadronLoading] = useState(false)
  const [padronLoaded, setPadronLoaded]   = useState(false)

  const filteredRows = useMemo(() => {
    if (!selectedBarrio) return rows
    const iL = findCol(headers, COL.lat)
    const iLo = findCol(headers, COL.lon)
    const iB  = findCol(headers, COL.barrio)
    return filterByBarrio(rows, selectedBarrio, iL, iLo, iB)
  }, [rows, headers, selectedBarrio])

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const tabs = await fetchSheetTabs(sheetId, accessToken)
      const ciudTab = tabs.find(t => /ciudadano/i.test(t.title)) ?? tabs[0]
      if (!ciudTab) throw new Error("No se encontró hoja de Ciudadanos")
      setTabName(ciudTab.title)
      const d = await fetchSheetData(sheetId, `'${ciudTab.title}'!A:ZZ`, accessToken)
      setHeaders(d.headers); setRows(d.rows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  const loadPadron = useCallback(async () => {
    if (!accessToken || padronLoaded || padronLoading) return
    const padronId = process.env.NEXT_PUBLIC_SHEET_PADRON_ID
    if (!padronId) return
    setPadronLoading(true)
    try {
      const tabs = await fetchSheetTabs(padronId, accessToken)
      const best =
        tabs.find(t => /padron.enriquecido/i.test(t.title)) ??
        tabs.find(t => /enriquecido/i.test(t.title)) ??
        tabs.find(t => /padr[oó]n/i.test(t.title)) ?? tabs[0]
      if (!best) return
      const d = await fetchSheetData(padronId, `'${best.title}'!A:ZZ`, accessToken)
      setPadronHeaders(d.headers); setPadronRows(d.rows); setPadronLoaded(true)
    } catch { /* silent */ } finally { setPadronLoading(false) }
  }, [accessToken, padronLoaded, padronLoading])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (activeTab === "cruce") loadPadron() }, [activeTab, loadPadron])

  const a = useMemo(() => {
    if (!rows.length) return null
    const iP26    = findCol(headers, COL.p26)
    const iBarrio = findCol(headers, COL.barrio)
    const iClase  = findCol(headers, COL.edadRelevado)
    const iLat    = findCol(headers, COL.lat)
    const iLon    = findCol(headers, COL.lon)
    const iDni    = findCol(headers, COL.documento)
    const iFecha  = findCol(headers, COL.fecha)
    const iSexo   = findCol(headers, COL.sexo)
    const iRelev  = findCol(headers, COL.relevador)
    const total   = filteredRows.length

    const p26Counts: Record<string, number> = { SI: 0, NO: 0, DUDOSO: 0, OTRO: 0 }
    if (iP26 >= 0) filteredRows.forEach(r => { p26Counts[normalizeVoto(String(r[iP26] ?? ""))]++ })
    const p26Norm = Object.entries(p26Counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
    const totalSI = p26Counts.SI; const totalNO = p26Counts.NO; const totalDudoso = p26Counts.DUDOSO

    const p26Barrio = (iP26 >= 0 && iBarrio >= 0) ? p26ByBarrio(filteredRows, iBarrio, iP26) : []

    const ageP26Data = (iClase >= 0 && iP26 >= 0) ? (() => {
      const groups = ageGroups(filteredRows, iClase)
      const si: Record<string, number> = {}; const tot: Record<string, number> = {}
      filteredRows.forEach(r => {
        const yearsOld = 2026 - Number(r[iClase])
        let grp = ""
        if (yearsOld >= 16 && yearsOld <= 18) grp = "16–18"
        else if (yearsOld >= 19 && yearsOld <= 29) grp = "19–29"
        else if (yearsOld >= 30 && yearsOld <= 44) grp = "30–44"
        else if (yearsOld >= 45 && yearsOld <= 64) grp = "45–64"
        else if (yearsOld >= 65) grp = "65+"
        if (!grp) return
        tot[grp] = (tot[grp] ?? 0) + 1
        if (normalizeVoto(String(r[iP26] ?? "")) === "SI") si[grp] = (si[grp] ?? 0) + 1
      })
      return groups.map(g => ({ name: g.name, value: tot[g.name] ? Math.round((si[g.name] ?? 0) / tot[g.name] * 100) : 0 }))
    })() : []

    const p26BySexo: { name: string; SI: number; NO: number; DUDOSO: number; total: number }[] = []
    if (iSexo >= 0 && iP26 >= 0) {
      const m: Record<string, { SI: number; NO: number; DUDOSO: number; total: number }> = {}
      filteredRows.forEach(r => {
        const s = String(r[iSexo] ?? "").trim() || "Sin dato"
        const v = normalizeVoto(String(r[iP26] ?? ""))
        m[s] ??= { SI: 0, NO: 0, DUDOSO: 0, total: 0 }
        m[s].total++
        if (v === "SI") m[s].SI++; else if (v === "NO") m[s].NO++; else if (v === "DUDOSO") m[s].DUDOSO++
      })
      Object.entries(m).forEach(([name, v]) => p26BySexo.push({ name, ...v }))
    }

    const cadencia = iFecha >= 0 ? timeSeries(filteredRows, iFecha) : []

    const relevStats: { name: string; total: number; si: number; pctSI: number }[] = []
    if (iRelev >= 0 && iP26 >= 0) {
      const m: Record<string, { total: number; si: number }> = {}
      filteredRows.forEach(r => {
        const rel = String(r[iRelev] ?? "Sin dato").trim()
        m[rel] ??= { total: 0, si: 0 }; m[rel].total++
        if (normalizeVoto(String(r[iP26] ?? "")) === "SI") m[rel].si++
      })
      Object.entries(m).forEach(([name, v]) => relevStats.push({ name, ...v, pctSI: Math.round(v.si / v.total * 100) }))
      relevStats.sort((a, b) => b.total - a.total)
    }

    const scatterData = (iLat >= 0 && iLon >= 0 && iP26 >= 0)
      ? filteredRows.filter(r => r[iLat] && r[iLon]).slice(0, 2000).map(r => ({
          x: Number(r[iLon]), y: Number(r[iLat]),
          label: normalizeVoto(String(r[iP26] ?? "")),
          colorKey: normalizeVoto(String(r[iP26] ?? "")),
        }))
      : []

    const imgCols = detectImageCols(headers, filteredRows)
    const imgNamed = findCol(headers, COL.foto)
    const allImgCols = [...new Set([...(imgNamed >= 0 ? [imgNamed] : []), ...imgCols])]
    const allImageUrls = allImgCols.flatMap(ci => extractImageUrls(filteredRows, ci))

    return { iP26, iBarrio, iClase, iLat, iLon, iDni, iSexo, total,
      p26Norm, totalSI, totalNO, totalDudoso,
      p26Barrio, ageP26Data, p26BySexo, cadencia, relevStats, scatterData, allImageUrls }
  }, [filteredRows, headers])

  const cruceAnalytics = useMemo(() => {
    if (!padronLoaded || !padronRows.length || !a || a.iDni < 0) return null
    const iDniPadron = findCol(padronHeaders, COL.documento)
    if (iDniPadron < 0) return null

    const padronByDni = new Map<string, Row>()
    padronRows.forEach(r => { const d = String(r[iDniPadron] ?? "").trim(); if (d) padronByDni.set(d, r) })

    const segCols: SegCols = {
      iCelular: findCol(padronHeaders, COL.celular),
      iEmail:   findCol(padronHeaders, COL.email),
      iRedes:   findCol(padronHeaders, COL.redesSociales),
      iAfil:    findCol(padronHeaders, COL.afiliacion),
      iDomicilio: findCol(padronHeaders, COL.domicilio),
      iBarrio:  findCol(padronHeaders, COL.barrio),
    }
    const iVotoOct = findCol(padronHeaders, COL.votoOct25)
    const SEG_LABELS: Record<string, string> = {
      nucleoDuro: "Núcleo duro", contactableDigital: "Contactable digital",
      contactableTerritorial: "Contactable territorial", persuadible: "Persuadible", sinAlcance: "Sin alcance",
    }

    let totalCubiertos = 0; let siNucleoDuro = 0
    let siConVotoKnown = 0; let siConVotoOct = 0
    const segMap: Record<string, { SI: number; NO: number; DUDOSO: number; total: number }> = {}

    filteredRows.forEach(r => {
      const dni = String(r[a.iDni] ?? "").trim()
      const padronRow = padronByDni.get(dni)
      if (!padronRow) return
      totalCubiertos++
      const seg = segmentar(padronRow, segCols)
      const label = SEG_LABELS[seg]
      const p26 = a.iP26 >= 0 ? normalizeVoto(String(r[a.iP26] ?? "")) : "OTRO"
      segMap[label] ??= { SI: 0, NO: 0, DUDOSO: 0, total: 0 }
      segMap[label].total++
      if (p26 === "SI") { segMap[label].SI++; if (seg === "nucleoDuro") siNucleoDuro++ }
      else if (p26 === "NO") segMap[label].NO++
      else if (p26 === "DUDOSO") segMap[label].DUDOSO++
      if (p26 === "SI" && iVotoOct >= 0) {
        const v = normalizaParticipacion(padronRow[iVotoOct])
        if (v !== null) { siConVotoKnown++; if (v === true) siConVotoOct++ }
      }
    })

    const fidelidadOct = siConVotoKnown > 0 ? Math.round(siConVotoOct / siConVotoKnown * 100) : null
    const segList = Object.entries(segMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)

    return { totalPadron: padronRows.length, totalCubiertos, siNucleoDuro, fidelidadOct, segList }
  }, [padronLoaded, padronRows, padronHeaders, filteredRows, a])

  if (loading) return <LoadingSpinner label="Cargando identificación electoral..." />
  if (error) return <ErrorState message={error} />
  if (!a) return null

  const RefreshBtn = () => (
    <button onClick={load} className="flex items-center gap-1.5 text-xs text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-50 border border-sky-200 transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Actualizar
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Identificación Electoral</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Hoja: <span className="font-medium">{tabName}</span> · {a.total.toLocaleString("es-AR")} registros
            {selectedBarrio && <span className="text-sky-600"> · {rows.length.toLocaleString("es-AR")} totales</span>}
          </p>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Actualizado {lastUpdated.toLocaleTimeString("es-AR")}</p>}
        </div>
        <RefreshBtn />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
        <BarrioFilter value={selectedBarrio} onChange={setSelectedBarrio} />
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === t.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* RESUMEN */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          {a.iP26 < 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              No se encontró la columna P26 (¿nos votaría?) en esta hoja.
            </div>
          )}
          {a.p26Norm.length > 0 && (
            <>
              <section>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — P26 ¿Nos votaría?</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard title="Total SI" value={a.totalSI.toLocaleString("es-AR")} color="#10b981" subtitle={`${pct(a.totalSI, a.total)}% del total`} />
                  <KPICard title="Total NO" value={a.totalNO.toLocaleString("es-AR")} color="#ef4444" subtitle={`${pct(a.totalNO, a.total)}% del total`} />
                  <KPICard title="Dudosos" value={a.totalDudoso.toLocaleString("es-AR")} color="#f59e0b" subtitle={`${pct(a.totalDudoso, a.total)}%`} />
                  <KPICard title="Relevados" value={a.total.toLocaleString("es-AR")} color="#1e3a5f" />
                </div>
              </section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PieChartComponent data={a.p26Norm} dataKey="value" nameKey="name"
                  title="★ Distribución P26 — ¿Nos votaría?"
                  caption={`${pct(a.totalSI, a.total)}% respondió SI sobre ${a.total.toLocaleString("es-AR")} relevados`} />
                {a.p26Barrio.length > 0 && (
                  <StackedBarChart data={a.p26Barrio} keys={["SI", "NO", "DUDOSO", "OTRO"]}
                    title="★ P26 por barrio" subtitle="Comparativa de intención por zona" badge="★ CORE" />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ANÁLISIS */}
      {activeTab === "analisis" && (
        <div className="space-y-6">
          {a.ageP26Data.some(d => d.value > 0) && (
            <section>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — % SI por rango etario</p>
              <BarChartComponent data={a.ageP26Data} dataKey="value" nameKey="name" color="#10b981"
                title="% que respondió SI por grupo de edad"
                caption={(() => {
                  const top = a.ageP26Data.reduce((x, y) => y.value > x.value ? y : x, { name: "", value: 0 })
                  return top.value ? `Mayor adhesión en franja ${top.name} (${top.value}%)` : undefined
                })()} />
            </section>
          )}
          {a.p26BySexo.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● P26 por sexo</p>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
                {a.p26BySexo.map(s => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-gray-700">{s.name}</span>
                      <span className="font-bold text-green-600">{pct(s.SI, s.total)}% SI
                        <span className="text-xs text-gray-400 font-normal ml-2">{s.SI} de {s.total}</span>
                      </span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div className="bg-green-500" style={{ width: `${pct(s.SI, s.total)}%` }} />
                      <div className="bg-red-400"   style={{ width: `${pct(s.NO, s.total)}%` }} />
                      <div className="bg-amber-400" style={{ width: `${pct(s.DUDOSO, s.total)}%` }} />
                    </div>
                    <div className="flex gap-4 mt-1 text-[10px] text-gray-400">
                      <span>SI: {s.SI}</span><span>NO: {s.NO}</span><span>DUDOSO: {s.DUDOSO}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {a.cadencia.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Cadencia de relevamiento</p>
              <LineChartComponent data={a.cadencia} dataKey="value" nameKey="name" color="#10b981"
                title="Nuevos registros por día" />
            </section>
          )}
          {a.relevStats.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Eficiencia por relevador (% SI)</p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Relevador</th>
                      <th className="text-right px-4 py-3">Total</th>
                      <th className="text-right px-4 py-3">SI</th>
                      <th className="text-right px-4 py-3">% SI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {a.relevStats.slice(0, 20).map((r, i) => (
                      <tr key={r.name} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.name}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{r.total}</td>
                        <td className="px-4 py-2.5 text-right text-green-600 font-medium">{r.si}</td>
                        <td className="px-4 py-2.5 text-right font-bold"
                          style={{ color: r.pctSI >= 60 ? "#10b981" : r.pctSI >= 40 ? "#f59e0b" : "#ef4444" }}>
                          {r.pctSI}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* CRUCE PADRÓN */}
      {activeTab === "cruce" && (
        <div className="space-y-6">
          {padronLoading && <LoadingSpinner label="Cargando padrón enriquecido para cruce..." />}
          {!padronLoading && !padronLoaded && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
              <p className="font-medium mb-1">No se pudo acceder al padrón</p>
              <p className="text-xs">Verificá que NEXT_PUBLIC_SHEET_PADRON_ID esté configurado.</p>
            </div>
          )}
          {padronLoaded && !cruceAnalytics && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
              <p className="font-medium mb-1">No se puede cruzar con el padrón</p>
              <p className="text-xs">No se encontró columna DNI/Documento en alguna de las dos hojas.</p>
            </div>
          )}
          {cruceAnalytics && (
            <>
              <section>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Cobertura del padrón</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard title="Total padrón" value={cruceAnalytics.totalPadron.toLocaleString("es-AR")} color="#1e3a5f" />
                  <KPICard title="Identificados en padrón" value={cruceAnalytics.totalCubiertos.toLocaleString("es-AR")} color="#0ea5e9"
                    subtitle={`${pct(cruceAnalytics.totalCubiertos, cruceAnalytics.totalPadron)}% del padrón`} />
                  <KPICard title="SI del núcleo duro" value={cruceAnalytics.siNucleoDuro.toLocaleString("es-AR")} color="#10b981"
                    subtitle="afiliados + contacto" />
                  {cruceAnalytics.fidelidadOct !== null && (
                    <KPICard title="Fidelidad Oct 2025" value={`${cruceAnalytics.fidelidadOct}%`} color="#8b5cf6"
                      subtitle="de los SI que votaron" />
                  )}
                </div>
                <div className="mt-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500 mb-2">Cobertura del padrón</p>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${Math.min(100, pct(cruceAnalytics.totalCubiertos, cruceAnalytics.totalPadron))}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {cruceAnalytics.totalCubiertos.toLocaleString("es-AR")} de {cruceAnalytics.totalPadron.toLocaleString("es-AR")} electores contactados
                  </p>
                </div>
              </section>
              {cruceAnalytics.segList.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● P26 por segmento electoral (padrón cruzado)</p>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-4 py-3">Segmento</th>
                          <th className="text-right px-4 py-3">Relevados</th>
                          <th className="text-right px-4 py-3">SI</th>
                          <th className="text-right px-4 py-3">NO</th>
                          <th className="text-right px-4 py-3">DUDOSO</th>
                          <th className="text-right px-4 py-3">% SI</th>
                          <th className="px-4 py-3 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cruceAnalytics.segList.map(s => (
                          <tr key={s.name} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-semibold text-gray-800">{s.name}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{s.total}</td>
                            <td className="px-4 py-2.5 text-right text-green-600 font-medium">{s.SI}</td>
                            <td className="px-4 py-2.5 text-right text-red-500">{s.NO}</td>
                            <td className="px-4 py-2.5 text-right text-amber-500">{s.DUDOSO}</td>
                            <td className="px-4 py-2.5 text-right font-bold"
                              style={{ color: pct(s.SI, s.total) >= 60 ? "#10b981" : pct(s.SI, s.total) >= 40 ? "#f59e0b" : "#ef4444" }}>
                              {pct(s.SI, s.total)}%
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-green-500" style={{ width: `${pct(s.SI, s.total)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Solo incluye electores del relevamiento que se encontraron en el padrón enriquecido (match por DNI).</p>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* TERRITORIO */}
      {activeTab === "territorio" && (
        <div className="space-y-6">
          {a.scatterData.length > 0 ? (
            <LeafletMap data={a.scatterData} title="★ Mapa de intención de voto (P26)"
              subtitle="Verde=SI · Rojo=NO · Amarillo=DUDOSO" badge="★ CORE"
              colorMap={{ "SI": "#10b981", "NO": "#ef4444", "DUDOSO": "#f59e0b", "OTRO": "#94a3b8" }} />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-700">
              <p className="font-medium mb-1">Mapa no disponible</p>
              <p className="text-xs">No se encontraron columnas de coordenadas (lat/lon) en esta hoja.</p>
            </div>
          )}
          {a.p26Barrio.length > 0 && (
            <StackedBarChart data={a.p26Barrio} keys={["SI", "NO", "DUDOSO", "OTRO"]}
              title="P26 por barrio" subtitle="Distribución por zona" badge="★ CORE" />
          )}
        </div>
      )}

      {/* DATOS */}
      {activeTab === "datos" && (
        <div className="space-y-6">
          {a.allImageUrls.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Registro fotográfico</p>
              <ImageGallery urls={a.allImageUrls} title="Fotos del relevamiento" badge="★ CORE" />
            </section>
          )}
          <DataTable headers={headers} rows={filteredRows} />
        </div>
      )}
    </div>
  )
}
