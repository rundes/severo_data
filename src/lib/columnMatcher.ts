type Row = (string | number | null)[]

/** Find column index by regex patterns, returns -1 if not found */
export function findCol(headers: string[], patterns: RegExp[]): number {
  for (const pat of patterns) {
    const i = headers.findIndex((h) => pat.test(h.trim()))
    if (i !== -1) return i
  }
  return -1
}

/** Count occurrences of each value in a column */
export function valueCounts(
  rows: Row[],
  colIdx: number,
  maxItems = 30
): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const k = String(row[colIdx] ?? "Sin dato").trim() || "Sin dato"
    counts[k] = (counts[k] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, maxItems)
}

/** Group rows by two keys → stacked bar data */
export function crossTab(
  rows: Row[],
  groupIdx: number,
  categoryIdx: number
): { name: string; [k: string]: number | string }[] {
  const groups: Record<string, Record<string, number>> = {}
  const cats = new Set<string>()
  for (const row of rows) {
    const g = String(row[groupIdx] ?? "Sin dato").trim() || "Sin dato"
    const c = String(row[categoryIdx] ?? "Sin dato").trim() || "Sin dato"
    groups[g] ??= {}
    groups[g][c] = (groups[g][c] ?? 0) + 1
    cats.add(c)
  }
  return Object.entries(groups).map(([name, cs]) => ({
    name,
    ...Object.fromEntries([...cats].map((c) => [c, cs[c] ?? 0])),
  }))
}

/** Group by date column, count rows per day */
export function timeSeries(
  rows: Row[],
  fechaIdx: number
): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const raw = String(row[fechaIdx] ?? "").split(" ")[0].split("T")[0]
    if (!raw || raw === "undefined") continue
    counts[raw] = (counts[raw] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }))
}

/** Derive age from birth year (clase) assuming current year 2026 */
export function ageFromClase(clase: number | string | null): number | null {
  const n = Number(clase)
  if (isNaN(n) || n < 1900 || n > 2015) return null
  return 2026 - n
}

/** Build age group distribution from clase column */
export function ageGroups(
  rows: Row[],
  claseIdx: number,
  sexoIdx = -1
): { name: string; value: number; M?: number; F?: number }[] {
  const GROUPS = [
    { label: "16–18", min: 16, max: 18 },
    { label: "19–29", min: 19, max: 29 },
    { label: "30–44", min: 30, max: 44 },
    { label: "45–64", min: 45, max: 64 },
    { label: "65+", min: 65, max: 120 },
  ]
  const buckets: Record<string, { total: number; M: number; F: number }> = {}
  for (const g of GROUPS) buckets[g.label] = { total: 0, M: 0, F: 0 }

  for (const row of rows) {
    const age = ageFromClase(row[claseIdx])
    if (age === null) continue
    const grp = GROUPS.find((g) => age >= g.min && age <= g.max)
    if (!grp) continue
    buckets[grp.label].total++
    if (sexoIdx >= 0) {
      const s = String(row[sexoIdx] ?? "").toUpperCase()
      if (s.startsWith("M") || s === "MASCULINO") buckets[grp.label].M++
      else if (s.startsWith("F") || s === "FEMENINO") buckets[grp.label].F++
    }
  }
  return GROUPS.map((g) => ({
    name: g.label,
    value: buckets[g.label].total,
    M: buckets[g.label].M,
    F: buckets[g.label].F,
  }))
}

/** Normalize P26 responses to SI / NO / DUDOSO */
export function normalizeVoto(raw: string): string {
  const v = raw.toUpperCase().trim()
  if (v === "SI" || v === "SÍ" || v === "S" || v.startsWith("SI ") || v === "1") return "SI"
  if (v === "NO" || v === "N" || v.startsWith("NO ") || v === "0") return "NO"
  if (v.includes("DUD") || v.includes("TAL VEZ") || v.includes("NO SÉ") || v === "?") return "DUDOSO"
  return "OTRO"
}

/** Build P26 by barrio stacked data */
export function p26ByBarrio(
  rows: Row[],
  barrioIdx: number,
  p26Idx: number
): { name: string; SI: number; NO: number; DUDOSO: number; OTRO: number }[] {
  const data: Record<string, { SI: number; NO: number; DUDOSO: number; OTRO: number }> = {}
  for (const row of rows) {
    const barrio = String(row[barrioIdx] ?? "Sin dato").trim() || "Sin dato"
    const voto = normalizeVoto(String(row[p26Idx] ?? ""))
    data[barrio] ??= { SI: 0, NO: 0, DUDOSO: 0, OTRO: 0 }
    data[barrio][voto as keyof (typeof data)[string]]++
  }
  return Object.entries(data).map(([name, v]) => ({ name, ...v }))
}

/** Calculate median */
export function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

// ─── Specific column matchers for this dataset ────────────────────────────────

