interface Props {
  title: string
  badge?: "★ CORE" | "● QUICK WIN" | "◆ AVANZADO"
  description?: string
}

export default function SectionHeader({ title, badge, description }: Props) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
      </div>
      {badge && (
        <span className="text-[0.6875rem] px-2 py-0.5 rounded border border-hairline bg-panel text-ink-2 flex-shrink-0 font-medium tracking-wide">
          {badge}
        </span>
      )}
    </div>
  )
}
