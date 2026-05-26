"use client"

import { BARRIO_NAMES } from "@/lib/barriosGeo"

interface Props {
  value: string
  onChange: (barrio: string) => void
  className?: string
}

export default function BarrioFilter({ value, onChange, className = "" }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-ink-3 mr-1 shrink-0">Barrio:</span>
      <button
        onClick={() => onChange("")}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
          !value
            ? "bg-accent text-accent-fg border-accent"
            : "bg-surface text-ink-2 border-hairline hover:border-accent hover:text-accent"
        }`}
      >
        Todos
      </button>
      {BARRIO_NAMES.map(name => (
        <button
          key={name}
          onClick={() => onChange(name === value ? "" : name)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
            value === name
              ? "bg-accent text-accent-fg border-accent"
              : "bg-surface text-ink-2 border-hairline hover:border-accent hover:text-accent"
          }`}
        >
          {name.replace(/^Barrio\s+/i, "")}
        </button>
      ))}
    </div>
  )
}
