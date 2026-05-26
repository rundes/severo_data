/**
 * Lightweight text analysis for open-text survey fields (word clouds + sentiment).
 * Accent-folded, Spanish-aware. No external dependency.
 */

export interface WordCount {
  text: string // display form (accents preserved)
  value: number // mentions
}

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

// Spanish function words + domain-generic nouns that carry no signal in this dataset.
export const STOPWORDS = new Set<string>([
  "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "u", "e", "a",
  "en", "que", "con", "por", "para", "su", "sus", "se", "lo", "le", "les", "del", "al",
  "es", "son", "era", "fue", "ser", "estar", "esta", "este", "esto", "esa", "ese", "eso",
  "mas", "muy", "no", "si", "me", "mi", "te", "tu", "nos", "ya", "hay", "ni", "como",
  "pero", "aqui", "alli", "ahi", "donde", "cuando", "cual", "cuales", "quien", "porque",
  "sin", "sobre", "entre", "hasta", "desde", "cada", "todo", "toda", "todos", "todas",
  "otro", "otra", "otros", "otras", "mismo", "misma", "tan", "tanto", "tiene", "tienen",
  "tener", "hacer", "hace", "hacen", "van", "ser", "les", "mucho", "mucha", "muchos",
  "muchas", "poco", "poca", "algo", "alguien", "nadie", "les", "sea", "son", "the",
  // domain-generic
  "maipu", "ciudad", "pueblo", "barrio", "barrios", "gente", "lugar", "cosa", "cosas",
  "parte", "vez", "ano", "anos", "persona", "personas", "vecino", "vecinos", "zona",
])

const splitSurfaces = (text: string): string[] =>
  text.split(/[^\p{L}]+/u).filter(Boolean)

/** Count word mentions across many cell values, returning the top `max` by frequency. */
export function wordFrequencies(values: (string | number | null)[], max = 40): WordCount[] {
  const count = new Map<string, number>() // folded -> count
  const surfaces = new Map<string, Map<string, number>>() // folded -> (surface -> count)

  for (const v of values) {
    if (v === null || v === undefined) continue
    for (const surf of splitSurfaces(String(v))) {
      const key = fold(surf)
      if (key.length < 3 || STOPWORDS.has(key)) continue
      count.set(key, (count.get(key) ?? 0) + 1)
      const sm = surfaces.get(key) ?? new Map<string, number>()
      sm.set(surf, (sm.get(surf) ?? 0) + 1)
      surfaces.set(key, sm)
    }
  }

  const bestSurface = (key: string) => {
    let best = key, bestN = -1
    for (const [s, n] of surfaces.get(key) ?? []) if (n > bestN) { best = s; bestN = n }
    return best
  }

  return [...count.entries()]
    .map(([key, value]) => ({ text: bestSurface(key), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
}

// Curated Spanish sentiment lexicon (folded forms). Tuned to the survey vocabulary.
export const POSITIVE = new Set<string>([
  "espectacular", "lindo", "linda", "lindos", "lindas", "hermoso", "hermosa", "hermosos",
  "tranquilo", "tranquila", "tranquilos", "tranquilas", "tranquilidad", "bueno", "buena",
  "buenos", "buenas", "bien", "mejor", "mejores", "amor", "paz", "solidario", "solidaria",
  "solidaridad", "genial", "excelente", "maravilloso", "maravillosa", "agradable", "comodo",
  "comoda", "seguro", "segura", "limpio", "limpia", "ordenado", "ordenada", "progreso",
  "crecimiento", "familiar", "acogedor", "calido", "calida", "feliz", "alegre", "perfecto",
  "perfecta", "ideal", "optimo", "bonito", "bonita", "querido", "hogar", "paraiso", "amable",
  "amigable", "unido", "unida", "esperanza", "orgullo", "natural", "verde",
])

export const NEGATIVE = new Set<string>([
  "complicado", "complicada", "dificil", "dificiles", "atrasado", "atrasada", "farsa",
  "malo", "mala", "malos", "malas", "mal", "feo", "fea", "inseguro", "insegura",
  "inseguridad", "sucio", "sucia", "suciedad", "abandonado", "abandonada", "abandono",
  "problema", "problemas", "pobre", "pobreza", "peligroso", "peligrosa", "peligro", "caos",
  "desastre", "triste", "tristeza", "chato", "estancado", "estancada", "decadencia",
  "deficiente", "precario", "precaria", "conflictivo", "ruidoso", "lento", "olvidado",
  "olvidada", "descuidado", "descuidada", "roto", "horrible", "pesimo", "pesima", "terrible",
  "corrupto", "corrupcion", "violencia", "robos", "delincuencia",
])

export function sentimentOf(word: string): "pos" | "neg" | null {
  const k = fold(word)
  return POSITIVE.has(k) ? "pos" : NEGATIVE.has(k) ? "neg" : null
}

/** Split open-text into positive vs negative word clouds via the sentiment lexicon. */
export function sentimentFrequencies(
  values: (string | number | null)[],
  max = 30
): { positive: WordCount[]; negative: WordCount[] } {
  const all = wordFrequencies(values, 5000)
  return {
    positive: all.filter(w => sentimentOf(w.text) === "pos").slice(0, max),
    negative: all.filter(w => sentimentOf(w.text) === "neg").slice(0, max),
  }
}

/** Count comma/semicolon multi-select themes across one or more columns. */
export function themeCounts(
  rows: (string | number | null)[][],
  colIdxs: number[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const ci of colIdxs) {
      const raw = String(row[ci] ?? "").trim()
      if (!raw) continue
      for (const part of raw.split(/[,;/]+/)) {
        const t = part.trim()
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
  }
  return counts
}
