"use client"

import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  BarChart, Bar, Legend,
} from "recharts"
import KPICard from "@/components/charts/KPICard"
import GroupedBarChart from "@/components/charts/GroupedBarChart"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData } from "@/lib/sheets"
import { findCol, COL } from "@/lib/columnMatcher"
import { normalizaVoto, cleanValueCounts } from "@/lib/dataUtils"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

// ─── Static data from Plan Analítico Electoral ────────────────────────────────

type Tipo = "G" | "L" | "P" | "N"

interface Eleccion {
  label: string
  año: number
  tipo: Tipo
  padron: number
  pct_part: number
  pct_fp: number
  pct_op: number
  opositor: string
  resultado: string
  delta_fp: number | null
}

const ELECCIONES: Eleccion[] = [
  { label: "2001 G",  año: 2001, tipo: "G", padron: 8723,  pct_part: 79.43, pct_fp: 47.43, opositor: "UCR",       pct_op: 46.49, resultado: "Triunfo PJ por 0,94 pp",        delta_fp: null   },
  { label: "2003 G",  año: 2003, tipo: "G", padron: 8874,  pct_part: 79.91, pct_fp: 37.22, opositor: "UCR",       pct_op: 48.86, resultado: "Derrota",                        delta_fp: -10.21 },
  { label: "2005 L",  año: 2005, tipo: "L", padron: 8947,  pct_part: 76.98, pct_fp: 26.89, opositor: "UCR",       pct_op: 35.39, resultado: "Derrota",                        delta_fp: null   },
  { label: "2007 G",  año: 2007, tipo: "G", padron: 9154,  pct_part: 80.03, pct_fp: 40.93, opositor: "UCR",       pct_op: 46.31, resultado: "Derrota",                        delta_fp: 3.71   },
  { label: "2009 L",  año: 2009, tipo: "L", padron: 9225,  pct_part: 78.12, pct_fp: 19.20, opositor: "UCR",       pct_op: 35.28, resultado: "Derrota",                        delta_fp: null   },
  { label: "2011 G",  año: 2011, tipo: "G", padron: 9078,  pct_part: 82.23, pct_fp: 43.87, opositor: "UCR",       pct_op: 53.75, resultado: "Derrota",                        delta_fp: 2.94   },
  { label: "2013 L",  año: 2013, tipo: "L", padron: 9245,  pct_part: 84.27, pct_fp: 17.26, opositor: "UCR",       pct_op: 46.57, resultado: "Derrota",                        delta_fp: null   },
  { label: "2015 G",  año: 2015, tipo: "G", padron: 9500,  pct_part: 83.07, pct_fp: 28.74, opositor: "Cambiemos", pct_op: 57.69, resultado: "Derrota grande",                 delta_fp: -15.13 },
  { label: "2017 L",  año: 2017, tipo: "L", padron: 9871,  pct_part: 80.77, pct_fp: 21.96, opositor: "Cambiemos", pct_op: 44.56, resultado: "Derrota",                        delta_fp: null   },
  { label: "2019 G",  año: 2019, tipo: "G", padron: 10134, pct_part: 85.27, pct_fp: 49.71, opositor: "JxC",       pct_op: 50.29, resultado: "Casi triunfo (−0,58 pp)",        delta_fp: 20.97  },
  { label: "2021 L",  año: 2021, tipo: "L", padron: 10164, pct_part: 80.19, pct_fp: 38.72, opositor: "JxC",       pct_op: 48.87, resultado: "Derrota",                        delta_fp: null   },
  { label: "2023 G",  año: 2023, tipo: "G", padron: 10310, pct_part: 82.83, pct_fp: 34.81, opositor: "JxC",       pct_op: 47.40, resultado: "Derrota — Bozzano cabeza",       delta_fp: -14.90 },
  { label: "25-Sep",  año: 2025, tipo: "P", padron: 10312, pct_part: 70.03, pct_fp: 40.09, opositor: "SOMOS",     pct_op: 38.72, resultado: "★ TRIUNFO por 1,37 pp",          delta_fp: null   },
  { label: "25-Oct",  año: 2025, tipo: "N", padron: 10312, pct_part: 60.11, pct_fp: 33.38, opositor: "LLA",       pct_op: 46.41, resultado: "Derrota frente a LLA",           delta_fp: -6.71  },
]

