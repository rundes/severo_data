type Row = (string | number | null)[]

// ─── Blank / null detection ───────────────────────────────────────────────────

const BLANK_PATTERN = /^(sin\s+dato[s]?|s\/d|sd|n\/a|na|null|no\s+informa[r]?|no\s+inform\.|desconocido|no\s+aplica|ilegible|no\s+tiene|sin\s+informar|sin\s+informaci[oó]n|sin\s+info|-+|\.+|#{1,}|0{1,}|no\s+data)$/i

export function isBlank(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined) return true
  const s = String(v).trim()
  if (s === "" || s === "0" && false) return true  // keep 0 as valid
  return BLANK_PATTERN.test(s)
}

/** True if v looks like a real phone number or email (not just "NO", blanks, etc.) */
export function hasContactValue(v: string | number | null | undefined): boolean {
  if (isBlank(v)) return false
  const s = String(v).trim()
  if (/^no$/i.test(s)) return false
  if (/^s[ií]$/i.test(s)) return true  // explicit "SI" = has it
  if (s.length < 4) return false
  return true
}

/** Filter rows keeping only those with a non-blank value in colIdx */
export function filterValid(rows: Row[], colIdx: number): Row[] {
  return rows.filter(r => !isBlank(r[colIdx]))
}

/** % of rows with non-blank value in colIdx (0–100) */
export function pctFilled(rows: Row[], colIdx: number): number {
  if (!rows.length) return 0
  const filled = rows.filter(r => !isBlank(r[colIdx])).length
  return Math.round(filled / rows.length * 100)
}

/** valueCounts excluding blanks */
export function cleanValueCounts(
  rows: Row[],
  colIdx: number,
  max = 30
): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const raw = row[colIdx]
    if (isBlank(raw)) continue
    const k = String(raw).trim()
    counts[k] = (counts[k] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
}

// ─── Segmentation ─────────────────────────────────────────────────────────────

export type Segmento = "nucleoDuro" | "contactableDigital" | "contactableTerritorial" | "persuadible" | "sinAlcance"

export interface SegCols {
  iCelular: number[]   // all matching celular columns (MAIPU_celular #1, #2, …)
  iEmail: number[]     // all matching email columns
  iRedes: number[]     // all matching redes-sociales columns
  iAfil: number
  iDomicilio: number
  iBarrio: number
}

function hasDigital(row: Row, cols: SegCols): boolean {
  return (
    cols.iCelular.some(i => hasContactValue(row[i])) ||
    cols.iEmail.some(i => hasContactValue(row[i])) ||
    cols.iRedes.some(i => hasContactValue(row[i]))
  )
}

function hasTerritorial(row: Row, cols: SegCols): boolean {
  return (
    (cols.iDomicilio >= 0 && hasContactValue(row[cols.iDomicilio])) ||
    (cols.iBarrio >= 0 && hasContactValue(row[cols.iBarrio]))
  )
}

function hasAfiliacion(row: Row, cols: SegCols): boolean {
  return cols.iAfil >= 0 && hasContactValue(row[cols.iAfil])
}

export function segmentar(row: Row, cols: SegCols): Segmento {
  const digital    = hasDigital(row, cols)
  const territorial = hasTerritorial(row, cols)
  const afil       = hasAfiliacion(row, cols)

  if (afil && (digital || territorial)) return "nucleoDuro"
  if (digital) return "contactableDigital"
  if (territorial) return "contactableTerritorial"
  if (afil) return "persuadible"
  return "sinAlcance"
}

export interface SegmentacionResult {
  nucleoDuro: number
  contactableDigital: number
  contactableTerritorial: number
  persuadible: number
  sinAlcance: number
  total: number
}

export function calcularSegmentacion(rows: Row[], cols: SegCols): SegmentacionResult {
  const counts = { nucleoDuro: 0, contactableDigital: 0, contactableTerritorial: 0, persuadible: 0, sinAlcance: 0 }
  for (const row of rows) {
    counts[segmentar(row, cols)]++
  }
  return { ...counts, total: rows.length }
}

// ─── Índices (0–100) ─────────────────────────────────────────────────────────

export interface IndicesResult {
  contactabilidad: number   // % con al menos un canal de contacto
  persuadibilidad: number   // % sin afil + con contacto / total
  movilizacion: number      // % núcleo duro con contacto / total
  calidadDatos: number      // avg completitud de columnas clave
}

export function calcularIndices(
  rows: Row[],
  seg: SegmentacionResult,
  keyColIdxs: number[]
): IndicesResult {
  const total = rows.length || 1

  const contactables = seg.nucleoDuro + seg.contactableDigital + seg.contactableTerritorial
  const contactabilidad = Math.round(contactables / total * 100)

  const persuadibles = seg.contactableDigital + seg.contactableTerritorial
  const persuadibilidad = Math.round(persuadibles / total * 100)

  const movilizacion = Math.round(seg.nucleoDuro / total * 100)

  const pcts = keyColIdxs.filter(i => i >= 0).map(i => pctFilled(rows, i))
  const calidadDatos = pcts.length
    ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length)
    : 0

  return { contactabilidad, persuadibilidad, movilizacion, calidadDatos }
}

