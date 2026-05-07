/**
 * Static barrio boundaries for Maipú extracted from Maipu-Detalle.kmz.
 * Coordinates are [lon, lat] (GeoJSON convention), rings are closed.
 */

export interface BarrioFeature {
  name: string
  /** Closed ring of [lon, lat] pairs */
  ring: [number, number][]
}

export const BARRIOS: BarrioFeature[] = [
  { name: "Villa Italia", ring: [[-57.884581,-36.8618707],[-57.877865,-36.8561197],[-57.882843,-36.8519477],[-57.896276,-36.8635187],[-57.89104,-36.8672617],[-57.884581,-36.8618707]] },
  { name: "Villa Vanelli", ring: [[-57.883101,-36.879689],[-57.874689,-36.87224],[-57.883294,-36.865528],[-57.884302,-36.866352],[-57.887135,-36.864154],[-57.890954,-36.867433],[-57.889087,-36.868961],[-57.892714,-36.871828],[-57.883101,-36.879689]] },
  { name: "Barrio Belgrano", ring: [[-57.871041,-36.854969],[-57.870097,-36.850196],[-57.870719,-36.850299],[-57.87132,-36.850694],[-57.87411,-36.85296],[-57.877736,-36.856171],[-57.878616,-36.856995],[-57.879581,-36.857682],[-57.876792,-36.859794],[-57.873788,-36.857304],[-57.871041,-36.854969]] },
  { name: "Barrio Centro", ring: [[-57.8794958,-36.8577854],[-57.887135,-36.864154],[-57.884302,-36.866352],[-57.8765777,-36.859862],[-57.8794958,-36.8577854]] },
  { name: "Barrio Alvarado", ring: [[-57.8713098,-36.8553724],[-57.8795068,-36.8623604],[-57.8765668,-36.8645754],[-57.8719318,-36.8605064],[-57.8713098,-36.8553724]] },
  { name: "Barrio Unión", ring: [[-57.883036,-36.865528],[-57.87456,-36.872154],[-57.873895,-36.871587],[-57.872071,-36.860927],[-57.876556,-36.864704],[-57.879646,-36.86242],[-57.883036,-36.865528]] },
  { name: "Barrio Santo Domingo", ring: [[-57.59016,-36.703522],[-57.592478,-36.714463],[-57.578144,-36.719004],[-57.573338,-36.705449],[-57.59016,-36.703522]] },
  { name: "Barrio Segurola", ring: [[-57.463989,-36.827837],[-57.467937,-36.834294],[-57.455921,-36.839927],[-57.450428,-36.831478],[-57.463989,-36.827837]] },
  { name: "Barrio Monsalvo", ring: [[-57.36434,-36.876977],[-57.366786,-36.880959],[-57.356358,-36.887207],[-57.352667,-36.881577],[-57.36434,-36.876977]] },
  { name: "Las Armas", ring: [[-57.826202,-37.076203],[-57.83869,-37.077675],[-57.835,-37.09024],[-57.821352,-37.088391],[-57.826202,-37.076203]] },
]

export const BARRIO_NAMES = BARRIOS.map(b => b.name)

/** Ray-casting point-in-polygon. pt = [lon, lat], ring = [[lon, lat], ...] */
function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Returns the barrio name for a given (lat, lon) point, or null if outside all barrios.
 * lat/lon in decimal degrees (WGS84).
 */
export function getBarrioForPoint(lat: number, lon: number): string | null {
  for (const b of BARRIOS) {
    if (pointInRing(lon, lat, b.ring)) return b.name
  }
  return null
}

/** Normalize a string for fuzzy barrio matching (strips "Barrio " prefix, lowercases, NFD) */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/^barrio\s+/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

/** Build a lookup map from normalized barrio name → canonical name */
const NORM_MAP: Record<string, string> = {}
for (const b of BARRIOS) {
  NORM_MAP[norm(b.name)] = b.name
  // Also index by full name
  NORM_MAP[b.name.toLowerCase()] = b.name
}

/** Resolve a raw barrio text value to a canonical BARRIOS name, or null */
export function resolveBarrioName(raw: string): string | null {
  const n = norm(raw)
  return NORM_MAP[n] ?? null
}

type Row = (string | number | null)[]

/**
 * Filter rows by selected barrio name.
 * Strategy:
 *   1. If the row has valid lat/lon → use point-in-polygon
 *   2. Otherwise fall back to text matching against iBarrioText column
 */
export function filterByBarrio(
  rows: Row[],
  barrio: string,
  iLat: number,
  iLon: number,
  iBarrioText = -1,
): Row[] {
  if (!barrio) return rows
  const target = BARRIOS.find(b => b.name === barrio)
  if (!target) return rows

  return rows.filter(row => {
    // Try geo first
    if (iLat >= 0 && iLon >= 0) {
      const lat = Number(row[iLat])
      const lon = Number(row[iLon])
      if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
        return pointInRing(lon, lat, target.ring)
      }
    }
    // Fallback: text column
    if (iBarrioText >= 0) {
      const raw = String(row[iBarrioText] ?? "")
      const resolved = resolveBarrioName(raw)
      return resolved === barrio
    }
    return false
  })
}
