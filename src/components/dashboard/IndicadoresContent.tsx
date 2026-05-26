"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import { timeSeries } from "@/lib/columnMatcher"
import type { SheetTab } from "@/types"
import KPICard from "@/components/charts/KPICard"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import PieChartComponent from "@/components/charts/PieChartComponent"
import BarChartComponent from "@/components/charts/BarChartComponent"
import LineChartComponent from "@/components/charts/LineChartComponent"
import StackedBarChart from "@/components/charts/StackedBarChart"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]
type ColType = "number" | "date" | "category" | "text" | "id"

interface ColInfo {
  idx: number
  name: string
  type: ColType
  uniqueCount: number
  nonNullCount: number
  sum: number
  avg: number
  min: number
  max: number
  samples: string[]
}

interface TabData {
  tab: SheetTab
  headers: string[]
  rows: Row[]
  cols: ColInfo[]
}

interface Props { sheetId: string }

// ─── Column type detection ────────────────────────────────────────────────────

const DATE_RE = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$|^\d{4}$|^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i
const ID_RE   = /\b(id|cod|código|numero|número|dni|legajo|cuit)\b/i

function analyzeCol(headers: string[], rows: Row[], idx: number): ColInfo {
  const name = headers[idx] ?? ""
  const vals = rows.map(r => r[idx]).filter(v => v !== null && v !== "" && v !== undefined)
  const nonNullCount = vals.length
  const unique = new Set(vals.map(v => String(v).trim()))
  const uniqueCount = unique.size

  // id-like column
  if (ID_RE.test(name) || uniqueCount === nonNullCount) {
    return { idx, name, type: "id", uniqueCount, nonNullCount, sum: 0, avg: 0, min: 0, max: 0, samples: [] }
  }

  // numbers
  const nums = vals.map(v => Number(v)).filter(n => !isNaN(n))
  const numRatio = nums.length / Math.max(nonNullCount, 1)
  if (numRatio > 0.8 && nums.length > 0) {
    const sum = nums.reduce((a, b) => a + b, 0)
    return {
      idx, name, type: "number", uniqueCount, nonNullCount,
      sum, avg: sum / nums.length,
      min: Math.min(...nums), max: Math.max(...nums),
      samples: [],
    }
  }

  // dates
  const strVals = vals.map(v => String(v).trim())
  const dateRatio = strVals.filter(v => DATE_RE.test(v)).length / Math.max(nonNullCount, 1)
  if (dateRatio > 0.6) {
    return { idx, name, type: "date", uniqueCount, nonNullCount, sum: 0, avg: 0, min: 0, max: 0, samples: [...unique].slice(0, 5) }
  }

  // category
  const catRatio = uniqueCount / Math.max(nonNullCount, 1)
  if (uniqueCount <= 40 || catRatio < 0.25) {
    return { idx, name, type: "category", uniqueCount, nonNullCount, sum: 0, avg: 0, min: 0, max: 0, samples: [...unique].slice(0, 5) }
  }

  return { idx, name, type: "text", uniqueCount, nonNullCount, sum: 0, avg: 0, min: 0, max: 0, samples: [] }
}

// ─── Data aggregation helpers ─────────────────────────────────────────────────

function groupSum(rows: Row[], groupIdx: number, valueIdx: number, max = 20): { name: string; value: number }[] {
  const agg: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[groupIdx] ?? "Sin dato").trim() || "Sin dato"
    agg[k] = (agg[k] ?? 0) + (Number(r[valueIdx]) || 0)
  }
  return Object.entries(agg)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
}

function valueCounts(rows: Row[], idx: number, max = 20): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[idx] ?? "Sin dato").trim() || "Sin dato"
    counts[k] = (counts[k] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
}

