# Design

The visual system for severo-dashboard. A light, editorial-analyst interface: ink on warm paper, one committed indigo-violet accent, numbers treated as the protagonist. Deliberately not the navy-blue government dashboard. See PRODUCT.md for strategy.

## Theme

Light. The scene that forces it: a campaign strategist scanning barrio-level results on a laptop in a daylit office, and the candidate checking one number on a phone outdoors in the Maipú sun. Daylight and glare demand high-contrast ink on a warm near-white, not a dark observability shell.

Color is expressed in OKLCH. Neutrals are warm-tinted (hue ~80) and never pure black or white; the accent is cool indigo-violet (hue ~287), the warm-paper / cool-accent pairing that reads editorial rather than corporate.

## Color

Strategy: **Restrained**. Tinted-neutral surfaces + ink text + one committed accent used only for primary actions, the current navigation item, and active selection. Never decoration. Charts are the single exception and get their own categorical ramp.

### Neutrals (warm paper)
| Token | OKLCH | Role |
|---|---|---|
| `--paper` | `oklch(0.985 0.004 85)` | App canvas |
| `--surface` | `oklch(0.997 0.003 85)` | Raised surfaces: menus, the few real cards |
| `--panel` | `oklch(0.965 0.006 85)` | Second neutral layer: rail, toolbars, table headers |
| `--ink` | `oklch(0.255 0.008 75)` | Primary text, key numbers |
| `--ink-2` | `oklch(0.46 0.01 75)` | Secondary text |
| `--ink-3` | `oklch(0.62 0.012 75)` | Muted: labels, axes, captions |
| `--ink-4` | `oklch(0.74 0.01 75)` | Faint: placeholders, disabled |
| `--hairline` | `oklch(0.915 0.006 80)` | Default 1px separators |
| `--hairline-strong` | `oklch(0.86 0.008 80)` | Emphasized separators |

### Accent (indigo-violet, committed)
| Token | OKLCH | Role |
|---|---|---|
| `--accent` | `oklch(0.53 0.205 287)` | Primary action, active nav, selection |
| `--accent-hover` | `oklch(0.47 0.215 287)` | Hover |
| `--accent-active` | `oklch(0.43 0.20 287)` | Pressed |
| `--accent-fg` | `oklch(0.99 0.01 287)` | Text/icon on accent fill |
| `--accent-tint` | `oklch(0.955 0.03 287)` | Selected/hover background |
| `--accent-tint-strong` | `oklch(0.91 0.055 287)` | Stronger tint, active row |
| `--accent-ring` | `oklch(0.62 0.18 287 / 0.4)` | Focus ring |

### Semantic (paired with icon + label, never hue alone)
Lightness differs across the three so they are distinguishable in grayscale and to color-blind readers, per the accessibility mandate.
| Token | OKLCH |
|---|---|
| `--success` / tint | `oklch(0.6 0.13 160)` / `oklch(0.95 0.04 160)` |
| `--warn` / tint | `oklch(0.72 0.15 70)` / `oklch(0.95 0.05 75)` |
| `--danger` / tint | `oklch(0.56 0.2 25)` / `oklch(0.95 0.04 25)` |

### Chart categorical ramp
The one place a fuller palette is earned (product data viz). Brand-led, hue- and lightness-varied so adjacent series stay distinct; always backed by a legend or label so meaning is never carried by hue alone. Defined as hex in `src/lib/chartTheme.ts` for recharts. Order: indigo `#5b50e6`, amber `#e0921a`, teal `#0f9b8e`, rose `#d6456a`, sky `#3c9bd6`, olive `#9a8a1f`, magenta `#c0497f`, slate `#5b6472`.

## Typography

One family: **Inter** (loaded via `next/font`). No display pairing; weight and size carry hierarchy.

- Fixed rem scale, ratio ~1.2: `0.6875` (eyebrow), `0.75` (caption), `0.8125` (body-sm), `0.875` (body), `1` (subhead), `1.25` (h2), `1.5` (h1), `2` (hero metric).
- Weights: 400 body, 500 labels/nav, 600 headings, 700 key numbers.
- **`tabular-nums` on every number** (metrics, tables, axes, percentages) so digits align in columns. This is the single most important type rule for this tool.
- Eyebrows/section kickers: `0.6875rem`, uppercase, `tracking-wide`, `--ink-3`.

## Layout & Elevation

- The card is not the default container. Sections are separated by whitespace rhythm and `--hairline` rules. Reach for a real surface (`--surface` + hairline border, soft shadow) only when something genuinely floats: menus, the sidebar drawer, a true data panel. Never nest a card in a card.
- Vary spacing for rhythm; do not pad everything identically.
- Radii are restrained: `6–10px`. No `rounded-2xl` blobs.
- Elevation is a single soft token (`--shadow-pop`) for floating surfaces. Most surfaces use a hairline border, not a shadow.
- Predictable grid; standard app-shell (left rail + top bar + scroll region). Familiarity is the affordance.

## Motion

- 150–250ms, `ease-out` (exponential). State and feedback only: hover, focus, selection, reveal. No page-load choreography, no decorative motion.
- Never animate layout properties. Respect `prefers-reduced-motion: reduce` (disable transitions/animations).

## Component conventions

- **Metrics**: a compact tabular strip, label above, number in `--ink` with `tabular-nums`, optional delta shown as **sign + arrow icon + color together**. No hero-metric template, no colored side-stripe borders, no big tinted square.
- **Tables**: `--panel` sticky header, `--hairline` row separators, hover row `--accent-tint`, right-aligned tabular numbers.
- **Buttons**: primary = `--accent` fill + `--accent-fg`; secondary = hairline border + ink; ghost = ink, hover `--panel`. All states: default, hover, focus (accent ring), active, disabled, loading.
- **Loading**: skeletons shaped like the content, not a centered spinner mid-content.
- **Nav item active**: `--accent-tint-strong` background + `--accent` text + a 2px accent left indicator inside the rail (rail affordance, not a card side-stripe).

## Bans (enforced)

No side-stripe accent borders on cards/list items, no gradient text, no decorative glassmorphism, no hero-metric template, no identical card grids, no modal-first, no em dashes in UI copy, no pure `#000`/`#fff`.
