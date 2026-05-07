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
      <span className="text-xs font-medium text-gray-500 mr-1 shrink-0">Barrio:</span>
      <button
        onClick={() => onChange("")}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
          !value
            ? "bg-sky-600 text-white border-sky-600"
            : "bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-700"
        }`}
      >
        Todos
      </button>
      {BARRIO_NAMES.map(name => (
        <button
          key={name}
          onClick={() => onChange(name === value ? "" : name)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
            value === name
              ? "bg-sky-600 text-white border-sky-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-700"
          }`}
        >
          {name.replace(/^Barrio\s+/i, "")}
        </button>
      ))}
    </div>
  )
}
