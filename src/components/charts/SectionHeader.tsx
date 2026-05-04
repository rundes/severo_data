const BADGE_STYLES: Record<string, string> = {
  "★ CORE": "bg-red-50 text-red-700 border-red-200",
  "● QUICK WIN": "bg-sky-50 text-sky-700 border-sky-200",
  "◆ AVANZADO": "bg-purple-50 text-purple-700 border-purple-200",
}

interface Props {
  title: string
  badge?: "★ CORE" | "● QUICK WIN" | "◆ AVANZADO"
  description?: string
}

export default function SectionHeader({ title, badge, description }: Props) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-1">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      {badge && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 font-medium ${BADGE_STYLES[badge]}`}
        >
          {badge}
        </span>
      )}
    </div>
  )
}