function crossTab(rows: Row[], gIdx: number, cIdx: number) {
  const groups: Record<string, Record<string, number>> = {}
  const cats = new Set<string>()
  for (const r of rows) {
    const g = String(r[gIdx] ?? "Sin dato").trim() || "Sin dato"
    const c = String(r[cIdx] ?? "Sin dato").trim() || "Sin dato"
    groups[g] ??= {}
    groups[g][c] = (groups[g][c] ?? 0) + 1
    cats.add(c)
  }
  return {
    data: Object.entries(groups).map(([name, cs]) => ({
      name,
      ...Object.fromEntries([...cats].map(c => [c, cs[c] ?? 0])),
    })),
    keys: [...cats],
  }
}

// ─── Widget generation ────────────────────────────────────────────────────────

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return n.toLocaleString("es-AR")
  return (Math.round(n * 100) / 100).toLocaleString("es-AR")
}

const PALETTE = ["#5b50e6", "#3c9bd6", "#0f9b8e", "#e0921a", "#5b50e6", "#d6456a", "#c0497f", "#3c9bd6"]

interface Widget {
  id: string
  type: "kpi-group" | "pie" | "hbar" | "bar" | "line" | "stacked" | "hbar-sum" | "number-table"
  title: string
  subtitle?: string
  data: unknown
  extra?: unknown
}

function generateWidgets(td: TabData): Widget[] {
  const { headers, rows, cols } = td
  const widgets: Widget[] = []
  const used = new Set<number>()

  const numCols    = cols.filter(c => c.type === "number")
  const catCols    = cols.filter(c => c.type === "category")
  const dateCols   = cols.filter(c => c.type === "date")

  // 1. KPI group for numeric columns
  if (numCols.length > 0) {
    const kpis = numCols.slice(0, 6).map((c, i) => ({
      title: c.name,
      value: fmt(c.sum),
      color: PALETTE[i % PALETTE.length],
      subtitle: `prom: ${fmt(c.avg)} · máx: ${fmt(c.max)}`,
    }))
    widgets.push({ id: "kpis", type: "kpi-group", title: "Indicadores numéricos", data: kpis })
    numCols.slice(0, 6).forEach(c => used.add(c.idx))
  }

  // 2. Category × Numeric → horizontal bar with sum (top combos)
  for (const cat of catCols.slice(0, 3)) {
    for (const num of numCols.slice(0, 2)) {
      if (used.has(cat.idx) && used.has(num.idx)) continue
      const data = groupSum(rows, cat.idx, num.idx, 20)
      if (data.length < 2) continue
      const total = data.reduce((s, d) => s + d.value, 0)
      widgets.push({
        id: `hbar-${cat.idx}-${num.idx}`,
        type: "hbar-sum",
        title: `${num.name} por ${cat.name}`,
        subtitle: `Total: ${fmt(total)}`,
        data,
        extra: { total },
      })
      used.add(cat.idx); used.add(num.idx)
      break
    }
  }

  // 3. Categorical distributions (pie for ≤8 unique, hbar for larger)
  for (const cat of catCols) {
    if (used.has(cat.idx)) continue
    const data = valueCounts(rows, cat.idx, 20)
    if (data.length < 2) continue
    if (cat.uniqueCount <= 8) {
      widgets.push({
        id: `pie-${cat.idx}`,
        type: "pie",
        title: `Distribución — ${cat.name}`,
        data,
        extra: { total: rows.length },
      })
    } else {
      widgets.push({
        id: `hbar-${cat.idx}`,
        type: "hbar",
        title: `${cat.name} — distribución`,
        data,
        extra: { total: rows.length },
      })
    }
    used.add(cat.idx)
  }

  // 4. Date × count → line chart
  for (const dc of dateCols.slice(0, 1)) {
    const data = timeSeries(rows, dc.idx)
    if (data.length > 1) {
      widgets.push({
        id: `line-${dc.idx}`,
        type: "line",
        title: `Evolución por ${dc.name}`,
        data,
      })
      used.add(dc.idx)
    }
  }

  // 5. Two categorical cols → stacked bar
  const unusedCats = catCols.filter(c => !used.has(c.idx))
  if (unusedCats.length >= 2) {
    const [g, c] = unusedCats
    const { data, keys } = crossTab(rows, g.idx, c.idx)
    if (data.length > 1 && keys.length > 1 && keys.length <= 10) {
      widgets.push({
        id: `stacked-${g.idx}-${c.idx}`,
        type: "stacked",
        title: `${g.name} × ${c.name}`,
        data,
        extra: { keys },
      })
    }
  }

  // 6. If only text/id columns: show row counts by first reasonable col
  if (widgets.length === 0 && cols.length > 0) {
    const first = cols.find(c => c.type !== "id")
    if (first) {
      const data = valueCounts(rows, first.idx, 20)
      widgets.push({ id: "fallback", type: "hbar", title: `Distribución — ${first.name}`, data, extra: { total: rows.length } })
    }
  }

  return widgets
}