const MESAS_PIVOTE = [
  { mesa: "Mesa 8",  fp_sep: 102, fp_oct: 59, delta_fp: -43, lla_sep: 52,  lla_oct: 93,  delta_lla: 41, tipo: "Migración"        },
  { mesa: "Mesa 27", fp_sep: 93,  fp_oct: 54, delta_fp: -39, lla_sep: 39,  lla_oct: 79,  delta_lla: 40, tipo: "Migración"        },
  { mesa: "Mesa 18", fp_sep: 92,  fp_oct: 54, delta_fp: -38, lla_sep: 48,  lla_oct: 82,  delta_lla: 34, tipo: "Mixto"            },
  { mesa: "Mesa 24", fp_sep: 109, fp_oct: 72, delta_fp: -37, lla_sep: 47,  lla_oct: 93,  delta_lla: 46, tipo: "Migración"        },
  { mesa: "Mesa 25", fp_sep: 99,  fp_oct: 64, delta_fp: -35, lla_sep: 53,  lla_oct: 101, delta_lla: 48, tipo: "Migración"        },
  { mesa: "Mesa 10", fp_sep: 99,  fp_oct: 64, delta_fp: -35, lla_sep: 36,  lla_oct: 87,  delta_lla: 51, tipo: "Migración"        },
  { mesa: "Mesa 7",  fp_sep: 103, fp_oct: 70, delta_fp: -33, lla_sep: 46,  lla_oct: 101, delta_lla: 55, tipo: "Migración fuerte" },
  { mesa: "Mesa 4",  fp_sep: 109, fp_oct: 77, delta_fp: -32, lla_sep: 35,  lla_oct: 93,  delta_lla: 58, tipo: "Migración fuerte" },
  { mesa: "Mesa 14", fp_sep: 90,  fp_oct: 60, delta_fp: -30, lla_sep: 51,  lla_oct: 99,  delta_lla: 48, tipo: "Migración"        },
  { mesa: "Mesa 9",  fp_sep: 95,  fp_oct: 66, delta_fp: -29, lla_sep: 43,  lla_oct: 80,  delta_lla: 37, tipo: "Migración"        },
]

const TIPO_COLOR: Record<Tipo, string> = {
  G: "#5b50e6",
  L: "#e0921a",
  P: "#0f9b8e",
  N: "#d6456a",
}

const TIPO_LABEL: Record<Tipo, string> = {
  G: "Generales",
  L: "Legislativas",
  P: "Provinciales",
  N: "Nacionales",
}

