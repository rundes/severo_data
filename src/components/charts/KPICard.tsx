interface Props {
  title: string
  value: number | string
  /** Accepted for call-site compatibility; metrics render in ink per DESIGN.md. */
  color?: string
  subtitle?: string
  alert?: "ok" | "warn" | "danger"
  trend?: string
}

function ArrowUp() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 9.5V2.5M6 2.5L2.75 5.75M6 2.5l3.25 3.25" />
    </svg>
  )
}
function ArrowDown() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 2.5v7M6 9.5L2.75 6.25M6 9.5l3.25-3.25" />
    </svg>
  )
}

function AlertChip({ tone, label }: { tone: "warn" | "danger"; label: string }) {
  const cls = tone === "danger" ? "text-danger bg-danger-tint" : "text-warn bg-warn-tint"
  return (
    <span className={`inline-flex items-center gap-1 w-fit mt-1 px-1.5 py-0.5 rounded text-[0.6875rem] font-medium ${cls}`}>
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M6 1.5l4.5 8h-9l4.5-8zM6 5v2M6 8.5h.01" />
      </svg>
      {label}
    </span>
  )
}

export default function KPICard({ title, value, subtitle, alert, trend }: Props) {
  const formatted =
    typeof value === "number" ? value.toLocaleString("es-AR") : value

  const up = trend?.startsWith("+")
  const down = trend?.startsWith("−") || trend?.startsWith("-")

  return (
    <div className="rounded-md border border-hairline bg-surface px-4 py-3.5 flex flex-col gap-1">
      <p className="text-[0.6875rem] uppercase tracking-wide text-ink-3 leading-tight">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-ink tnum leading-none">{formatted}</p>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tnum ${
            up ? "text-success" : down ? "text-danger" : "text-ink-3"
          }`}>
            {up && <ArrowUp />}
            {down && <ArrowDown />}
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
      {alert === "danger" && <AlertChip tone="danger" label="Atención requerida" />}
      {alert === "warn" && <AlertChip tone="warn" label="Por mejorar" />}
    </div>
  )
}