// ─── Widget renderer ──────────────────────────────────────────────────────────

function RenderWidget({ w, total }: { w: Widget; total: number }) {
  if (w.type === "kpi-group") {
    const kpis = w.data as { title: string; value: string; color: string; subtitle: string }[]
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k, i) => (
          <KPICard key={i} title={k.title} value={k.value} color={k.color} subtitle={k.subtitle} />
        ))}
      </div>
    )
  }
  if (w.type === "pie") {
    return (
      <PieChartComponent
        data={w.data as {name: string; value: number}[]}
        dataKey="value" nameKey="name" title={w.title}
      />
    )
  }
  if (w.type === "hbar" || w.type === "hbar-sum") {
    const t = (w.extra as {total?: number})?.total ?? total
    return (
      <HorizontalBarChart
        data={w.data as {name: string; value: number}[]}
        title={w.title}
        subtitle={w.subtitle}
        total={t}
      />
    )
  }
  if (w.type === "bar") {
    return (
      <BarChartComponent
        data={w.data as Record<string, unknown>[]}
        dataKey="value" nameKey="name"
        color="#3c9bd6" title={w.title}
        total={total}
      />
    )
  }
  if (w.type === "line") {
    return (
      <LineChartComponent
        data={w.data as Record<string, unknown>[]}
        dataKey="value" nameKey="name"
        color="#3c9bd6" title={w.title}
      />
    )
  }
  if (w.type === "stacked") {
    const { keys } = w.extra as { keys: string[] }
    return (
      <StackedBarChart
        data={w.data as Record<string, unknown>[]}
        keys={keys} title={w.title}
        subtitle={w.subtitle}
      />
    )
  }
  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IndicadoresContent({ sheetId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tabs, setTabs]         = useState<TabData[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)
      const sheetTabs = await fetchSheetTabs(sheetId, accessToken)
      if (!sheetTabs.length) throw new Error("No se encontraron pestañas en el sheet")

      const results = await Promise.all(
        sheetTabs.map(async tab => {
          const d = await fetchSheetData(sheetId, `${tab.title}!A:ZZ`, accessToken)
          const cols = d.headers.map((_, idx) => analyzeCol(d.headers, d.rows, idx))
          return { tab, headers: d.headers, rows: d.rows, cols } as TabData
        })
      )

      setTabs(results.filter(t => t.rows.length > 0))
      setActiveIdx(0)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [sheetId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner label="Cargando indicadores…" />
  if (error)   return <ErrorState message={error} />
  if (!tabs.length) return <ErrorState message="El sheet no contiene pestañas con datos." />

  const active   = tabs[activeIdx]
  const widgets  = generateWidgets(active)
  const numCols  = active.cols.filter(c => c.type === "number")
  const catCols  = active.cols.filter(c => c.type === "category")
  const dateCols = active.cols.filter(c => c.type === "date")
  const textCols = active.cols.filter(c => c.type === "text" || c.type === "id")

  // Split widgets into KPI row and chart pairs
  const kpiWidget    = widgets.find(w => w.type === "kpi-group")
  const chartWidgets = widgets.filter(w => w.type !== "kpi-group")

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Indicadores</h1>
          <p className="text-ink-3 text-sm mt-0.5">
            {tabs.length} hoja{tabs.length !== 1 ? "s" : ""} · {active.rows.length.toLocaleString("es-AR")} registros · {active.headers.length} columnas
          </p>
          {lastUpdated && (
            <p className="text-xs text-ink-3 mt-1">Actualizado {lastUpdated.toLocaleTimeString("es-AR")}</p>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-accent px-3 py-2 rounded-lg hover:bg-accent-tint border border-hairline transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Tab selector */}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((t, i) => (
            <button
              key={t.tab.id}
              onClick={() => setActiveIdx(i)}
              className={`px-4 py-2 rounded-md text-xs font-medium border transition-all ${
                i === activeIdx
                  ? "bg-[#5b50e6] text-accent-fg border-[#5b50e6] "
                  : "text-ink-2 border-hairline hover:border-hairline hover:text-accent"
              }`}
            >
              {t.tab.title}
              <span className={`ml-1.5 text-[10px] ${i === activeIdx ? "text-accent" : "text-ink-3"}`}>
                {t.rows.length.toLocaleString("es-AR")}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Column summary pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Numéricas", count: numCols.length, color: "bg-accent-tint text-accent" },
          { label: "Categóricas", count: catCols.length, color: "bg-success-tint text-success" },
          { label: "Fechas", count: dateCols.length, color: "bg-warn-tint text-warn" },
          { label: "Texto/ID", count: textCols.length, color: "bg-panel text-ink-2" },
        ].filter(p => p.count > 0).map(p => (
          <span key={p.label} className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${p.color}`}>
            {p.count} col. {p.label}
          </span>
        ))}
      </div>

      {/* KPI cards */}
      {kpiWidget && (
        <section>
          <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">★ Core — Totales</p>
          <RenderWidget w={kpiWidget} total={active.rows.length} />
        </section>
      )}

      {/* Charts — pairs in grid */}
      {chartWidgets.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">● Distribuciones y tendencias</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {chartWidgets.map(w => (
              <RenderWidget key={w.id} w={w} total={active.rows.length} />
            ))}
          </div>
        </section>
      )}

      {/* Column map */}
      <section>
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">Mapa de columnas detectadas</p>
        <div className="bg-surface rounded-md border border-hairline overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-panel text-ink-2 text-left">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Columna</th>
                  <th className="px-4 py-3 font-medium">Tipo detectado</th>
                  <th className="px-4 py-3 font-medium text-right">No nulos</th>
                  <th className="px-4 py-3 font-medium text-right">Únicos</th>
                  <th className="px-4 py-3 font-medium text-right">Suma / Avg</th>
                  <th className="px-4 py-3 font-medium">Muestra valores</th>
                </tr>
              </thead>
              <tbody>
                {active.cols.map((c, i) => (
                  <tr key={i} className="border-t border-hairline hover:bg-panel/50">
                    <td className="px-4 py-2.5 text-ink-3">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        c.type === "number"   ? "bg-accent-tint text-accent" :
                        c.type === "category" ? "bg-success-tint text-success" :
                        c.type === "date"     ? "bg-warn-tint text-warn" :
                        c.type === "id"       ? "bg-accent-tint text-accent" :
                        "bg-panel text-ink-2"
                      }`}>{c.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-2">{c.nonNullCount.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-2.5 text-right text-ink-2">{c.uniqueCount.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-2.5 text-right text-ink-2">
                      {c.type === "number" ? `${fmt(c.sum)} / ${fmt(c.avg)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-3 max-w-[200px] truncate">
                      {c.samples.slice(0, 4).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Full data table */}
      <section>
        <h2 className="text-base font-semibold text-ink mb-3">
          Datos completos — {active.tab.title}
        </h2>
        <DataTable headers={active.headers} rows={active.rows} />
      </section>
    </div>
  )
}