// Custom tooltip for historical chart
function EleccionTooltip({ active, payload }: { active?: boolean; payload?: Array<{payload: Eleccion}> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Eleccion
  return (
    <div className="bg-surface border border-hairline rounded-md p-3 shadow-lg text-xs max-w-[220px]">
      <p className="font-bold text-ink mb-1">{d.label} — {TIPO_LABEL[d.tipo]}</p>
      <p className="text-[#5b50e6] font-semibold">FP: {d.pct_fp}%</p>
      <p className="text-ink-2">Opositor ({d.opositor}): {d.pct_op}%</p>
      <p className="text-ink-2">Participación: {d.pct_part}%</p>
      {d.delta_fp !== null && (
        <p className={d.delta_fp >= 0 ? "text-success" : "text-danger"}>
          Δ vs ant. mismo tipo: {d.delta_fp > 0 ? "+" : ""}{d.delta_fp} pp
        </p>
      )}
      <p className="text-ink-3 mt-1 leading-tight">{d.resultado}</p>
    </div>
  )
}

// Avg % FP
const avgFpGenerales = +(ELECCIONES.filter(e => e.tipo === "G").reduce((s, e) => s + e.pct_fp, 0) / ELECCIONES.filter(e => e.tipo === "G").length).toFixed(1)
const avgFpLegislativas = +(ELECCIONES.filter(e => e.tipo === "L").reduce((s, e) => s + e.pct_fp, 0) / ELECCIONES.filter(e => e.tipo === "L").length).toFixed(1)

// Participación Maipú vs 5ta
const PARTICIPACION_COMP = [
  { name: "Maipú Sep", maipú: 70.03, sección5: 61.9 },
  { name: "Maipú Oct", maipú: 60.11, sección5: 65.6 },
]

const DELTA_RANKING = [
  { name: "Gral. Lavalle",   value: -1.50 },
  { name: "Pellegrini",      value: -2.38 },
  { name: "Gral. Alvear",    value: -1.94 },
  { name: "Tres Lomas",      value: -1.89 },
  { name: "Media 5ta",       value: 3.71  },
  { name: "Maipú",           value: -9.84 },
].sort((a, b) => a.value - b.value)

// Mesa chart data
const mesasChartFP = MESAS_PIVOTE.map(m => ({
  name: m.mesa.replace("Mesa ", "M"),
  Sep: m.fp_sep,
  Oct: m.fp_oct,
}))

const mesasChartLLA = MESAS_PIVOTE.map(m => ({
  name: m.mesa.replace("Mesa ", "M"),
  Sep: m.lla_sep,
  Oct: m.lla_oct,
}))

export default function ElectoralContent({ votoSheetId }: { votoSheetId?: string }) {
  const { accessToken } = useAuth()
  const [votoHeaders, setVotoHeaders] = useState<string[]>([])
  const [votoRows, setVotoRows]       = useState<(string | number | null)[][]>([])
  const [votoLoading, setVotoLoading] = useState(false)

  const loadVoto = useCallback(async () => {
    if (!accessToken || !votoSheetId) return
    try {
      setVotoLoading(true)
      const d = await fetchSheetData(votoSheetId, "A:ZZ", accessToken)
      setVotoHeaders(d.headers); setVotoRows(d.rows)
    } catch { /* silently ignore */ }
    finally { setVotoLoading(false) }
  }, [votoSheetId, accessToken])

  useEffect(() => { loadVoto() }, [loadVoto])

  const votoAnalytics = useMemo(() => {
    if (!votoRows.length) return null
    const iVoto = findCol(votoHeaders, COL.voto)
    const iMesa = findCol(votoHeaders, COL.mesa)
    const iCirc = findCol(votoHeaders, COL.circuito)
    if (iVoto < 0) return null

    const total = votoRows.length
    const si  = votoRows.filter(r => normalizaVoto(r[iVoto]) === true).length
    const no  = votoRows.filter(r => normalizaVoto(r[iVoto]) === false).length
    const known = si + no
    const pct   = known > 0 ? Math.round(si / known * 100) : 0

    const byMesa: { name: string; value: number }[] = []
    if (iMesa >= 0) {
      for (const { name } of cleanValueCounts(votoRows, iMesa, 32)) {
        const sub   = votoRows.filter(r => String(r[iMesa] ?? "").trim() === String(name))
        const s     = sub.filter(r => normalizaVoto(r[iVoto]) === true).length
        const k     = sub.filter(r => normalizaVoto(r[iVoto]) !== null).length
        if (k > 0) byMesa.push({ name: `Mesa ${name}`, value: Math.round(s / k * 100) })
      }
      byMesa.sort((a, b) => b.value - a.value)
    }

    const byCirc: { name: string; value: number }[] = []
    if (iCirc >= 0) {
      for (const { name } of cleanValueCounts(votoRows, iCirc, 20)) {
        const sub   = votoRows.filter(r => String(r[iCirc] ?? "").trim() === String(name))
        const s     = sub.filter(r => normalizaVoto(r[iVoto]) === true).length
        const k     = sub.filter(r => normalizaVoto(r[iVoto]) !== null).length
        if (k > 0) byCirc.push({ name: String(name), value: Math.round(s / k * 100) })
      }
      byCirc.sort((a, b) => b.value - a.value)
    }

    return { total, si, no, known, pct, byMesa, byCirc }
  }, [votoHeaders, votoRows])

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Análisis Electoral — Maipú</h1>
          <p className="text-ink-3 text-sm mt-0.5">Serie 2001–2025 · 14 elecciones · 32 mesas</p>
          <p className="text-xs text-ink-3 mt-1">Fuente: Resultados Maipú Histórico, Comparativo Sep-Oct 2025, Análisis 5ta Sección</p>
        </div>
      </div>

      {/* ★ KPIs Cabecera */}
      <section>
        <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Estado actual del escenario</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title="Línea base 2027" value="40,09 %" color="#0f9b8e" subtitle="Provinciales Sep 2025" />
          <KPICard title="Última nacional" value="33,38 %" color="#e0921a" subtitle="↓ 6,71 pp vs Sep 2025" />
          <KPICard title="Pico histórico" value="49,71 %" color="#5b6472" subtitle="2019 Generales" />
          <KPICard title="Δ Participación Sep→Oct" value="−9,84 pp" color="#d6456a" subtitle="Outlier 5ta Sección" />
          <KPICard title="Votos a recuperar" value="800" color="#e0921a" subtitle="desafectados Oct 2025" />
          <KPICard title="Padrón habilitado" value="10.312" color="#3c9bd6" subtitle="electores 2025" />
        </div>
      </section>

      {/* ★ Serie histórica % FP */}
      <section>
        <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Serie histórica % FP (2001–2025)</p>
        <div className="bg-surface rounded-md p-6 border border-hairline">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3 className="text-sm font-semibold text-ink">% Fuerza Patria / PJ por elección</h3>
            <div className="flex flex-wrap gap-3 text-[10px]">
              {(Object.keys(TIPO_COLOR) as Tipo[]).map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: TIPO_COLOR[t] }} />
                  {TIPO_LABEL[t]}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={ELECCIONES} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5b6472" }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 60]} tick={{ fontSize: 11, fill: "#5b6472" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip content={<EleccionTooltip />} />
              <ReferenceLine y={50} stroke="#0f9b8e" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "50%", position: "right", fontSize: 10, fill: "#0f9b8e" }} />
              <ReferenceLine y={40} stroke="#e0921a" strokeDasharray="4 2" strokeWidth={1} label={{ value: "40%", position: "right", fontSize: 10, fill: "#e0921a" }} />
              <ReferenceLine y={avgFpGenerales} stroke="#5b50e6" strokeDasharray="2 4" strokeWidth={1} label={{ value: `Prom.G ${avgFpGenerales}%`, position: "right", fontSize: 9, fill: "#5b50e6" }} />
              <Line
                type="monotone"
                dataKey="pct_fp"
                stroke="#8f897e"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls
              />
              <Scatter
                dataKey="pct_fp"
                shape={(props: {cx?: number; cy?: number; payload?: Eleccion}) => {
                  const { cx = 0, cy = 0, payload } = props
                  if (!payload) return <circle cx={cx} cy={cy} r={0} />
                  const color = TIPO_COLOR[payload.tipo]
                  const isPeak = payload.pct_fp >= 40
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={isPeak ? 7 : 5} fill={color} stroke="white" strokeWidth={2} />
                      {payload.pct_fp >= 40 && (
                        <text x={cx} y={cy - 11} textAnchor="middle" fontSize={9} fill={color} fontWeight="700">
                          {payload.pct_fp}%
                        </text>
                      )}
                    </g>
                  )
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-3 border-t border-hairline pt-3">
            <span>Prom. Generales: <strong className="text-ink-2">{avgFpGenerales}%</strong></span>
            <span>Prom. Legislativas: <strong className="text-ink-2">{avgFpLegislativas}%</strong></span>
            <span>Puntos marcados = elecciones sobre 40%</span>
          </div>
        </div>
      </section>

      {/* ★ Top 10 mesas pivote */}
      <section>
        <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Top 10 mesas pivote Sep→Oct 2025</p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* FP chart */}
          <GroupedBarChart
            data={mesasChartFP}
            series={[
              { key: "Sep", label: "FP Sep 2025", color: "#0f9b8e" },
              { key: "Oct", label: "FP Oct 2025", color: "#d6456a" },
            ]}
            title="★ Votos FP por mesa — Sep vs Oct 2025"
            subtitle="Mesas con mayor caída de votos propios"
            badge="★ CORE"
          />
          {/* LLA chart */}
          <GroupedBarChart
            data={mesasChartLLA}
            series={[
              { key: "Sep", label: "LLA Sep 2025", color: "#e0921a" },
              { key: "Oct", label: "LLA Oct 2025", color: "#5b50e6" },
            ]}
            title="★ Votos LLA por mesa — Sep vs Oct 2025"
            subtitle="Crecimiento de LLA en las mismas mesas"
            badge="★ CORE"
          />
        </div>

        {/* Mesa table */}
        <div className="bg-surface rounded-md border border-hairline overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-hairline">
            <h3 className="text-sm font-semibold text-ink">Detalle — Top 10 mesas pivote</h3>
            <p className="text-xs text-ink-3 mt-0.5">Ordenadas por mayor caída de votos FP entre Sep y Oct 2025</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-panel text-ink-2 text-left">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Mesa</th>
                  <th className="px-4 py-3 font-medium text-right">FP Sep</th>
                  <th className="px-4 py-3 font-medium text-right">FP Oct</th>
                  <th className="px-4 py-3 font-medium text-right text-danger">Δ FP</th>
                  <th className="px-4 py-3 font-medium text-right">LLA Sep</th>
                  <th className="px-4 py-3 font-medium text-right">LLA Oct</th>
                  <th className="px-4 py-3 font-medium text-right text-accent">Δ LLA</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {MESAS_PIVOTE.map((m, i) => (
                  <tr key={m.mesa} className="border-t border-hairline hover:bg-panel/50 transition-colors">
                    <td className="px-4 py-3 text-ink-3">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-ink">{m.mesa}</td>
                    <td className="px-4 py-3 text-right text-success">{m.fp_sep}</td>
                    <td className="px-4 py-3 text-right text-danger">{m.fp_oct}</td>
                    <td className="px-4 py-3 text-right font-bold text-danger">{m.delta_fp}</td>
                    <td className="px-4 py-3 text-right text-warn">{m.lla_sep}</td>
                    <td className="px-4 py-3 text-right text-accent">{m.lla_oct}</td>
                    <td className="px-4 py-3 text-right font-semibold text-accent">+{m.delta_lla}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        m.tipo === "Migración fuerte"
                          ? "bg-danger-tint text-danger"
                          : m.tipo === "Migración"
                          ? "bg-warn-tint text-warn"
                          : "bg-warn-tint text-warn"
                      }`}>{m.tipo}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ● Outlier 5ta Sección */}
      <section>
        <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">● Quick Win — Maipú como outlier de la 5ta Sección</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KPI cards */}
          <div className="space-y-4">
            <div className="bg-danger-tint border border-hairline rounded-md p-5">
              <p className="text-xs font-bold text-danger uppercase tracking-wider mb-3">Alerta — Caída singular de participación</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-2">Δ Sep→Oct Maipú</p>
                  <p className="text-2xl font-bold text-danger">−9,84 pp</p>
                </div>
                <div>
                  <p className="text-xs text-ink-2">Δ Sep→Oct media 5ta</p>
                  <p className="text-2xl font-bold text-success">+3,71 pp</p>
                </div>
                <div>
                  <p className="text-xs text-ink-2">Diferencial Maipú vs 5ta</p>
                  <p className="text-xl font-bold text-danger">−13,55 pp</p>
                </div>
                <div>
                  <p className="text-xs text-ink-2">Ranking caída</p>
                  <p className="text-xl font-bold text-danger">1° de 14</p>
                  <p className="text-xs text-ink-3">peor de la sección</p>
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-md p-5 border border-hairline space-y-3">
              <p className="text-xs font-semibold text-ink">Participación Maipú vs 5ta Sección</p>
              <div className="space-y-2">
                {[
                  { label: "Sep 2025 — Maipú", val: 70.03, color: "#0f9b8e" },
                  { label: "Sep 2025 — Media 5ta", val: 61.9, color: "#5b6472" },
                  { label: "Oct 2025 — Maipú", val: 60.11, color: "#d6456a" },
                  { label: "Oct 2025 — Media 5ta", val: 65.6, color: "#5b6472" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-ink-2">{item.label}</span>
                      <span className="font-semibold" style={{ color: item.color }}>{item.val}%</span>
                    </div>
                    <div className="h-2 bg-panel rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.val}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ranking distritos */}
          <div className="bg-surface rounded-md p-6 border border-hairline">
            <h3 className="text-sm font-semibold text-ink mb-1">Δ Participación Sep→Oct 2025 por distrito</h3>
            <p className="text-xs text-ink-3 mb-5">Distritos que cayeron vs media 5ta</p>
            <div className="space-y-2.5">
              {DELTA_RANKING.map(d => (
                <div key={d.name}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={`font-medium ${d.name === "Maipú" ? "text-danger" : d.name === "Media 5ta" ? "text-success" : "text-ink-2"}`}>
                      {d.name}
                      {d.name === "Maipú" && <span className="ml-1.5 text-[9px] bg-danger-tint text-danger px-1.5 py-0.5 rounded-full">OUTLIER</span>}
                    </span>
                    <span className={`font-bold ${d.value < 0 ? "text-danger" : "text-success"}`}>
                      {d.value > 0 ? "+" : ""}{d.value} pp
                    </span>
                  </div>
                  <div className="h-2 bg-panel rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.abs(d.value) / 10 * 100}%`,
                        backgroundColor: d.value < 0 ? (d.name === "Maipú" ? "#d6456a" : "#e0921a") : "#0f9b8e",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ◆ Tendencias largo plazo */}
      <section>
        <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">◆ Avanzado — Tendencias largo plazo (2001–2025)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <KPICard title="Prom. % FP Generales" value={`${avgFpGenerales}%`} color="#5b50e6" subtitle="2003–2023" />
          <KPICard title="Prom. % FP Legislativas" value={`${avgFpLegislativas}%`} color="#e0921a" subtitle="2005–2021" />
          <KPICard title="Volatilidad (σ) 2015–2025" value="≈ 9 pp" color="#5b50e6" subtitle="Alta variabilidad" />
          <KPICard title="Participación prom. 2001–2023" value="80,9%" color="#3c9bd6" subtitle="vs 65,1% en 2025" />
          <KPICard title="Caída votos válidos 2023→Oct25" value="−2.283" color="#d6456a" subtitle="8.130 → 5.847 votos" />
          <KPICard title="Tendencia UCR/SOMOS" value="−18,97 pp" color="#5b6472" subtitle="de 57,69% (2015) a 38,72% (2025)" />
          <KPICard title="SOMOS en nacionales Oct 25" value="0%" color="#5b6472" subtitle="Ausencia de oferta" />
          <KPICard title="Brecha G vs L (FP)" value="+8 pp" color="#0f9b8e" subtitle="Generales siempre más altas" />
        </div>

        {/* Participación histórica */}
        <div className="bg-surface rounded-md p-6 border border-hairline">
          <h3 className="text-sm font-semibold text-ink mb-5">% Participación por elección — Maipú 2001–2025</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ELECCIONES} margin={{ top: 4, right: 12, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5b6472" }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#5b6472" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, "Participación"]}
              />
              <ReferenceLine y={80.9} stroke="#3c9bd6" strokeDasharray="4 2" label={{ value: "Prom. histórico 80,9%", position: "right", fontSize: 9, fill: "#3c9bd6" }} />
              <Bar dataKey="pct_part" radius={[3, 3, 0, 0]}>
                {ELECCIONES.map((e, i) => (
                  <Cell key={i} fill={
                    e.pct_part < 65 ? "#d6456a" : e.pct_part < 75 ? "#e0921a" : "#3c9bd6"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-ink-3 mt-3">Rojo = participación baja (&lt;65%) · Amarillo = media (&lt;75%) · Azul = alta (≥75%)</p>
        </div>
      </section>

      {/* ★ Tabla maestra de elecciones */}
      <section>
        <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Tabla maestra de elecciones 2001–2025</p>
        <div className="bg-surface rounded-md border border-hairline overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-panel text-ink-2 text-left">
                  <th className="px-4 py-3 font-medium">Año</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right">Padrón</th>
                  <th className="px-4 py-3 font-medium text-right">% Part.</th>
                  <th className="px-4 py-3 font-medium text-right text-[#5b50e6]">% FP</th>
                  <th className="px-4 py-3 font-medium text-right">% Opositor</th>
                  <th className="px-4 py-3 font-medium">Principal opositor</th>
                  <th className="px-4 py-3 font-medium text-right">Δ FP vs ant.</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {ELECCIONES.map((e, i) => (
                  <tr key={i} className={`border-t border-hairline hover:bg-panel/50 transition-colors ${
                    e.pct_fp >= 40 ? "bg-success-tint/30" : ""
                  }`}>
                    <td className="px-4 py-3 font-bold text-ink">{e.label}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                        backgroundColor: TIPO_COLOR[e.tipo] + "22",
                        color: TIPO_COLOR[e.tipo],
                      }}>
                        {TIPO_LABEL[e.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">{e.padron.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-right text-ink-2">{e.pct_part}%</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: TIPO_COLOR[e.tipo] }}>{e.pct_fp}%</td>
                    <td className="px-4 py-3 text-right text-ink-2">{e.pct_op}%</td>
                    <td className="px-4 py-3 text-ink-2">{e.opositor}</td>
                    <td className="px-4 py-3 text-right">
                      {e.delta_fp !== null ? (
                        <span className={`font-semibold ${e.delta_fp >= 0 ? "text-success" : "text-danger"}`}>
                          {e.delta_fp > 0 ? "+" : ""}{e.delta_fp} pp
                        </span>
                      ) : <span className="text-ink-4">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-2 max-w-[180px]">{e.resultado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Participación real del padrón */}
      {votoSheetId && (
        <section>
          <p className="text-xs font-semibold text-success uppercase tracking-wider mb-3">★ Participación real del padrón — datos vivos</p>
          {votoLoading && <LoadingSpinner label="Cargando datos de participación..." />}
          {!votoLoading && !votoAnalytics && (
            <div className="bg-warn-tint border border-hairline rounded-md p-5 text-sm text-warn">
              No se detectó columna de voto en el sheet. Verificá que tenga una columna con "voto", "participó", "asistió" o similar.
            </div>
          )}
          {!votoLoading && votoAnalytics && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KPICard title="Participación real" value={`${votoAnalytics.pct}%`} color="#0f9b8e" subtitle={`${votoAnalytics.si.toLocaleString("es-AR")} votaron`} />
                <KPICard title="Ausentismo" value={`${100 - votoAnalytics.pct}%`} color="#d6456a" subtitle={`${votoAnalytics.no.toLocaleString("es-AR")} no votaron`} />
                <KPICard title="Total con dato" value={votoAnalytics.known.toLocaleString("es-AR")} color="#5b6472" />
                <KPICard title="Total registros" value={votoAnalytics.total.toLocaleString("es-AR")} color="#3c9bd6" />
              </div>

              {votoAnalytics.byCirc.length > 0 && (
                <div className="bg-surface rounded-md p-5 border border-hairline ">
                  <h3 className="text-sm font-semibold text-ink mb-4">Participación por circuito (%)</h3>
                  <div className="space-y-2">
                    {votoAnalytics.byCirc.map(c => (
                      <div key={c.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-ink-2">{c.name}</span>
                          <span className={`font-bold ${c.value >= 70 ? "text-success" : c.value >= 50 ? "text-warn" : "text-danger"}`}>{c.value}%</span>
                        </div>
                        <div className="h-2 bg-panel rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.value}%`, backgroundColor: c.value >= 70 ? "#0f9b8e" : c.value >= 50 ? "#e0921a" : "#d6456a" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {votoAnalytics.byMesa.length > 0 && (
                <div className="bg-surface rounded-md p-5 border border-hairline ">
                  <h3 className="text-sm font-semibold text-ink mb-4">Participación por mesa (%) — top {votoAnalytics.byMesa.length}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
                    {votoAnalytics.byMesa.map(m => (
                      <div key={m.name} className="flex items-center justify-between bg-panel rounded-md px-3 py-2 text-xs">
                        <span className="text-ink-2 font-medium">{m.name}</span>
                        <span className={`font-bold ${m.value >= 70 ? "text-success" : m.value >= 50 ? "text-warn" : "text-danger"}`}>{m.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Info derivados */}
      <section className="bg-accent-tint border border-hairline rounded-md p-5">
        <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2">◆ Avanzado — Indicadores derivados (requieren cruce con relevamiento)</p>
        <p className="text-sm text-accent mb-3">Los indicadores D1–D10 (gap de inteligencia, score de prioridad de mesa, cruce voto × diagnóstico territorial) se activan cuando el relevamiento tenga ≥ 30 encuestas por mesa.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-accent">
          <div className="bg-surface/60 rounded-md p-3">
            <p className="font-semibold mb-1">D3 — Gap de inteligencia</p>
            <p className="text-accent">% SI en P26 (encuesta) − % FP real (mesa). Disponible cuando n ≥ 30 por mesa.</p>
          </div>
          <div className="bg-surface/60 rounded-md p-3">
            <p className="font-semibold mb-1">D5 — Score de prioridad</p>
            <p className="text-accent">Δ FP Sep→Oct normalizado × % NS-NC encuesta × (1 / cobertura JP). Ranking de 32 mesas.</p>
          </div>
          <div className="bg-surface/60 rounded-md p-3">
            <p className="font-semibold mb-1">D8–D10 — Cruce territorial</p>
            <p className="text-accent">% FP histórico × problema declarado / tenencia vivienda / servicios. Calibra mensajes por zona.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
