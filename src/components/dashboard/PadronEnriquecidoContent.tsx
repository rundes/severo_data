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
  normalizaVoto, segmentar,
  type SegCols, type SegmentacionResult, type IndicesResult, type ColCompletitud, type Segmento,
} from "@/lib/dataUtils"
import { normalizaParticipacion, electionStats } from "@/lib/columnMatcher"
import KPICard from "@/components/charts/KPICard"
import PieChartComponent from "@/components/charts/PieChartComponent"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import BarChartComponent from "@/components/charts/BarChartComponent"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"
import ScatterMap from "@/components/charts/ScatterMap"

type Row = (string | number | null)[]
interface Props { sheetId: string }

type TabId = "resumen" | "territorio" | "perfil" | "contactabilidad" | "politica" | "cruce" | "mapa" | "calidad"

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "resumen",         label: "Resumen",         icon: "▦" },
  { id: "territorio",      label: "Territorio",       icon: "⊞" },
  { id: "perfil",          label: "Perfil",           icon: "◉" },
  { id: "contactabilidad", label: "Contactabilidad",  icon: "◈" },
  { id: "politica",        label: "Política",         icon: "◆" },
  { id: "cruce",           label: "Cruce Electoral",  icon: "⊗" },
  { id: "mapa",            label: "Mapas",            icon: "◎" },
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