export const COL = {
  // Padrón
  documento: [/\bdni\b/i, /documento/i, /doc\b/i],
  sexo: [/\bsexo\b/i, /g[eé]nero/i],
  clase: [/\bclase\b/i, /a[ñn]o.*nac/i, /nacimiento/i, /birth/i],
  mesa: [/\bmesa\b/i],
  establecimiento: [/establecimiento/i, /escuela/i, /local/i],
  circuito: [/\bcod_?circ\b/i, /circuito/i, /circ/i],
  lat: [/\blat(itud)?\b/i, /\by\b/],
  lon: [/\blon(gitud)?\b/i, /\blng\b/i, /\bx\b/],
  profesion: [/profesi[oó]n/i, /\bprof\b/i, /ocupaci[oó]n/i],
  fuerza: [/fuerza/i, /partido/i, /espacio/i],
  referente: [/referente/i, /contacto/i],
  apellido: [/apellido/i],
  nombre: [/\bnombre\b/i],

  // Relevamiento común
  barrio: [/\bP02\b/, /\bbarrio\b/i, /\bzona\b/i, /\blocalidad\b/i],
  fecha: [/timestamp/i, /\bfecha\b/i, /\bdate\b/i, /enviado/i, /creado/i],
  relevador: [/relevad[oa]r?/i, /encuestador/i, /operador/i, /\bmail\b/i, /\bemail\b/i, /responsable/i],

  // Ciudadanos
  p26: [/\bP26\b/, /vot[ao]r[ií]a/i, /intencion/i, /nos votar/i],
  edadRelevado: [/\bedad\b/i, /\bclase\b/i, /nacimiento/i],
  calidadVida: [/calidad.*vida/i, /\bP\d+.*vida/i],

  // Sociohabitacional
  tenencia: [/tenencia/i, /\bP\d+.*tenencia/i, /propiet/i, /r[eé]gimen/i],
  tipoVivienda: [/tipo.*vivienda/i, /vivienda.*tipo/i, /\bP\d+.*vivienda/i],
  materialParedes: [/material.*pared/i, /pared.*material/i, /\bP\d+.*pared/i],
  cloaca: [/cloac/i, /desag[üu]e/i, /cloacal/i],
  agua: [/agua/i, /potable/i],
  luz: [/\bluz\b/i, /electr/i, /energ[ií]a/i],
  gas: [/\bgas\b/i, /combustible/i],
  discapacidad: [/discap/i],
  cud: [/\bcud\b/i, /certif.*discap/i],
  tipoDiscap: [/tipo.*discap/i, /discap.*tipo/i],
  escritura: [/escritura/i, /titulo/i, /t[ií]tulo/i],

  // Problemáticas
  tipoProblema: [/\btipo\b/i, /categor[ií]a/i, /problem[aá]/i, /reclamo/i],
  gravedad: [/gravedad/i, /severidad/i, /urgencia/i, /\bnivel\b/i, /prioridad/i],
  descripcion: [/descripci[oó]n/i, /detalle/i, /observaci[oó]n/i],

  // Electoral
  partido: [/\bpartido\b/i, /agrupaci[oó]n/i, /\blista\b/i, /\bfrente\b/i, /\bbloque\b/i, /\balianza\b/i, /fuerza.*pol/i],
  votos: [/\bvotos?\b/i, /\bcantidad\b/i, /\btotal_votos\b/i, /\btotal\b/i, /\bsufragios?\b/i],
  pctVotos: [/%.*votos?/i, /votos?.*%/i, /porcentaje/i, /\bpct\b/i, /\bpor.*ciento\b/i],
  seccion: [/\bsecci[oó]n\b/i, /\bdistrito\b/i, /\bseccional\b/i],
  circuitoElect: [/\bcircuito\b/i, /\bcirc\b/i, /\bcod.*circ\b/i],
  mesaElect: [/\bmesa\b/i, /\borden\b/i],
  cargo: [/\bcargo\b/i, /\bcategor[ií]a\b/i, /\beleccion\b/i, /\bpuesto\b/i],
  candidato: [/candidato/i, /\bnombre\b/i, /\bapellido\b/i],
  votosValidos: [/v[aá]lidos?/i, /positivos?/i],
  votosBlancos: [/blancos?/i],
  votosNulos: [/nulos?/i, /anulados?/i],
  votosImpug: [/impugnados?/i, /recurridos?/i],
  electores: [/\belectores\b/i, /\bhabilitados\b/i, /\bpadr[oó]n\b/i],
  participacion: [/participaci[oó]n/i, /concurrencia/i, /\bvotaron\b/i],

  // Padrón enriquecido — contactabilidad
  celular: [/celular/i, /\bcel\b/i, /tel[eé]fono/i, /\btel\b/i, /\bphone\b/i, /m[oó]vil/i, /whatsapp/i, /\bwp\b/i],
  email: [/\bemail\b/i, /\bcorreo\b/i, /e-mail/i, /correo.*elect/i],
  redesSociales: [/red.*social/i, /social.*red/i, /facebook/i, /instagram/i, /twitter/i, /tiktok/i, /\bredes\b/i, /\bfb\b/i, /\big\b/i],
  domicilio: [/\bdomicilio\b/i, /\bdirecci[oó]n\b/i, /\bcalle\b/i, /\bdir\b/i],

  // Padrón enriquecido — perfil sociopolítico
  estadoCivil: [/estado.*civil/i, /civil\b/i, /estado_civil/i, /\bcasad[ao]\b/i, /\bsolter[ao]\b/i],
  educacion: [/educaci[oó]n/i, /nivel.*educ/i, /nivel.*estudio/i, /\bescolaridad\b/i, /\binstrucci[oó]n\b/i, /nivel_educ/i, /\bestudio\b/i],
  afiliacion: [/afiliaci[oó]n/i, /\bafili[ao]\b/i, /\bmilitante\b/i, /partido.*afil/i, /afil.*partido/i, /\bpartido_pol/i],
  observaciones: [/observaci[oó]n/i, /\bnota\b/i, /\bcomentario\b/i, /\bobs\b/i],
}

