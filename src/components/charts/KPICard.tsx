interface Props {
  title: string
  value: number | string
  color: string
  subtitle?: string
}

export default function KPICard({ title, value, color, subtitle }: Props) {
  const formatted =
    typeof value === "number" ? value.toLocaleString("es-AR") : value

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1">
      <div
        className="w-10 h-10 rounded-xl mb-2 opacity-20"
        style={{ backgroundColor: color }}
      />
      <p className="text-xs font-medium text-gray-500 leading-tight">{title}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {formatted}
      </p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}