export default function PadronEnriquecidoContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [rawHeaders, setRawHeaders]   = useState<string[]>([])
  const [rawRows, setRawRows]         = useState<Row[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab]     = useState<TabId>("resumen")
  const [sheetTabs, setSheetTabs]     = useState<SheetTab[]>([])
  const [activeSheetTab, setActiveSheetTab] = useState<string>("")
  const [filterCircuito, setFilterCircuito] = useState<string>("")
  const [mapMode, setMapMode] = useState<"electores" | "participacion" | "abstención" | "contactabilidad">("electores")

  // Fetch available sheet tabs for both sheets
  useEffect(() => {
    if (!accessToken) return
    fetchSheetTabs(sheetId, accessToken)
      .then(tabs => {
        setSheetTabs(tabs)
        if (tabs.length > 0 && !activeSheetTab) {
          // Prefer a tab that looks like the enriched padron (not voto/historial)
          const best =
            tabs.find(t => /padron.enriquecido/i.test(t.title)) ??
            tabs.find(t => /enriquecido/i.test(t.title)) ??
            tabs.find(t => /padr[oó]n/i.test(t.title) && !/voto|historial/i.test(t.title)) ??
            tabs.find(t => !/voto|historial/i.test(t.title)) ??
            tabs[0]
          setActiveSheetTab(best.title)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId, accessToken])

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const range = activeSheetTab ? `'${activeSheetTab}'!A:ZZ` : "A:ZZ"
      const padron = await fetchSheetData(sheetId, range, accessToken)
      setRawHeaders(padron.headers); setRawRows(padron.rows)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken, activeSheetTab])

  useEffect(() => { load() }, [load])

  // ── Use inline padron data directly (vote participation is inline) ──────────
  const headers = rawHeaders
  const rows    = rawRows

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
    domicilioReal: findCol(headers, COL.domicilioReal),
    barrio:    findCol(headers, COL.localidad),
    celular:   findCol(headers, COL.celular),
    email:     findCol(headers, COL.email),
    redes:     findCol(headers, COL.redesSociales),
    educ:      findCol(headers, COL.educacion),
    civil:     findCol(headers, COL.estadoCivil),
    afil:      findCol(headers, COL.afiliacion),
    obs:       findCol(headers, COL.observaciones),
    prof:      findCol(headers, COL.profesion),
    auh:       findCol(headers, COL.auh),
    ife:       findCol(headers, COL.ife),
    // Inline election participation columns (VOTÓ / NO VOTÓ / SIN DATO)
    votoSep25: findCol(headers, COL.votoSep25),
    votoOct25: findCol(headers, COL.votoOct25),
    votoPaso23: findCol(headers, COL.votoPaso23),
    votoGen23: findCol(headers, COL.votoGen23),
    votoBal23: findCol(headers, COL.votoBal23),
    votoPaso21: findCol(headers, COL.votoPaso21),
    votoGen21: findCol(headers, COL.votoGen21),
    votoPaso19: findCol(headers, COL.votoPaso19),
    votoGen19: findCol(headers, COL.votoGen19),
    // Default "voto" for backward-compat uses Oct 2025 (most recent)
    voto:      findCol(headers, COL.votoOct25) >= 0 ? findCol(headers, COL.votoOct25) : findCol(headers, COL.voto),
  }), [headers])

  const segCols: SegCols = useMemo(() => ({
    iCelular:   cols.celular,
    iEmail:     cols.email,
    iRedes:     cols.redes,
    iAfil:      cols.afil,
    iDomicilio: cols.domicilioReal >= 0 ? cols.domicilioReal : cols.domicilio,
    iBarrio:    cols.barrio,
  }), [cols])

  // ── Apply circuito filter ────────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    if (!filterCircuito || cols.circ < 0) return rows
    return rows.filter(r => String(r[cols.circ] ?? "").trim() === filterCircuito)
  }, [rows, cols.circ, filterCircuito])

  // ── Analytics ───────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const rows = displayRows
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

    // Geo (count for calidad/territorio tabs)
    const geoRowsCount = (cols.lat >= 0 && cols.lon >= 0)
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

    // Multi-election participation (inline padrón columns)
    const ELEC_COLS: { key: string; label: string; colIdx: number }[] = [
      { key: "sep25",  label: "Sep 2025",       colIdx: cols.votoSep25  },
      { key: "oct25",  label: "Oct 2025",        colIdx: cols.votoOct25  },
      { key: "paso23", label: "PASO 2023",       colIdx: cols.votoPaso23 },
      { key: "gen23",  label: "Generales 2023",  colIdx: cols.votoGen23  },
      { key: "bal23",  label: "Balotaje 2023",   colIdx: cols.votoBal23  },
      { key: "paso21", label: "PASO 2021",       colIdx: cols.votoPaso21 },
      { key: "gen21",  label: "Generales 2021",  colIdx: cols.votoGen21  },
      { key: "paso19", label: "PASO 2019",       colIdx: cols.votoPaso19 },
      { key: "gen19",  label: "Generales 2019",  colIdx: cols.votoGen19  },
    ].filter(e => e.colIdx >= 0)

    const elecChartData = ELEC_COLS.map(e => {
      const stats = electionStats(rows, e.colIdx)
      const pctVoto = stats.voted + stats.notVoted > 0
        ? Math.round(stats.voted / (stats.voted + stats.notVoted) * 100)
        : null
      return { name: e.label, value: pctVoto ?? 0, voted: stats.voted, notVoted: stats.notVoted, sinDato: stats.sinDato }
    })

    const statsSep25 = cols.votoSep25 >= 0 ? electionStats(rows, cols.votoSep25) : null
    const statsOct25 = cols.votoOct25 >= 0 ? electionStats(rows, cols.votoOct25) : null
    const pctSep25 = statsSep25 && (statsSep25.voted + statsSep25.notVoted > 0)
      ? Math.round(statsSep25.voted / (statsSep25.voted + statsSep25.notVoted) * 100) : null
    const pctOct25 = statsOct25 && (statsOct25.voted + statsOct25.notVoted > 0)
      ? Math.round(statsOct25.voted / (statsOct25.voted + statsOct25.notVoted) * 100) : null
    const caidaSepOct = (pctSep25 !== null && pctOct25 !== null) ? pctSep25 - pctOct25 : null

    // Abstención Oct25 recuperable (no votó Oct25 + has contact)
    const abstencionOct25Recuperable = cols.votoOct25 >= 0
      ? rows.filter(r => {
          if (normalizaParticipacion(r[cols.votoOct25]) !== false) return false
          return (cols.celular >= 0 && hasContactValue(r[cols.celular]))  ||
                 (cols.email   >= 0 && hasContactValue(r[cols.email]))    ||
                 (cols.domicilioReal >= 0 && hasContactValue(r[cols.domicilioReal])) ||
                 (cols.domicilio >= 0 && hasContactValue(r[cols.domicilio]))
        }).length
      : 0

    // Votantes fieles = voted in all available elections (Oct25 + any 2 others)
    const fidelColIdxs = ELEC_COLS.map(e => e.colIdx).filter(i => i >= 0)
    const votantesFieles = fidelColIdxs.length >= 2
      ? rows.filter(r => fidelColIdxs.every(i => normalizaParticipacion(r[i]) === true)).length
      : 0

    // AUH/IFE counts
    const cntAUH = cols.auh >= 0 ? rows.filter(r => /^s[ií]$/i.test(String(r[cols.auh] ?? "").trim())).length : 0
    const cntIFE = cols.ife >= 0 ? rows.filter(r => /^s[ií]$/i.test(String(r[cols.ife] ?? "").trim())).length : 0

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

    // ── Cruce electoral avanzado ────────────────────────────────────────────
    const SEGS_CFG: { seg: Segmento; label: string; color: string }[] = [
      { seg: "nucleoDuro",             label: "Núcleo duro",           color: "#1e3a5f" },
      { seg: "contactableDigital",     label: "Contactable digital",   color: "#10b981" },
      { seg: "contactableTerritorial", label: "Contactable territ.",   color: "#0ea5e9" },
      { seg: "persuadible",            label: "Persuadible",           color: "#f59e0b" },
      { seg: "sinAlcance",             label: "Sin alcance",           color: "#ef4444" },
    ]

    const cruceSeg = SEGS_CFG.map(({ seg, label, color }) => {
      const segRows = rows.filter(r => segmentar(r, segCols) === seg)
      const si    = cols.voto >= 0 ? segRows.filter(r => normalizaVoto(r[cols.voto]) === true).length  : 0
      const no    = cols.voto >= 0 ? segRows.filter(r => normalizaVoto(r[cols.voto]) === false).length : 0
      const known = si + no
      return { label, seg, color, total: segRows.length, si, no, known, pct: known > 0 ? Math.round(si / known * 100) : 0 }
    })

    const fidelidadNucleo = (() => {
      const nd = cruceSeg.find(s => s.seg === "nucleoDuro")
      return nd && nd.known > 0 ? nd.pct : null
    })()

    const abstencionRecuperable = abstencionOct25Recuperable > 0
      ? abstencionOct25Recuperable
      : cols.voto >= 0
        ? rows.filter(r => {
            if (normalizaVoto(r[cols.voto]) !== false) return false
            return (cols.celular   >= 0 && hasContactValue(r[cols.celular]))  ||
                   (cols.email     >= 0 && hasContactValue(r[cols.email]))    ||
                   (cols.domicilio >= 0 && hasContactValue(r[cols.domicilio]))
          }).length
        : 0

    const cruceEdad: { name: string; total: number; si: number; pct: number }[] = []
    if (cols.voto >= 0 && cols.clase >= 0) {
      const GRUPOS = [
        { label: "16–18", min: 16, max: 18 },
        { label: "19–29", min: 19, max: 29 },
        { label: "30–44", min: 30, max: 44 },
        { label: "45–64", min: 45, max: 64 },
        { label: "65+",   min: 65, max: 120 },
      ]
      for (const g of GRUPOS) {
        const sub   = rows.filter(r => { const a = ageFromClase(r[cols.clase]); return a !== null && a >= g.min && a <= g.max })
        const si    = sub.filter(r => normalizaVoto(r[cols.voto]) === true).length
        const known = sub.filter(r => normalizaVoto(r[cols.voto]) !== null).length
        if (known > 0) cruceEdad.push({ name: g.label, total: sub.length, si, pct: Math.round(si / known * 100) })
      }
    }

    const cruceSexo: { name: string; total: number; si: number; pct: number }[] = []
    if (cols.voto >= 0 && cols.sexo >= 0) {
      for (const { name } of cleanValueCounts(rows, cols.sexo, 5)) {
        const sub   = rows.filter(r => String(r[cols.sexo] ?? "").trim() === name)
        const si    = sub.filter(r => normalizaVoto(r[cols.voto]) === true).length
        const known = sub.filter(r => normalizaVoto(r[cols.voto]) !== null).length
        if (known > 0) cruceSexo.push({ name, total: sub.length, si, pct: Math.round(si / known * 100) })
      }
    }

    const mesaParticipacion: { name: string; total: number; si: number; no: number; pct: number }[] = []
    if (cols.voto >= 0 && cols.mesa >= 0) {
      for (const { name } of cleanValueCounts(rows, cols.mesa, 50)) {
        const sub   = rows.filter(r => String(r[cols.mesa] ?? "").trim() === String(name))
        const si    = sub.filter(r => normalizaVoto(r[cols.voto]) === true).length
        const no    = sub.filter(r => normalizaVoto(r[cols.voto]) === false).length
        const known = si + no
        if (known > 0) mesaParticipacion.push({ name: `Mesa ${name}`, total: sub.length, si, no, pct: Math.round(si / known * 100) })
      }
      mesaParticipacion.sort((a, b) => b.pct - a.pct)
    }

    // Segmentation pie data
    const segPieData = [
      { name: "Núcleo duro",               value: seg.nucleoDuro },
      { name: "Contactable digital",        value: seg.contactableDigital },
      { name: "Contactable territorial",    value: seg.contactableTerritorial },
      { name: "Persuadible",                value: seg.persuadible },
      { name: "Sin alcance",                value: seg.sinAlcance },
    ].filter(d => d.value > 0)

    // ── Map data ─────────────────────────────────────────────────────────────
    const geoRows = (cols.lat >= 0 && cols.lon >= 0)
      ? rows.filter(r => !isBlank(r[cols.lat]) && !isBlank(r[cols.lon]))
      : []

    const SEG_COLORS: Record<string, string> = {
      "Núcleo duro":           "#1e3a5f",
      "Contactable digital":   "#10b981",
      "Contactable territorial": "#0ea5e9",
      "Persuadible":           "#f59e0b",
      "Sin alcance":           "#ef4444",
    }
    const SEG_LABELS: Record<string, string> = {
      nucleoDuro:              "Núcleo duro",
      contactableDigital:      "Contactable digital",
      contactableTerritorial:  "Contactable territorial",
      persuadible:             "Persuadible",
      sinAlcance:              "Sin alcance",
    }

    const mapPointsElectores = geoRows.map(r => ({
      x: Number(r[cols.lon]),
      y: Number(r[cols.lat]),
      label: [r[cols.apellido], r[cols.nombre]].filter(Boolean).join(", ") || undefined,
      colorKey: SEG_LABELS[segmentar(r, segCols)] ?? "Sin alcance",
    }))

    const mapPointsParticipacion = cols.voto >= 0
      ? geoRows.map(r => {
          const v = normalizaVoto(r[cols.voto])
          return {
            x: Number(r[cols.lon]),
            y: Number(r[cols.lat]),
            label: [r[cols.apellido], r[cols.nombre]].filter(Boolean).join(", ") || undefined,
            colorKey: v === true ? "Votó" : v === false ? "No votó" : "Sin dato",
          }
        })
      : []

    const mapPointsAbstencion = cols.voto >= 0
      ? geoRows.filter(r => {
          if (normalizaVoto(r[cols.voto]) !== false) return false
          return (cols.celular >= 0 && hasContactValue(r[cols.celular])) ||
                 (cols.email >= 0 && hasContactValue(r[cols.email])) ||
                 (cols.domicilio >= 0 && hasContactValue(r[cols.domicilio]))
        }).map(r => ({
          x: Number(r[cols.lon]),
          y: Number(r[cols.lat]),
          colorKey: "Abstención recuperable",
        }))
      : []

    const mapPointsContacto = geoRows.map(r => {
      const digital = (cols.celular >= 0 && hasContactValue(r[cols.celular])) ||
                      (cols.email >= 0 && hasContactValue(r[cols.email]))
      const territorial = cols.domicilio >= 0 && hasContactValue(r[cols.domicilio])
      return {
        x: Number(r[cols.lon]),
        y: Number(r[cols.lat]),
        colorKey: digital ? "Digital" : territorial ? "Territorial" : "Sin contacto",
      }
    })

    return {
      total, ages, avgAge, totalF, totalM,
      cntCelular, cntEmail, cntRedes, cntAnyContact, cntEnriched,
      cntAUH, cntIFE,
      elecChartData, pctSep25, pctOct25, caidaSepOct, votantesFieles,
      abstencionOct25Recuperable,
      seg, indices, completitud, geoRowsCount,
      sexoData, ageGroupData, civilData, educData, afilData,
      mesaData, circData, contactByCircuito, segPieData,
      pctF: pct(totalF, total), pctM: pct(totalM, total),
      pctCelular: pct(cntCelular, total), pctEmail: pct(cntEmail, total),
      pctRedes: pct(cntRedes, total), pctContact: pct(cntAnyContact, total),
      pctEnriched: pct(cntEnriched, total),
      votoSI, votoNO, votoKnown,
      pctParticipacion: votoKnown > 0 ? Math.round(votoSI / votoKnown * 100) : null,
      participacionCircuito, participacionMesa, participacionBySeg, participacionSexo,
      cruceSeg, fidelidadNucleo, abstencionRecuperable, cruceEdad, cruceSexo, mesaParticipacion,
      geoRows: geoRows.length,
      mapPointsElectores, mapPointsParticipacion, mapPointsAbstencion, mapPointsContacto,
      SEG_COLORS,
    }
  }, [displayRows, headers, cols, segCols])

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
            {a.pctOct25 !== null && ` · Participación Oct 2025: ${a.pctOct25}%`}
          </p>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Actualizado {lastUpdated.toLocaleTimeString("es-AR")}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sheetTabs.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Padrón</span>
              <select
                value={activeSheetTab}
                onChange={e => setActiveSheetTab(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
              >
                {sheetTabs.map(t => (
                  <option key={t.id} value={t.title}>{t.title}</option>
                ))}
              </select>
            </div>
          )}
          {a.circData.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuito</span>
              <select
                value={filterCircuito}
                onChange={e => setFilterCircuito(e.target.value)}
                className="text-xs border border-purple-200 rounded-lg px-2 py-1.5 text-purple-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="">Todos</option>
                {a.circData.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              {filterCircuito && (
                <button onClick={() => setFilterCircuito("")} className="text-xs text-purple-500 hover:text-purple-700 ml-1">✕</button>
              )}
            </div>
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
              <KPICard title="% Enriquecido" value={`${a.pctEnriched}%`} color="#10b981"
                subtitle={`${a.cntEnriched.toLocaleString("es-AR")} registros`}
                alert={a.pctEnriched >= 60 ? "ok" : a.pctEnriched >= 30 ? "warn" : "danger"} />
              <KPICard title="Contactables" value={`${a.pctContact}%`} color="#f59e0b"
                subtitle={`${a.cntAnyContact.toLocaleString("es-AR")} registros`}
                alert={a.pctContact >= 50 ? "ok" : a.pctContact >= 25 ? "warn" : "danger"} />
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
                <KPICard title="Participación real" value={`${a.pctParticipacion}%`} color="#10b981"
                    subtitle={`${a.votoSI.toLocaleString("es-AR")} votaron`}
                    alert={a.pctParticipacion >= 70 ? "ok" : a.pctParticipacion >= 50 ? "warn" : "danger"} />
                  <KPICard title="Ausentismo" value={`${100 - a.pctParticipacion}%`} color="#ef4444"
                    subtitle={`${a.votoNO.toLocaleString("es-AR")} no votaron`}
                    alert={(100 - a.pctParticipacion) <= 30 ? "ok" : (100 - a.pctParticipacion) <= 50 ? "warn" : "danger"} />
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CRUCE ELECTORAL                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "cruce" && (
        <div className="space-y-6">
          {/* Multi-election analytics — always shown if any election col detected */}
          {a.elecChartData.length > 0 ? (
            <>
              {/* Sep/Oct 2025 KPIs — key metric */}
              <section>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Participación electoral 2025 (datos inline del padrón)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {a.pctSep25 !== null && (
                    <KPICard title="Participación Sep 2025" value={`${a.pctSep25}%`} color="#10b981"
                      subtitle="elecciones provinciales"
                      alert={a.pctSep25 >= 65 ? "ok" : a.pctSep25 >= 50 ? "warn" : "danger"} />
                  )}
                  {a.pctOct25 !== null && (
                    <KPICard title="Participación Oct 2025" value={`${a.pctOct25}%`} color="#0ea5e9"
                      subtitle="elecciones nacionales"
                      alert={a.pctOct25 >= 65 ? "ok" : a.pctOct25 >= 50 ? "warn" : "danger"} />
                  )}
                  {a.caidaSepOct !== null && (
                    <KPICard
                      title="Caída Sep→Oct" value={`${a.caidaSepOct > 0 ? "-" : "+"}${Math.abs(a.caidaSepOct)} pp`}
                      color={a.caidaSepOct > 5 ? "#ef4444" : a.caidaSepOct > 2 ? "#f59e0b" : "#10b981"}
                      subtitle="diferencial de participación"
                      alert={a.caidaSepOct > 5 ? "danger" : a.caidaSepOct > 2 ? "warn" : "ok"} />
                  )}
                  {a.votantesFieles > 0 && (
                    <KPICard title="Votantes fieles" value={a.votantesFieles.toLocaleString("es-AR")} color="#1e3a5f"
                      subtitle={`${pct(a.votantesFieles, a.total)}% — votaron en todas`} />
                  )}
                </div>
              </section>

              {/* Alert if Oct < Sep (anomaly) */}
              {a.caidaSepOct !== null && a.caidaSepOct > 5 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
                  <p className="font-semibold mb-1">Anomalía detectada: caída de participación Sep→Oct ({a.caidaSepOct} pp)</p>
                  <p className="text-xs">Maipú registra una caída inusual entre elecciones provinciales y nacionales 2025. La media de la 5ta sección fue +3,71 pp. Investigar mesas con mayor caída.</p>
                </div>
              )}

              {/* Multi-election bar chart */}
              <section>
                <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Participación por elección (9 elecciones inline)</p>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <BarChartComponent
                    data={a.elecChartData}
                    dataKey="value"
                    nameKey="name"
                    color="#1e3a5f"
                    title="% participación por elección"
                    total={100}
                  />
                </div>
              </section>

              {/* Abstención recuperable */}
              {a.abstencionOct25Recuperable > 0 && (
                <section>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3">● Abstención recuperable Oct 2025</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <KPICard title="Abstención recuperable" value={a.abstencionOct25Recuperable.toLocaleString("es-AR")} color="#f59e0b"
                      subtitle="no votaron + tienen contacto"
                      alert={a.abstencionOct25Recuperable > 200 ? "warn" : "ok"} />
                    <KPICard title="% del padrón" value={`${pct(a.abstencionOct25Recuperable, a.total)}%`} color="#8b5cf6"
                      subtitle="abstención con contacto" />
                    {a.cntCelular > 0 && (
                      <KPICard title="Con celular" value={`${a.pctCelular}%`} color="#0ea5e9"
                        subtitle={`${a.cntCelular.toLocaleString("es-AR")} contactables`} />
                    )}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="text-sm font-semibold text-amber-800 mb-1">Columnas de participación electoral no detectadas</p>
              <p className="text-xs text-amber-700">
                El padrón debe tener columnas con nombres exactos como &quot;2025 septiembre&quot;, &quot;2025 octubre&quot;, &quot;2023 PASO&quot;, etc. con valores VOTÓ / NO VOTÓ / SIN DATO.
                Columnas detectadas: {headers.slice(0, 15).join(", ")}{headers.length > 15 ? "…" : ""}
              </p>
            </div>
          )}

          {/* Participation analytics (uses cols.voto = Oct2025) */}
          {cols.voto >= 0 && (
            <>
              {/* KPIs principales */}
              <section>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Indicadores de participación real</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {a.pctParticipacion !== null && (
                    <>
                      <KPICard title="Participación real" value={`${a.pctParticipacion}%`} color="#10b981"
                        subtitle={`${a.votoSI.toLocaleString("es-AR")} votaron`} />
                      <KPICard title="Ausentismo" value={`${100 - a.pctParticipacion}%`} color="#ef4444"
                        subtitle={`${a.votoNO.toLocaleString("es-AR")} no votaron`} />
                    </>
                  )}
                  {a.fidelidadNucleo !== null && (
                    <KPICard title="Fidelidad núcleo duro" value={`${a.fidelidadNucleo}%`} color="#1e3a5f"
                      subtitle="del núcleo duro que votó" />
                  )}
                  {a.abstencionRecuperable > 0 && (
                    <KPICard title="Abstención recuperable" value={a.abstencionRecuperable.toLocaleString("es-AR")} color="#f59e0b"
                      subtitle="no votaron + tienen contacto" />
                  )}
                </div>
              </section>

              {/* Participación por segmento — tabla detallada */}
              {a.cruceSeg.some(s => s.known > 0) && (
                <section>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Participación real por segmento electoral</p>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-5 py-3">Segmento</th>
                          <th className="text-right px-4 py-3">Total padrón</th>
                          <th className="text-right px-4 py-3">Votaron</th>
                          <th className="text-right px-4 py-3">No votaron</th>
                          <th className="text-right px-4 py-3">% participación</th>
                          <th className="px-4 py-3 w-32"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {a.cruceSeg.map(s => (
                          <tr key={s.label} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-semibold" style={{ color: s.color }}>{s.label}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.total.toLocaleString("es-AR")}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-medium">{s.si.toLocaleString("es-AR")}</td>
                            <td className="px-4 py-3 text-right text-red-500">{s.no.toLocaleString("es-AR")}</td>
                            <td className="px-4 py-3 text-right font-bold" style={{ color: s.color }}>
                              {s.known > 0 ? `${s.pct}%` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Participación por edad */}
                {a.cruceEdad.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Participación por grupo etario (%)</p>
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
                      {a.cruceEdad.map(g => (
                        <div key={g.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{g.name}</span>
                            <span className="font-bold text-sky-600">{g.pct}%
                              <span className="text-xs text-gray-400 font-normal ml-2">
                                {g.si.toLocaleString("es-AR")} / {g.total.toLocaleString("es-AR")}
                              </span>
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${g.pct}%`, backgroundColor: g.pct >= 70 ? "#10b981" : g.pct >= 50 ? "#0ea5e9" : "#f59e0b" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Participación por sexo */}
                {a.cruceSexo.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Participación por sexo (%)</p>
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                      {a.cruceSexo.map(s => (
                        <div key={s.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{s.name}</span>
                            <span className="font-bold text-purple-600">{s.pct}%
                              <span className="text-xs text-gray-400 font-normal ml-2">
                                {s.si.toLocaleString("es-AR")} / {s.total.toLocaleString("es-AR")}
                              </span>
                            </span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-purple-400" style={{ width: `${s.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Ranking mesas por participación */}
              {a.mesaParticipacion.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Ranking de mesas por participación real</p>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto max-h-[420px]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-4 py-2.5">#</th>
                            <th className="text-left px-4 py-2.5">Mesa</th>
                            <th className="text-right px-4 py-2.5">Padrón</th>
                            <th className="text-right px-4 py-2.5">Votaron</th>
                            <th className="text-right px-4 py-2.5">Abstención</th>
                            <th className="text-right px-4 py-2.5">% Partic.</th>
                            <th className="px-4 py-2.5 w-24"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {a.mesaParticipacion.map((m, i) => (
                            <tr key={m.name} className={`hover:bg-gray-50 ${i < 3 ? "bg-green-50/40" : i >= a.mesaParticipacion.length - 3 ? "bg-red-50/40" : ""}`}>
                              <td className="px-4 py-2 text-gray-400 font-mono">{i + 1}</td>
                              <td className="px-4 py-2 font-semibold text-gray-700">{m.name}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{m.total.toLocaleString("es-AR")}</td>
                              <td className="px-4 py-2 text-right text-green-600 font-medium">{m.si.toLocaleString("es-AR")}</td>
                              <td className="px-4 py-2 text-right text-red-500">{m.no.toLocaleString("es-AR")}</td>
                              <td className="px-4 py-2 text-right font-bold" style={{ color: m.pct >= 70 ? "#10b981" : m.pct >= 50 ? "#f59e0b" : "#ef4444" }}>{m.pct}%</td>
                              <td className="px-4 py-2">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${m.pct}%`, backgroundColor: m.pct >= 70 ? "#10b981" : m.pct >= 50 ? "#f59e0b" : "#ef4444" }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {/* Exportes */}
              <section className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Exportables del cruce</p>
                <div className="flex flex-wrap gap-3">
                  <ExportBtn label="Abstención recuperable CSV" icon="⬇"
                    onClick={() => {
                      if (cols.voto < 0) return
                      const contactKeys = [cols.celular, cols.email, cols.domicilio].filter(i => i >= 0)
                      const filtered = rows.filter(r =>
                        normalizaVoto(r[cols.voto]) === false &&
                        contactKeys.some(i => hasContactValue(r[i]))
                      )
                      exportCSV(headers, filtered, "abstencion_recuperable.csv")
                    }}
                    color="purple"
                  />
                  <ExportBtn label="Núcleo duro que NO votó" icon="⬇"
                    onClick={() => {
                      if (cols.voto < 0) return
                      const filtered = rows.filter(r =>
                        segmentar(r, segCols) === "nucleoDuro" &&
                        normalizaVoto(r[cols.voto]) === false
                      )
                      exportCSV(headers, filtered, "nucleo_duro_abstencion.csv")
                    }}
                    color="sky"
                  />
                  <ExportBtn label="Padrón completo con voto" icon="⬇"
                    onClick={() => exportCSV(headers, rows, "padron_con_voto.csv")}
                    color="green"
                  />
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: MAPA                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "mapa" && (
        <div className="space-y-6">
          {(cols.lat < 0 || cols.lon < 0) ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
              <p className="font-semibold mb-1">Sin coordenadas geográficas</p>
              <p>El padrón no tiene columnas de latitud/longitud detectables. Para activar los mapas, el sheet debe tener columnas nombradas "lat", "latitud", "lon", "longitud" o similares con coordenadas decimales.</p>
            </div>
          ) : (
            <>
              <section>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">★ Mapas de electores georreferenciados</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.geoRows.toLocaleString("es-AR")} de {a.total.toLocaleString("es-AR")} electores tienen coordenadas ({pct(a.geoRows, a.total)}%)</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["electores", "participacion", "abstención", "contactabilidad"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMapMode(m)}
                        disabled={m === "participacion" && cols.voto < 0}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize disabled:opacity-30 disabled:cursor-not-allowed ${
                          mapMode === m
                            ? "bg-[#1e3a5f] text-white shadow"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {m === "electores" ? "Segmentos" :
                         m === "participacion" ? "Participación" :
                         m === "abstención" ? "Abstención" :
                         "Contactabilidad"}
                      </button>
                    ))}
                  </div>
                </div>

                {mapMode === "electores" && a.mapPointsElectores.length > 0 && (
                  <div className="space-y-4">
                    <ScatterMap
                      data={a.mapPointsElectores}
                      title="Distribución territorial por segmento electoral"
                      subtitle="Cada punto = un elector, coloreado por segmento"
                      badge="★ CORE"
                      colorMap={a.SEG_COLORS}
                      mode="scatter"
                    />
                    <ScatterMap
                      data={a.mapPointsElectores}
                      title="Mapa de calor — densidad de electores"
                      subtitle="Intensidad de color = concentración de electores"
                      badge="★ CORE"
                      mode="heat"
                    />
                  </div>
                )}

                {mapMode === "participacion" && a.mapPointsParticipacion.length > 0 && (
                  <div className="space-y-4">
                    <ScatterMap
                      data={a.mapPointsParticipacion}
                      title="Mapa de participación electoral"
                      subtitle="Verde = votó · Rojo = no votó · Gris = sin dato"
                      badge="★ CORE"
                      colorMap={{ "Votó": "#10b981", "No votó": "#ef4444", "Sin dato": "#cbd5e1" }}
                      mode="scatter"
                    />
                    {a.mapPointsAbstencion.length > 0 && (
                      <ScatterMap
                        data={a.mapPointsAbstencion}
                        title="Mapa de calor — abstención recuperable"
                        subtitle="Zonas donde hay no-votantes con datos de contacto disponibles"
                        badge="★ CORE"
                        mode="heat"
                      />
                    )}
                  </div>
                )}

                {mapMode === "abstención" && (
                  <div className="space-y-4">
                    {a.mapPointsAbstencion.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-2">
                          <KPICard title="Abstención recuperable" value={a.abstencionRecuperable.toLocaleString("es-AR")} color="#f59e0b"
                            subtitle="no votaron + tienen contacto"
                            alert={a.abstencionRecuperable > 200 ? "warn" : "ok"} />
                          <KPICard title="Con coordenadas" value={a.mapPointsAbstencion.length.toLocaleString("es-AR")} color="#0ea5e9"
                            subtitle="mapeables" />
                          <KPICard title="% del padrón" value={`${pct(a.abstencionRecuperable, a.total)}%`} color="#8b5cf6"
                            subtitle="abstención recuperable" />
                        </div>
                        <ScatterMap
                          data={a.mapPointsAbstencion}
                          title="Distribución territorial — abstención recuperable"
                          subtitle="No votaron pero tienen celular, email o domicilio conocido"
                          badge="★ CORE"
                          colorMap={{ "Abstención recuperable": "#f59e0b" }}
                          mode="scatter"
                        />
                        <ScatterMap
                          data={a.mapPointsAbstencion}
                          title="Mapa de calor — zonas críticas de abstención recuperable"
                          subtitle="Concentración territorial de votos a recuperar"
                          badge="★ CORE"
                          mode="heat"
                        />
                      </>
                    ) : (
                      <div className="bg-gray-50 rounded-2xl p-6 text-sm text-gray-500 text-center">
                        {cols.voto < 0
                          ? "Cargá el sheet de votos y cruzá los datos para ver la abstención recuperable."
                          : "No hay registros de abstención recuperable con coordenadas."}
                      </div>
                    )}
                  </div>
                )}

                {mapMode === "contactabilidad" && a.mapPointsContacto.length > 0 && (
                  <div className="space-y-4">
                    <ScatterMap
                      data={a.mapPointsContacto}
                      title="Mapa de contactabilidad territorial"
                      subtitle="Verde = digital (cel/email) · Azul = territorial (domicilio) · Rojo = sin contacto"
                      badge="★ CORE"
                      colorMap={{ "Digital": "#10b981", "Territorial": "#0ea5e9", "Sin contacto": "#ef4444" }}
                      mode="scatter"
                    />
                    <ScatterMap
                      data={a.mapPointsContacto.filter(p => p.colorKey === "Sin contacto")}
                      title="Mapa de calor — zonas sin contacto"
                      subtitle="Densidad de electores sin ningún dato de contacto disponible"
                      badge="● QUICK WIN"
                      mode="heat"
                    />
                  </div>
                )}

                {((mapMode === "electores" && !a.mapPointsElectores.length) ||
                  (mapMode === "participacion" && !a.mapPointsParticipacion.length) ||
                  (mapMode === "contactabilidad" && !a.mapPointsContacto.length)) && (
                  <div className="bg-gray-50 rounded-2xl p-8 text-center text-sm text-gray-400">
                    No hay electores con coordenadas geográficas en el filtro actual.
                  </div>
                )}
              </section>

              {filterCircuito && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-xs text-purple-700 font-medium">
                  Mostrando solo circuito: <strong>{filterCircuito}</strong> — {a.total.toLocaleString("es-AR")} electores
                </div>
              )}
            </>
          )}
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
