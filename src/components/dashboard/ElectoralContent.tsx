"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchDriveFolder, fetchSheetData, fetchSheetTabs } from "@/lib/sheets"
import { findCol, valueCounts, COL } from "@/lib/columnMatcher"
import type { DriveFile } from "@/types"
import KPICard from "@/components/charts/KPICard"
import HorizontalBarChart from "@/components/charts/HorizontalBarChart"
import BarChartComponent from "@/components/charts/BarChartComponent"
import PieChartComponent from "@/components/charts/PieChartComponent"
import DataTable from "@/components/dashboard/DataTable"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ErrorState from "@/components/ui/ErrorState"

type Row = (string | number | null)[]

interface SheetResult {
  file: DriveFile
  tab: string
  headers: string[]
  rows: Row[]
}

interface Props { folderId: string }

const SHEET_MIME = "application/vnd.google-apps.spreadsheet"

export default function ElectoralContent({ folderId }: Props) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [sheets, setSheets] = useState<SheetResult[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true); setError(null)

      // 1. List all files in the Drive folder
      const driveFiles = await fetchDriveFolder(folderId, accessToken)
      const sheetFiles = driveFiles.filter(f => f.mimeType === SHEET_MIME)
      setFiles(sheetFiles)

      if (sheetFiles.length === 0) throw new Error("No se encontraron Google Sheets en la carpeta")

      // 2. Load each sheet (first tab of each)
      const results = await Promise.all(
        sheetFiles.map(async (file): Promise<SheetResult | null> => {
          try {
            const tabs = await fetchSheetTabs(file.id, accessToken)
            const tab = tabs[0]
            if (!tab) return null
            const d = await fetchSheetData(file.id, `${tab.title}!A:Z`, accessToken)
            return { file, tab: tab.title, headers: d.headers, rows: d.rows }
          } catch {
            return null
          }
        })
      )

      const valid = results.filter((r): r is SheetResult => r !== null && r.rows.length > 0)
      setSheets(valid)
      setActiveIdx(0)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [folderId, accessToken])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner label="Cargando datos electorales..." />
  if (error) return <ErrorState message={error} />
  if (sheets.length === 0) return <ErrorState message="No se encontraron hojas con datos en la carpeta." />

  const active = sheets[activeIdx]
  const { headers, rows } = active

  // Column detection for electoral data
  const iPartido    = findCol(headers, COL.partido)
  const iVotos      = findCol(headers, COL.votos)
  const iPct        = findCol(headers, COL.pctVotos)
  const iCircuito   = findCol(headers, COL.circuitoElect)
  const iMesa       = findCol(headers, COL.mesaElect)
  const iCargo      = findCol(headers, COL.cargo)
  const iCandidato  = findCol(headers, COL.candidato)
  const iBlancos    = findCol(headers, COL.votosBlancos)
  const iNulos      = findCol(headers, COL.votosNulos)
  const iElectores  = findCol(headers, COL.electores)

  // KPIs
  const totalVotos = iVotos >= 0
    ? rows.reduce((sum, r) => sum + (Number(r[iVotos]) || 0), 0)
    : rows.length

  const totalBlancos = iBlancos >= 0
    ? rows.reduce((sum, r) => sum + (Number(r[iBlancos]) || 0), 0)
    : null

  const totalNulos = iNulos >= 0
    ? rows.reduce((sum, r) => sum + (Number(r[iNulos]) || 0), 0)
    : null

  const totalElectores = iElectores >= 0
    ? rows.reduce((sum, r) => sum + (Number(r[iElectores]) || 0), 0)
    : null

  const participacion = (totalElectores && totalVotos)
    ? Math.round(totalVotos / totalElectores * 100)
    : null

  // Votos por partido — aggregate if votos column exists, else count rows
  const partidoData: { name: string; value: number }[] = iPartido >= 0
    ? (() => {
        if (iVotos >= 0) {
          // Sum votos by partido
          const agg: Record<string, number> = {}
          rows.forEach(r => {
            const p = String(r[iPartido] ?? "Sin dato").trim() || "Sin dato"
            agg[p] = (agg[p] ?? 0) + (Number(r[iVotos]) || 0)
          })
          return Object.entries(agg)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
        }
        return valueCounts(rows, iPartido, 20)
      })()
    : []

  // Votos por circuito
  const circuitoData: { name: string; value: number }[] = iCircuito >= 0
    ? (() => {
        if (iVotos >= 0) {
          const agg: Record<string, number> = {}
          rows.forEach(r => {
            const c = String(r[iCircuito] ?? "Sin dato").trim() || "Sin dato"
            agg[c] = (agg[c] ?? 0) + (Number(r[iVotos]) || 0)
          })
          return Object.entries(agg)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 20)
        }
        return valueCounts(rows, iCircuito, 20)
      })()
    : []

  // Cargos distintos
  const cargoData = iCargo >= 0 ? valueCounts(rows, iCargo, 10) : []

  // Partido pie (top 8)
  const partidoPie = partidoData.slice(0, 8)

  const winner = partidoData[0]
  const runnerUp = partidoData[1]
  const ventaja = (winner && runnerUp && iVotos >= 0)
    ? winner.value - runnerUp.value
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Datos Electorales</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {files.length} archivo{files.length !== 1 ? "s" : ""} en carpeta · {rows.length.toLocaleString("es-AR")} registros
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

      {/* File selector */}
      {sheets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {sheets.map((s, i) => (
            <button
              key={s.file.id}
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                i === activeIdx
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                  : "text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-700"
              }`}
            >
              {s.file.name}
            </button>
          ))}
        </div>
      )}

      {/* Hoja activa info */}
      {sheets.length === 1 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-medium text-gray-600">{active.file.name}</span>
          <span>·</span>
          <span>Hoja: {active.tab}</span>
        </div>
      )}

      {/* ★ KPIs */}
      <section>
        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Resultados generales</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {iVotos >= 0
            ? <KPICard title="Total votos" value={totalVotos.toLocaleString("es-AR")} color="#1e3a5f" />
            : <KPICard title="Total registros" value={rows.length} color="#1e3a5f" />
          }
          {winner && (
            <KPICard
              title="1° partido"
              value={winner.name.length > 22 ? winner.name.slice(0, 20) + "…" : winner.name}
              color="#10b981"
              subtitle={iVotos >= 0 ? `${winner.value.toLocaleString("es-AR")} votos` : `${winner.value} registros`}
            />
          )}
          {ventaja !== null && (
            <KPICard title="Ventaja 1° vs 2°" value={ventaja.toLocaleString("es-AR")} color="#0ea5e9" subtitle="votos" />
          )}
          {totalBlancos !== null && (
            <KPICard title="Votos en blanco" value={totalBlancos.toLocaleString("es-AR")} color="#6b7280" />
          )}
          {participacion !== null && (
            <KPICard title="Participación" value={`${participacion}%`} color="#f59e0b" subtitle={`de ${totalElectores?.toLocaleString("es-AR")} habilitados`} />
          )}
          {totalNulos !== null && (
            <KPICard title="Votos nulos" value={totalNulos.toLocaleString("es-AR")} color="#ef4444" />
          )}
        </div>
      </section>

      {/* ★ Votos por partido */}
      {partidoData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">★ Core — Resultados por partido / lista</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HorizontalBarChart
              data={partidoData}
              color="#1e3a5f"
              title="★ Votos por agrupación"
              badge="★ CORE"
              maxItems={15}
            />
            {partidoPie.length > 0 && (
              <PieChartComponent
                data={partidoPie}
                dataKey="value"
                nameKey="name"
                title="★ Distribución de votos"
              />
            )}
          </div>
        </section>
      )}

      {/* ● Circuito */}
      {circuitoData.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Quick Win — Votos por circuito</p>
          <HorizontalBarChart
            data={circuitoData}
            color="#0ea5e9"
            title="● Distribución por circuito electoral"
            badge="● QUICK WIN"
          />
        </section>
      )}

      {/* Candidatos / categorías */}
      {iCandidato >= 0 && iVotos >= 0 && (() => {
        const agg: Record<string, number> = {}
        rows.forEach(r => {
          const c = String(r[iCandidato] ?? "Sin dato").trim() || "Sin dato"
          agg[c] = (agg[c] ?? 0) + (Number(r[iVotos]) || 0)
        })
        const data = Object.entries(agg)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 20)
        if (data.length === 0) return null
        return (
          <section>
            <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">● Quick Win — Votos por candidato</p>
            <HorizontalBarChart
              data={data}
              color="#8b5cf6"
              title="● Ranking de candidatos"
              badge="● QUICK WIN"
            />
          </section>
        )
      })()}

      {/* Cargos */}
      {cargoData.length > 1 && (
        <section>
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-3">◆ Avanzado — Categorías / cargos</p>
          <BarChartComponent
            data={cargoData}
            dataKey="value"
            nameKey="name"
            color="#8b5cf6"
            title="◆ Registros por categoría electoral"
          />
        </section>
      )}

      {/* All files list */}
      {files.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Archivos en la carpeta</p>
          <div className="flex flex-wrap gap-2">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 3l5 5H12V6z"/>
                </svg>
                {f.name}
                {f.modifiedTime && (
                  <span className="text-gray-400 ml-1">
                    {new Date(f.modifiedTime).toLocaleDateString("es-AR")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Data table */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">
          Datos completos — {active.file.name}
        </h2>
        <DataTable headers={headers} rows={rows} />
      </section>
    </div>
  )
}