// ─── Completitud por columna ──────────────────────────────────────────────────

export interface ColCompletitud {
  name: string
  filled: number
  total: number
  pct: number
}

export function calcularCompletitud(headers: string[], rows: Row[]): ColCompletitud[] {
  return headers.map((name, idx) => {
    const filled = rows.filter(r => !isBlank(r[idx])).length
    const pct = rows.length ? Math.round(filled / rows.length * 100) : 0
    return { name, filled, total: rows.length, pct }
  }).sort((a, b) => b.pct - a.pct)
}

// ─── CSV / Excel export ───────────────────────────────────────────────────────

function escapeCell(v: string | number | null): string {
  const s = String(v ?? "").replace(/"/g, '""')
  return `"${s}"`
}

function buildCSV(headers: string[], rows: Row[]): string {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map(r => r.map(escapeCell).join(",")),
  ]
  return "﻿" + lines.join("\r\n")  // BOM for Excel
}

function triggerDownload(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportCSV(headers: string[], rows: Row[], filename = "padron.csv") {
  triggerDownload(buildCSV(headers, rows), filename)
}

export function exportSegment(
  headers: string[],
  rows: Row[],
  cols: SegCols,
  segmento: Segmento,
  filename?: string
) {
  const filtered = rows.filter(r => segmentar(r, cols) === segmento)
  const name = filename ?? `padron_${segmento}_${new Date().toISOString().slice(0,10)}.csv`
  triggerDownload(buildCSV(headers, filtered), name)
}

export function exportReport(
  headers: string[],
  rows: Row[],
  seg: SegmentacionResult,
  indices: IndicesResult
) {
  const lines = [
    "REPORTE ELECTORAL — PADRÓN ENRIQUECIDO",
    `Generado: ${new Date().toLocaleString("es-AR")}`,
    "",
    "=== SEGMENTACIÓN ===",
    `Núcleo duro,${seg.nucleoDuro},${Math.round(seg.nucleoDuro/seg.total*100)}%`,
    `Contactable digital,${seg.contactableDigital},${Math.round(seg.contactableDigital/seg.total*100)}%`,
    `Contactable territorial,${seg.contactableTerritorial},${Math.round(seg.contactableTerritorial/seg.total*100)}%`,
    `Persuadible,${seg.persuadible},${Math.round(seg.persuadible/seg.total*100)}%`,
    `Sin alcance,${seg.sinAlcance},${Math.round(seg.sinAlcance/seg.total*100)}%`,
    `Total padrón,${seg.total},100%`,
    "",
    "=== ÍNDICES (0-100) ===",
    `Contactabilidad,${indices.contactabilidad}`,
    `Persuadibilidad,${indices.persuadibilidad}`,
    `Movilización,${indices.movilizacion}`,
    `Calidad de datos,${indices.calidadDatos}`,
    "",
    "=== DATOS COMPLETOS ===",
    buildCSV(headers, rows),
  ]
  triggerDownload("﻿" + lines.join("\r\n"), `reporte_padron_${new Date().toISOString().slice(0,10)}.csv`)
}

// ─── Participación electoral ──────────────────────────────────────────────────

/** Normalizes "votó / no votó" values to true/false/null */
export function normalizaVoto(v: string | number | null): boolean | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  // New sheet model: only non-voters get marked, so a dash means the person voted.
  if (s === "-" || s === "–" || s === "—" || s === "−") return true
  if (["SI", "S", "1", "TRUE", "VOTO", "VOTO SI", "X", "V", "ASISTIO", "CONCURRIO", "EMITIO"].includes(s)) return true
  if (["NO", "N", "0", "FALSE", "NO VOTO", "NO ASISTIO", "AUSENTE"].includes(s)) return false
  return null
}

/** Left-join two sheets by a key column (e.g. DNI). Normalizes key by stripping non-digits. */
export function joinSheetByKey(
  mainHeaders: string[], mainRows: Row[], mainKeyIdx: number,
  joinHeaders: string[], joinRows: Row[], joinKeyIdx: number
): { headers: string[]; rows: Row[]; matched: number } {
  const normKey = (v: string | number | null) =>
    String(v ?? "").replace(/\D/g, "").replace(/^0+/, "")

  const lookup = new Map<string, Row>()
  for (const row of joinRows) {
    const k = normKey(row[joinKeyIdx])
    if (k) lookup.set(k, row)
  }

  const extraCols = joinHeaders
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== joinKeyIdx)

  let matched = 0
  const newRows = mainRows.map(row => {
    const k = normKey(row[mainKeyIdx])
    const match = k ? lookup.get(k) : undefined
    if (match) matched++
    return [...row, ...extraCols.map(c => match ? (match[c.i] ?? null) : null)]
  })

  return {
    headers: [...mainHeaders, ...extraCols.map(c => c.h)],
    rows: newRows,
    matched,
  }
}
