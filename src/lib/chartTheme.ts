/**
 * Chart theme — the one place a fuller palette is earned (see DESIGN.md).
 *
 * Recharts renders SVG and many of its color props don't reliably resolve
 * CSS custom properties, so chart chrome is expressed as hex here, tuned to
 * match the OKLCH tokens in globals.css. Meaning is never carried by hue
 * alone: every series is backed by a legend or label.
 */

/** Brand-led categorical ramp. Hue- and lightness-varied so adjacent series stay distinct. */
export const CHART_COLORS = [
  "#5b50e6", // indigo (accent family)
  "#e0921a", // amber
  "#0f9b8e", // teal
  "#d6456a", // rose
  "#3c9bd6", // sky
  "#9a8a1f", // olive
  "#c0497f", // magenta
  "#5b6472", // slate
] as const

/** Pick a categorical color by index, wrapping around the ramp. */
export const chartColor = (i: number) => CHART_COLORS[((i % CHART_COLORS.length) + CHART_COLORS.length) % CHART_COLORS.length]

/** Primary single-series color (the committed accent). */
export const ACCENT = CHART_COLORS[0]

/* Neutral chrome, matched to the warm-paper / ink tokens. */
export const INK = "#3a352f" // --ink
export const INK_3 = "#8f897e" // --ink-3, axis labels & muted text
export const HAIRLINE = "#e9e5de" // --hairline, grid lines
export const HAIRLINE_STRONG = "#d8d2c9" // --hairline-strong
export const SURFACE = "#fdfcfa" // --surface, tooltip background

/** es-AR number formatting, used on axes, labels, and tooltips. */
export const fmtNumber = (v: unknown) =>
  typeof v === "number" ? v.toLocaleString("es-AR") : String(v ?? "")

/** Shared recharts axis tick style. */
export const axisTick = { fontSize: 11, fill: INK_3 } as const

/** Shared recharts CartesianGrid stroke. */
export const gridStroke = HAIRLINE

/** Shared recharts Tooltip contentStyle: warm surface, hairline border, soft pop. */
export const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${HAIRLINE_STRONG}`,
  background: SURFACE,
  color: INK,
  fontSize: 12,
  boxShadow: "0 1px 2px rgba(60,52,42,0.04), 0 8px 24px rgba(60,52,42,0.08)",
  padding: "8px 10px",
} as const

/** Tooltip label (the category name) style. */
export const tooltipLabelStyle = { color: INK, fontWeight: 600 } as const
