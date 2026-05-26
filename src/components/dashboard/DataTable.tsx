"use client"

import { useState } from "react"
import { driveThumbUrl } from "@/lib/columnMatcher"

interface Props {
  headers: string[]
  rows: (string | number | null)[][]
}

const PAGE_SIZE = 10

function CellValue({ value }: { value: string | number | null }) {
  if (value === null || value === undefined) return <span className="text-ink-4">—</span>
  const s = String(value).trim()
  const imgSrc = driveThumbUrl(s, 80)
  if (imgSrc) {
    return (
      <a href={s} target="_blank" rel="noopener noreferrer" title="Ver imagen completa">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt="foto"
          className="w-12 h-12 object-cover rounded-md border border-hairline hover:scale-110 transition-transform cursor-pointer"
          onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          loading="lazy"
        />
      </a>
    )
  }
  return <span className="whitespace-nowrap max-w-xs truncate block">{s}</span>
}

export default function DataTable({ headers, rows }: Props) {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")

  const filtered = search
    ? rows.filter((row) =>
        row.some((cell) => String(cell ?? "").toLowerCase().includes(search.toLowerCase()))
      )
    : rows

  const total = filtered.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="bg-surface rounded-md border border-hairline overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-hairline">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Buscar en los datos..."
          className="w-full sm:max-w-xs text-sm px-3 py-2 rounded-md bg-paper border border-hairline text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-shadow"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-panel">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="sticky top-0 bg-panel px-4 py-2.5 text-left text-[0.6875rem] font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-ink-3 text-sm">
                  Sin resultados
                </td>
              </tr>
            ) : (
              pageRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-accent-tint transition-colors">
                  {headers.map((_, ci) => {
                    const isNum = typeof row[ci] === "number"
                    return (
                      <td
                        key={ci}
                        className={`px-4 py-2.5 text-sm text-ink-2 ${isNum ? "text-right tnum" : ""}`}
                      >
                        <CellValue value={row[ci]} />
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-hairline flex flex-wrap items-center justify-between gap-3 text-sm text-ink-3">
          <span className="tnum">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total} filas
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-hairline rounded-md text-ink-2 disabled:opacity-40 enabled:hover:bg-panel transition-colors text-xs"
            >
              ← Anterior
            </button>
            <span className="px-3 py-1.5 text-xs tnum text-ink-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-hairline rounded-md text-ink-2 disabled:opacity-40 enabled:hover:bg-panel transition-colors text-xs"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
