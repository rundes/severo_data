interface Props {
  title: string
  value: number | string
  color: string
  subtitle?: string
  alert?: "ok" | "warn" | "danger"
  trend?: string
}

export default function KPICard({ title, value, color, subtitle, alert, trend }: Props) {
  const formatted =
    typeof value === "number" ? value.toLocaleString("es-AR") : value

  const alertBorder =
    alert === "danger" ? "border-l-4 border-l-red-400" :
    alert === "warn"   ? "border-l-4 border-l-amber-400" :
    alert === "ok"     ? "border-l-4 border-l-green-400" :
    ""

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1 ${alertBorder}`}>
      <div className="w-10 h-10 rounded-xl mb-2 opacity-20" style={{ backgroundColor: color }} />
      <p className="text-xs font-medium text-gray-500 leading-tight">{title}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold" style={{ color }}>{formatted}</p>
        {trend && (
          <span className={`text-xs font-semibold pb-0.5 ${
            trend.startsWith("+") ? "text-green-500" :
            trend.startsWith("−") || trend.startsWith("-") ? "text-red-500" :
            "text-gray-400"
          }`}>{trend}</span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      {alert === "danger" && (
        <p className="text-[10px] text-red-500 font-semibold mt-1">⚠ Atención requerida</p>
      )}
      {alert === "warn" && (
        <p className="text-[10px] text-amber-500 font-semibold mt-1">↗ Por mejorar</p>
      )}
    </div>
  )
}
