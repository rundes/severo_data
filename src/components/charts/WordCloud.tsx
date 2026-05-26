interface Word {
  text: string
  value: number
}

interface Props {
  words: Word[]
  /** Token color family for the words. */
  tone?: "accent" | "success" | "danger" | "ink"
  emptyLabel?: string
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  accent: "text-accent",
  success: "text-success",
  danger: "text-danger",
  ink: "text-ink",
}

const MIN_REM = 0.8125
const MAX_REM = 1.875

/**
 * Clean frequency tag-cloud: words sized and weighted by mention count, laid out
 * in tidy wrapped rows. Deliberately not a rotated/overlapping cloud, to fit the
 * editorial design system. Meaning is carried by size + the tone label, not hue alone.
 */
export default function WordCloud({ words, tone = "accent", emptyLabel = "Sin datos" }: Props) {
  if (!words.length) {
    return <p className="text-sm text-ink-4 italic">{emptyLabel}</p>
  }

  const max = words[0].value
  const min = words[words.length - 1].value
  const span = max - min || 1

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
      {words.map((w) => {
        const t = (w.value - min) / span // 0..1
        const sizeRem = MIN_REM + Math.sqrt(t) * (MAX_REM - MIN_REM)
        const weight = t > 0.6 ? 700 : t > 0.3 ? 600 : 500
        const opacity = 0.55 + t * 0.45
        return (
          <span
            key={w.text}
            className={`${TONE[tone]} leading-none tracking-tight`}
            style={{ fontSize: `${sizeRem.toFixed(3)}rem`, fontWeight: weight, opacity }}
            title={`${w.text}: ${w.value.toLocaleString("es-AR")} ${w.value === 1 ? "mención" : "menciones"}`}
          >
            {w.text}
          </span>
        )
      })}
    </div>
  )
}
