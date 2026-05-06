"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import type { SheetTab } from "@/types"
import { findCol, valueCounts, ageGroups, ageFromClase, COL } from "@/lib/columnMatcher"
import {
  isBlank, hasContactValue, pctFilled, cleanValueCounts,
  calcularSegmentacion, calcularIndices, calcularCompletitud,
  exportCSV, exportSegment, exportReport,
  normalizaVoto, joinSheetByKey, segmentar,
  type SegCols, type SegmentacionResult, type IndicesResult, type ColCompletitud, type Segmento,
} from "@/lib/dataUtils"
import KPICard from "@/components/charts/KPICard"
import PieChartComponent from "@/components/charts/PieChartComponent"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import BarChartComponent from "@/components/charts/BarChartComponent"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]
interface Props { sheetId: string; votoSheetId?: string }

type TabId = "resumen" | "territorio" | "perfil" | "contactabilidad" | "politica" | "calidad"

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "resumen",         label: "Resumen",         icon: "▦" },
  { id: "territorio",      label: "Territorio",       icon: "⊞" },
  { id: "perfil",          label: "Perfil",           icon: "◉" },
  { id: "contactabilidad", label: "Contactabilidad",  icon: "◈" },
  { id: "politica",        label: "Política",         icon: "◆" },
  { id: "calidad",         label: "Calidad",          icon: "✓" },
]

function idx(n: number) { return n >= 0 }

function pct(a: number, b: number) { return b ? Math.round(a / b * 100) : 0 }

function IndexGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-black" style={{ color }}>{value}</span>
        <span className="text-sm text-gray-400 pb-1">/100</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function ChannelBar({ label, pct: p, count, total }: { label: string; pct: number; count: number; total: number }) {
  const color = p >= 60 ? "#10b981" : p >= 30 ? "#f59e0b" : "#ef4444"
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-bold" style={{ color }}>{p}%
          <span className="text-xs text-gray-400 font-normal ml-2">{count.toLocaleString("es-AR")} / {total.toLocaleString("es-AR")}</span>
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PadronEnriquecidoContent({ sheetId, votoSheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [rawHeaders, setRawHeaders]   = useState<string[]>([])
  const [rawRows, setRawRows]         = useState<Row[]>([])
  const [votoHeaders, setVotoHeaders] = useState<string[]>([])
  const [votoRows, setVotoRows]       = useState<Row[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab]     = useState<TabId>("resumen")
  const [sheetTabs, setSheetTabs]     = useState<SheetTab[]>([])
  const [activeSheetTab, setActiveSheetTab] = useState<string>("")

  // Fetch available sheet tabs once
  useEffect(() => {
    if (!accessToken) return
    fetchSheetTabs(sheetId, accessToken)
      .then(tabs => {
        setSheetTabs(tabs)
        if (tabs.length > 0 && !activeSheetTab) setActiveSheetTab(tabs[0].title)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId, accessToken])

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const range = activeSheetTab ? `'${activeSheetTab}'!A:ZZ` : "A:ZZ"
      const reqs: Promise<{ headers: string[]; rows: Row[] }>[] = [
        fetchSheetData(sheetId, range, accessToken),
      ]
      if (votoSheetId) reqs.push(fetchSheetData(votoSheetId, "A:ZZ", accessToken))
      const [padron, voto] = await Promise.all(reqs)
      setRawHeaders(padron.headers); setRawRows(padron.rows)
      if (voto) { setVotoHeaders(voto.headers); setVotoRows(voto.rows) }
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, votoSheetId, accessToken, activeSheetTab])

  useEffect(() => { load() }, [load])

  // ── Join padrón + voto data by DNI ─────────────────────────────────────────
  const { headers, rows, votoMatched } = useMemo(() => {
    if (!votoRows.length || !votoHeaders.length)
      return { headers: rawHeaders, rows: rawRows, votoMatched: 0 }
    const mainDni = findCol(rawHeaders, COL.documento)
    const joinDni = findCol(votoHeaders, COL.documento)
    if (mainDni < 0 || joinDni < 0)
      return { headers: rawHeaders, rows: rawRows, votoMatched: 0 }
    const { headers, rows, matched } = joinSheetByKey(
      rawHeaders, rawRows, mainDni, votoHeaders, votoRows, joinDni
    )
    return { headers, rows, votoMatched: matched }
  }, [rawHeaders, rawRows, votoHeaders, votoRows])

  // ── Column detection ────────────────────────────────────────────────────────
  const cols = useMemo(() => ({
    sexo:      findCol(headers, COL.sexo),
    clase:     findCol(headers, COL.clase),
    mesa:      findCol(headers, COL.mesa),
    estab:     findCol(headers, COL.establecimiento),
    circ:      findCol(headers, COL.circuito),
    lat:       findCol(headers, COL.lat),
    lon:       findCol(headers, COL.lon),
    nombre:    findCol(headers, COL.nombre),
    apellido:  findCol(headers, COL.apellido),
    domicilio: findCol(headers, COL.domicilio),
    barrio:    findCol(headers, COL.barrio),
    celular:   findCol(headers, COL.celular),
    email:     findCol(headers, COL.email),
    redes:     findCol(headers, COL.redesSociales),
    educ:      findCol(headers, COL.educacion),
    civil:     findCol(headers, COL.estadoCivil),
    afil:      findCol(headers, COL.afiliacion),
    obs:       findCol(headers, COL.observaciones),
    prof:      findCol(headers, COL.profesion),
    voto:      findCol(headers, COL.voto),
  }), [headers])

  const segCols: SegCols = useMemo(() => ({
    iCelular:   cols.celular,
    iEmail:     cols.email,
    iRedes:     cols.redes,
    iAfil:      cols.afil,
    iDomicilio: cols.domicilio,
    iBarrio:    cols.barrio,
  }), [cols])

  // ── Analytics ───────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (!rows.length) return null
    const total = rows.length

    // Age
    const ages  = cols.clase >= 0
      ? rows.map(r => ageFromClase(r[cols.clase])).filter((a): a is number => a !== null)
      : []
    const avgAge = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null

    // Sex
    const sexoData  = cols.sexo >= 0 ? cleanValueCounts(rows, cols.sexo, 10) : []
    const totalF    = sexoData.filter(d => /^f|mujer|femenino/i.test(String(d.name))).reduce((s, d) => s + d.value, 0)
    const totalM    = sexoData.filter(d => /^m|hombre|masculino|varon/i.test(String(d.name))).reduce((s, d) => s + d.value, 0)

    // Contactability
    const cntCelular  = cols.celular >= 0 ? rows.filter(r => hasContactValue(r[cols.celular])).length : 0
    const cntEmail    = cols.email   >= 0 ? rows.filter(r => hasContactValue(r[cols.email])).length   : 0
    const cntRedes    = cols.redes   >= 0 ? rows.filter(r => hasContactValue(r[cols.redes])).length   : 0
    const cntAnyContact = rows.filter(r =>
      (cols.celular >= 0 && hasContactValue(r[cols.celular])) ||
      (cols.email   >= 0 && hasContactValue(r[cols.email]))   ||
      (cols.redes   >= 0 && hasContactValue(r[cols.redes]))
    ).length

    // Enriched = has at least one non-basic column filled
    const enrichedCols = [cols.celular, cols.email, cols.redes, cols.educ, cols.civil, cols.afil]
      .filter(i => i >= 0)
    const cntEnriched = enrichedCols.length
      ? rows.filter(r => enrichedCols.some(i => hasContactValue(r[i]))).length
      : 0

    // Segmentation
    const seg = calcularSegmentacion(rows, segCols)

    // Key column indices for quality
    const keyCols = [cols.nombre, cols.apellido, cols.sexo, cols.clase, cols.domicilio, cols.celular, cols.email, cols.mesa]
      .filter(i => i >= 0)
    const indices = calcularIndices(rows, seg, keyCols)

    // Completitud
    const completitud = calcularCompletitud(headers, rows)

    // Geo
    const geoRows = (cols.lat >= 0 && cols.lon >= 0)
      ? rows.filter(r => !isBlank(r[cols.lat]) && !isBlank(r[cols.lon])).length
      : 0

    // Mesa ranking
    const mesaData = cols.mesa >= 0
      ? cleanValueCounts(rows, cols.mesa, 40).map(d => ({ name: `Mesa ${d.name}`, value: d.value }))
      : []

    // Circuito
    const circData = cols.circ >= 0 ? cleanValueCounts(rows, cols.circ, 20) : []

    // Contact by circuito
    const contactByCircuito: { name: string; value: number }[] = []
    if (cols.circ >= 0) {
      const circs = cleanValueCounts(rows, cols.circ, 20).map(d => d.name)
      for (const c of circs) {
        const sub = rows.filter(r => String(r[cols.circ] ?? "").trim() === c)
        const cnt = sub.filter(r =>
          (cols.celular >= 0 && hasContactValue(r[cols.celular])) ||
          (cols.email >= 0 && hasContactValue(r[cols.email]))
        ).length
        if (cnt > 0) contactByCircuito.push({ name: c, value: Math.round(cnt / sub.length * 100) })
      }
      contactByCircuito.sort((a, b) => b.value - a.value)
    }

    // Age groups
    const ageGroupData = cols.clase >= 0 ? ageGroups(rows, cols.clase, cols.sexo) : []

    // Civil / Educ / Afil
    const civilData = cols.civil >= 0 ? cleanValueCounts(rows, cols.civil, 10) : []
    const educData  = cols.educ  >= 0 ? cleanValueCounts(rows, cols.educ,  10) : []
    const afilData  = cols.afil  >= 0 ? cleanValueCounts(rows, cols.afil,  15) : []

    // Participation
    const votoSI  = cols.voto >= 0 ? rows.filter(r => normalizaVoto(r[cols.voto]) === true).length  : 0
    const votoNO  = cols.voto >= 0 ? rows.filter(r => normalizaVoto(r[cols.voto]) === false).length : 0
    const votoKnown = votoSI + votoNO

    const participacionCircuito: { name: string; value: number }[] = []
    if (cols.voto >= 0 && cols.circ >= 0) {
      for (const { name } of cleanValueCounts(rows, cols.circ, 20)) {
        const sub   = rows.filter(r => String(r[cols.circ] ?? "").trim() === name)
        const si    = sub.filter(r => normalizaVoto(r[cols.voto]) === true).length
        const known = sub.filter(r => normalizaVoto(r[cols.voto]) !== null).length
        if (known > 0) participacionCircuito.push({ name, value: Math.round(si / known * 100) })
      }
      participacionCircuito.sort((a, b) => b.value - a.value)
    }

    const participacionMesa: { name: string; value: number }[] = []
    if (cols.voto >= 0 && cols.mesa >= 0) {
      for (const { name, value: cnt } of cleanValueCounts(rows, cols.mesa, 32)) {
        const sub   = rows.filter(r => String(r[cols.mesa] ?? "").trim() === String(name))
        const si    = sub.filter(r => normalizaVoto(r[cols.voto]) === true).length
        const known = sub.filter(r => normalizaVoto(r[cols.voto]) !== null).length
        if (known > 0) participacionMesa.push({ name: `Mesa ${name}`, value: Math.round(si / known * 100) })
      }
      participacionMesa.sort((a, b) => b.value - a.value)
    }

    const participacionBySeg: { name: string; value: number }[] = []
    if (cols.voto >= 0) {
      const SEGS: [Segmento, string][] = [
        ["nucleoDuro",            "Núcleo duro"],
        ["contactableDigital",    "Cont. digital"],
        ["contactableTerritorial","Cont. territorial"],
        ["persuadible",           "Persuadible"],
        ["sinAlcance",            "Sin alcance"],
      ]
      for (const [seg, label] of SEGS) {
        const sub   = rows.filter(r => segmentar(r, segCols) === seg)
        const si    = sub.filter(r => normalizaVoto(r[cols.voto]) === true).length
        const known = sub.filter(r => normalizaVoto(r[cols.voto]) !== null).length
        if (known > 0) participacionBySeg.push({ name: label, value: Math.round(si / known * 100) })
      }
    }

    const participacionSexo: { name: string; value: number }[] = []
    if (cols.voto >= 0 && cols.sexo >= 0) {
      for (const { name } of cleanValueCounts(rows, cols.sexo, 5)) {
        const sub   = rows.filter(r => String(r[cols.sexo] ?? "").trim() === name)
        const si    = sub.filter(r => normalizaVoto(r[cols.voto]) === true).length
        const known = sub.filter(r => normalizaVoto(r[cols.voto]) !== null).length
        if (known > 0) participacionSexo.push({ name, value: Math.round(si / known * 100) })
      }
    }

    // Segmentation pie data
    const segPieData = [
      { name: "Núcleo duro",               value: seg.nucleoDuro },
      { name: "Contactable digital",        value: seg.contactableDigital },
      { name: "Contactable territorial",    value: seg.contactableTerritorial },
      { name: "Persuadible",                value: seg.persuadible },
      { name: "Sin alcance",                value: seg.sinAlcance },
    ].filter(d => d.value > 0)

    return {
      total, ages, avgAge, totalF, totalM,
      cntCelular, cntEmail, cntRedes, cntAnyContact, cntEnriched,
      seg, indices, completitud, geoRows,
      sexoData, ageGroupData, civilData, educData, afilData,
      mesaData, circData, contactByCircuito, segPieData,
      pctF: pct(totalF, total), pctM: pct(totalM, total),
      pctCelular: pct(cntCelular, total), pctEmail: pct(cntEmail, total),
      pctRedes: pct(cntRedes, total), pctContact: pct(cntAnyContact, total),
      pctEnriched: pct(cntEnriched, total),
      votoSI, votoNO, votoKnown,
      pctParticipacion: votoKnown > 0 ? Math.round(votoSI / votoKnown * 100) : null,
      participacionCircuito, participacionMesa, participacionBySeg, participacionSexo,
    }
  }, [rows, headers, cols, segCols])

  if (loading) return <LoadingSpinner label="Cargando padrón enriquecido..." />
  if (error)   return <ErrorState message={error} />

  const a = analytics
  if (!a) return <ErrorState message="No se encontraron datos en el sheet." />

  const ExportBtn = ({ label, icon, onClick, color = "sky" }: { label: string; icon: string; onClick: () => void; color?: string }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all
        ${color === "green" ? "border-green-200 text-green-700 hover:bg-green-50" :
          color === "purple" ? "border-purple-200 text-purple-700 hover:bg-purple-50" :
          "border-sky-200 text-sky-700 hover:bg-sky-50"}`}
    >
      <span>{icon}</span>{label}
    </button>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Padrón Electoral Enriquecido</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {a.total.toLocaleString("es-AR")} electores · {headers.length} columnas detectadas
            {votoMatched > 0 && ` · ${votoMatched.toLocaleString("es-AR")} cruzados con voto`}
          </p>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Actualizado {lastUpdated.toLocaleTimeString("es-AR")}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sheetTabs.length > 1 && (
            <select
              value={activeSheetTab}
              onChange={e => setActiveSheetTab(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              {sheetTabs.map(t => (
                <option key={t.id} value={t.title}>{t.title}</option>
              ))}
            </select>
          )}
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-50 border border-sky-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-2xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === t.id
                ? "bg-white shadow-sm text-[#1e3a5f]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: RESUMEN                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          <section>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — KPIs generales</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard title="Total padrón" value={a.total.toLocaleString("es-AR")} color="#1e3a5f" />
              <KPICard title="% Mujeres" value={`${a.pctF}%`} color="#ec4899" subtitle={`${a.totalF.toLocaleString("es-AR")} electoras`} />
              <KPICard title="% Hombres" value={`${a.pctM}%`} color="#0ea5e9" subtitle={`${a.totalM.toLocaleString("es-AR")} electores`} />
              {a.avgAge !== null && <KPICard title="Edad promedio" value={`${a.avgAge} años`} color="#8b5cf6" />}
              <KPICard title="% Enriquecido" value={`${a.pctEnriched}%`} color="#10b981" subtitle={`${a.cntEnriched.toLocaleString("es-AR")} registros`} />
              <KPICard title="Contactables" value={`${a.pctContact}%`} color="#f59e0b" subtitle={`${a.cntAnyContact.toLocaleString("es-AR")} registros`} />
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Índices de campaña</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <IndexGauge label="Contactabilidad" value={a.indices.contactabilidad} color="#10b981" />
              <IndexGauge label="Persuadibilidad" value={a.indices.persuadibilidad} color="#0ea5e9" />
              <IndexGauge label="Movilización" value={a.indices.movilizacion} color="#f59e0b" />
              <IndexGauge label="Calidad de datos" value={a.indices.calidadDatos} color="#8b5cf6" />
            </div>
          </section>

          {a.pctParticipacion !== null && (
            <section>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">★ Participación electoral — datos reales del padrón</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KPICard title="Participación real" value={`${a.pctParticipacion}%`} color="#10b981" subtitle={`${a.votoSI.toLocaleString("es-AR")} votaron`} />
                <KPICard title="Ausentismo" value={`${100 - a.pctParticipacion}%`} color="#ef4444" subtitle={`${a.votoNO.toLocaleString("es-AR")} no votaron`} />
                <KPICard title="Cruzados con voto" value={a.votoKnown.toLocaleString("es-AR")} color="#6b7280" subtitle={`${pct(a.votoKnown, a.total)}% del padrón`} />
                <KPICard title="Sin info de voto" value={(a.total - a.votoKnown).toLocaleString("es-AR")} color="#d1d5db" subtitle="no cruzados" />
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Segmentación electoral</p>
              <PieChartComponent
                data={a.segPieData} dataKey="value" nameKey="name"
                title="Segmentación del padrón"
              />
            </section>
            <section>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Resumen de segmentos</p>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
                {[
                  { label: "Núcleo duro", value: a.seg.nucleoDuro, color: "#1e3a5f", desc: "Afiliado + contacto" },
                  { label: "Contactable digital", value: a.seg.contactableDigital, color: "#10b981", desc: "Tiene celular / email" },
                  { label: "Contactable territorial", value: a.seg.contactableTerritorial, color: "#0ea5e9", desc: "Tiene domicilio" },
                  { label: "Persuadible", value: a.seg.persuadible, color: "#f59e0b", desc: "Sin afil, algún contacto" },
                  { label: "Sin alcance", value: a.seg.sinAlcance, color: "#ef4444", desc: "Sin datos de contacto" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <div>
                        <span className="font-semibold text-gray-800">{s.label}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.desc}</span>
                      </div>
                      <span className="font-bold" style={{ color: s.color }}>
                        {s.value.toLocaleString("es-AR")}
                        <span className="text-xs text-gray-400 ml-1 font-normal">({pct(s.value, a.total)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct(s.value, a.total)}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Export */}
          <section className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Exportables</p>
            <div className="flex flex-wrap gap-3">
              <ExportBtn label="CSV completo" icon="⬇" onClick={() => exportCSV(headers, rows, "padron_completo.csv")} color="sky" />
              <ExportBtn label="Núcleo duro" icon="⬇" onClick={() => exportSegment(headers, rows, segCols, "nucleoDuro", "padron_nucleo_duro.csv")} color="green" />
              <ExportBtn label="Contactables digital" icon="⬇" onClick={() => exportSegment(headers, rows, segCols, "contactableDigital", "padron_digital.csv")} color="green" />
              <ExportBtn label="Persuadibles" icon="⬇" onClick={() => exportSegment(headers, rows, segCols, "persuadible", "padron_persuadibles.csv")} color="green" />
              <ExportBtn label="Reporte ejecutivo" icon="📊" onClick={() => exportReport(headers, rows, a.seg, a.indices)} color="purple" />
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: TERRITORIO                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "territorio" && (
        <div className="space-y-6">
          <section>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Estructura territorial</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {a.circData.length > 0 && <KPICard title="Circuitos" value={a.circData.length} color="#1e3a5f" />}
              {a.mesaData.length > 0 && <KPICard title="Mesas" value={a.mesaData.length} color="#0ea5e9" />}
              {a.mesaData.length > 0 && <KPICard title="Promedio x mesa" value={Math.round(a.total / a.mesaData.length)} color="#10b981" />}
              {a.geoRows > 0 && <KPICard title="Georreferenciados" value={`${pct(a.geoRows, a.total)}%`} color="#8b5cf6" subtitle={`${a.geoRows.toLocaleString("es-AR")} registros`} />}
            </div>
          </section>

          {a.circData.length > 0 && (
            <HorizontalBarChart
              data={a.circData} color="#1e3a5f"
              title="★ Electores por circuito"
              badge="★ CORE" total={a.total}
            />
          )}

          {a.mesaData.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Ranking de mesas</p>
              <HorizontalBarChart
                data={a.mesaData} color="#0ea5e9"
                title="● Electores por mesa (top 30)"
                badge="● QUICK WIN" total={a.total} maxItems={30}
              />
            </section>
          )}

          {a.mesaData.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Tabla completa de mesas</h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="text-gray-500 text-left">
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Mesa</th>
                        <th className="px-4 py-3 font-medium text-right">Electores</th>
                        <th className="px-4 py-3 font-medium text-right">% del padrón</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.mesaData.map((m, i) => (
                        <tr key={m.name} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{m.name}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{m.value.toLocaleString("es-AR")}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">{pct(m.value, a.total)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-3 flex gap-3">
                <ExportBtn label="Exportar mesas CSV" icon="⬇"
                  onClick={() => exportCSV(["Mesa", "Electores", "% del padrón"],
                    a.mesaData.map(m => [m.name, m.value, pct(m.value, a.total)]),
                    "mesas_padron.csv")}
                />
              </div>
            </section>
          )}

          {a.participacionCircuito.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">★ Participación real por circuito (%)</p>
              <HorizontalBarChart
                data={a.participacionCircuito} color="#10b981"
                title="% que votó por circuito"
                badge="★ CORE"
              />
            </section>
          )}

          {a.participacionMesa.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Participación real por mesa (%)</p>
              <HorizontalBarChart
                data={a.participacionMesa} color="#0ea5e9"
                title="% que votó por mesa"
                badge="● QUICK WIN"
              />
            </section>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: PERFIL                                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "perfil" && (
        <div className="space-y-6">
          <section>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Perfil demográfico</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard title="Electoras (F)" value={`${a.pctF}%`} color="#ec4899" subtitle={a.totalF.toLocaleString("es-AR")} />
              <KPICard title="Electores (M)" value={`${a.pctM}%`} color="#0ea5e9" subtitle={a.totalM.toLocaleString("es-AR")} />
              {a.avgAge !== null && <KPICard title="Edad promedio" value={`${a.avgAge} años`} color="#8b5cf6" />}
              <KPICard title="Completitud perfil" value={`${pctFilled(rows, cols.nombre)}%`} color="#10b981" subtitle="nombres cargados" />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {a.sexoData.length > 0 && (
              <PieChartComponent data={a.sexoData} dataKey="value" nameKey="name" title="★ Distribución por sexo" />
            )}
            {a.ageGroupData.length > 0 && (
              <BarChartComponent
                data={a.ageGroupData} dataKey="value" nameKey="name"
                color="#8b5cf6" title="★ Grupos etarios" total={a.total}
              />
            )}
          </div>

          {(a.civilData.length > 0 || a.educData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {a.civilData.length > 0 && (
                <HorizontalBarChart
                  data={a.civilData} color="#0ea5e9"
                  title="● Estado civil" badge="● QUICK WIN" total={a.total}
                />
              )}
              {a.educData.length > 0 && (
                <HorizontalBarChart
                  data={a.educData} color="#10b981"
                  title="● Nivel educativo" badge="● QUICK WIN" total={a.total}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CONTACTABILIDAD                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "contactabilidad" && (
        <div className="space-y-6">
          <section>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Canales de contacto</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard title="Índice de contacto" value={`${a.indices.contactabilidad}/100`} color="#10b981" />
              <KPICard title="Con celular" value={`${a.pctCelular}%`} color="#0ea5e9" subtitle={`${a.cntCelular.toLocaleString("es-AR")} registros`} />
              <KPICard title="Con email" value={`${a.pctEmail}%`} color="#8b5cf6" subtitle={`${a.cntEmail.toLocaleString("es-AR")} registros`} />
              <KPICard title="Con redes" value={`${a.pctRedes}%`} color="#ec4899" subtitle={`${a.cntRedes.toLocaleString("es-AR")} registros`} />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
              <h3 className="text-sm font-semibold text-gray-700">Alcance por canal</h3>
              <ChannelBar label="📱 Celular / WhatsApp" pct={a.pctCelular} count={a.cntCelular} total={a.total} />
              <ChannelBar label="✉️ Email" pct={a.pctEmail} count={a.cntEmail} total={a.total} />
              <ChannelBar label="📲 Redes sociales" pct={a.pctRedes} count={a.cntRedes} total={a.total} />
              <ChannelBar label="🎯 Cualquier canal" pct={a.pctContact} count={a.cntAnyContact} total={a.total} />
              <div className="pt-3 border-t border-gray-50">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Sin ningún canal de contacto</span>
                  <span className="font-semibold text-red-400">{(a.total - a.cntAnyContact).toLocaleString("es-AR")} ({100 - a.pctContact}%)</span>
                </div>
              </div>
            </div>

            <PieChartComponent
              data={[
                { name: "Con celular", value: a.cntCelular },
                { name: "Solo email", value: Math.max(0, a.cntEmail - a.cntCelular) },
                { name: "Solo redes", value: Math.max(0, a.cntRedes - a.cntCelular - a.cntEmail) },
                { name: "Sin contacto", value: a.total - a.cntAnyContact },
              ].filter(d => d.value > 0)}
              dataKey="value" nameKey="name"
              title="Distribución de canales"
            />
          </div>

          {a.contactByCircuito.length > 0 && (
            <HorizontalBarChart
              data={a.contactByCircuito}
              color="#10b981"
              title="● % Contactabilidad por circuito"
              subtitle="Qué % del circuito tiene al menos un canal de contacto"
              badge="● QUICK WIN"
            />
          )}

          <div className="mt-3 flex gap-3 flex-wrap">
            <ExportBtn label="Exportar contactables" icon="⬇"
              onClick={() => exportSegment(headers, rows, segCols, "contactableDigital", "contactables_digital.csv")}
            />
            <ExportBtn label="Sin contacto (a trabajar)" icon="⬇"
              onClick={() => {
                const sinContacto = rows.filter(r =>
                  !(cols.celular >= 0 && hasContactValue(r[cols.celular])) &&
                  !(cols.email >= 0 && hasContactValue(r[cols.email])) &&
                  !(cols.redes >= 0 && hasContactValue(r[cols.redes]))
                )
                exportCSV(headers, sinContacto, "sin_contacto.csv")
              }}
              color="purple"
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: POLÍTICA                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "politica" && (
        <div className="space-y-6">
          <section>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Inteligencia política</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard title="Núcleo duro" value={a.seg.nucleoDuro.toLocaleString("es-AR")} color="#1e3a5f" subtitle={`${pct(a.seg.nucleoDuro, a.total)}% del padrón`} />
              <KPICard title="Contactable digital" value={a.seg.contactableDigital.toLocaleString("es-AR")} color="#10b981" subtitle={`${pct(a.seg.contactableDigital, a.total)}%`} />
              <KPICard title="Contactable territorial" value={a.seg.contactableTerritorial.toLocaleString("es-AR")} color="#0ea5e9" subtitle={`${pct(a.seg.contactableTerritorial, a.total)}%`} />
              <KPICard title="Persuadibles" value={a.seg.persuadible.toLocaleString("es-AR")} color="#f59e0b" subtitle={`${pct(a.seg.persuadible, a.total)}%`} />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartComponent
              data={a.segPieData} dataKey="value" nameKey="name"
              title="★ Segmentación electoral"
            />
            {a.afilData.length > 0 && (
              <HorizontalBarChart
                data={a.afilData} color="#1e3a5f"
                title="★ Afiliación política"
                badge="★ CORE" total={a.total}
              />
            )}
          </div>

          {a.afilData.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-700">
              <p className="font-medium mb-1">Columna de afiliación no detectada</p>
              <p className="text-xs">La segmentación usa domicilio y datos de contacto. Para activar "Núcleo duro" basado en afiliación, agregá una columna con nombre "afiliacion", "partido_pol" o similar al sheet.</p>
            </div>
          )}

          {a.participacionBySeg.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">★ Participación real por segmento (%)</p>
              <HorizontalBarChart
                data={a.participacionBySeg} color="#10b981"
                title="% que votó por segmento electoral"
                badge="★ CORE"
              />
            </section>
          )}

          <div className="flex gap-3 flex-wrap">
            <ExportBtn label="Núcleo duro CSV" icon="⬇"
              onClick={() => exportSegment(headers, rows, segCols, "nucleoDuro", "nucleo_duro.csv")}
              color="sky"
            />
            <ExportBtn label="Persuadibles CSV" icon="⬇"
              onClick={() => exportSegment(headers, rows, segCols, "persuadible", "persuadibles.csv")}
              color="green"
            />
            <ExportBtn label="Sin alcance CSV" icon="⬇"
              onClick={() => exportSegment(headers, rows, segCols, "sinAlcance", "sin_alcance.csv")}
              color="purple"
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CALIDAD                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "calidad" && (
        <div className="space-y-6">
          <section>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Calidad de datos</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard title="Índice calidad global" value={`${a.indices.calidadDatos}/100`} color={a.indices.calidadDatos >= 70 ? "#10b981" : a.indices.calidadDatos >= 40 ? "#f59e0b" : "#ef4444"} />
              <KPICard title="Columnas" value={headers.length} color="#0ea5e9" />
              <KPICard title="Georreferenciados" value={`${pct(a.geoRows, a.total)}%`} color="#8b5cf6" subtitle={`${a.geoRows.toLocaleString("es-AR")} registros`} />
              <KPICard title="Total registros" value={a.total.toLocaleString("es-AR")} color="#1e3a5f" />
            </div>
          </section>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-5">Completitud por columna</h3>
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2">
              {a.completitud.map(c => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium truncate max-w-[60%]">{c.name}</span>
                    <span className={`font-bold ${c.pct >= 80 ? "text-green-600" : c.pct >= 40 ? "text-amber-500" : "text-red-500"}`}>
                      {c.pct}%
                      <span className="text-gray-400 font-normal ml-1">({c.filled.toLocaleString("es-AR")} / {c.total.toLocaleString("es-AR")})</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${c.pct}%`,
                        backgroundColor: c.pct >= 80 ? "#10b981" : c.pct >= 40 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Columnas críticas para campaña</h3>
              <div className="space-y-3">
                {[
                  { label: "Nombre completo", idx: cols.nombre >= 0 ? cols.nombre : cols.apellido },
                  { label: "Mesa electoral", idx: cols.mesa },
                  { label: "Circuito", idx: cols.circ },
                  { label: "Celular / WhatsApp", idx: cols.celular },
                  { label: "Email", idx: cols.email },
                  { label: "Redes sociales", idx: cols.redes },
                  { label: "Domicilio", idx: cols.domicilio },
                  { label: "Afiliación política", idx: cols.afil },
                ].map(({ label, idx: i }) => {
                  const p = i >= 0 ? pctFilled(rows, i) : -1
                  return (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{label}</span>
                      {p < 0 ? (
                        <span className="text-xs text-gray-300 italic">No detectada</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: p >= 80 ? "#10b981" : p >= 40 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <span className={`text-xs font-bold w-8 text-right ${p >= 80 ? "text-green-600" : p >= 40 ? "text-amber-500" : "text-red-500"}`}>{p}%</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-amber-800 mb-3">Prioridades de limpieza</h3>
              <div className="space-y-2 text-sm text-amber-700">
                {a.completitud.filter(c => c.pct < 40 && c.pct > 0).slice(0, 6).map(c => (
                  <div key={c.name} className="flex items-center justify-between">
                    <span>⚠ {c.name}</span>
                    <span className="font-bold text-red-600">{c.pct}% completo</span>
                  </div>
                ))}
                {a.completitud.filter(c => c.pct === 0).slice(0, 4).map(c => (
                  <div key={c.name} className="flex items-center justify-between text-xs text-gray-400">
                    <span>✗ {c.name}</span>
                    <span>Vacía</span>
                  </div>
                ))}
                {a.completitud.filter(c => c.pct < 40).length === 0 && (
                  <p className="text-green-700 font-medium">✓ Todas las columnas tienen más del 40% de datos</p>
                )}
              </div>
            </div>
          </div>

          <section className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Exportar datos</p>
            <div className="flex flex-wrap gap-3">
              <ExportBtn label="Padrón completo CSV" icon="⬇" onClick={() => exportCSV(headers, rows, "padron_completo.csv")} color="sky" />
              <ExportBtn label="Registros vacíos CSV" icon="⬇"
                onClick={() => {
                  const keyIdx = [cols.celular, cols.email, cols.domicilio].filter(i => i >= 0)
                  if (!keyIdx.length) return
                  const empty = rows.filter(r => keyIdx.every(i => isBlank(r[i])))
                  exportCSV(headers, empty, "registros_sin_contacto.csv")
                }}
                color="purple"
              />
              <ExportBtn label="Reporte ejecutivo" icon="📊" onClick={() => exportReport(headers, rows, a.seg, a.indices)} color="green" />
            </div>
          </section>
        </div>
      )}

      {/* Tabla completa (todos los tabs muestran acceso) */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors">
          ▸ Ver datos completos ({a.total.toLocaleString("es-AR")} registros)
        </summary>
        <div className="mt-4">
          <DataTable headers={headers} rows={rows} />
        </div>
      </details>
    </div>
  )
}
