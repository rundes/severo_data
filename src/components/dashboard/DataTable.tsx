"use client"

import { useState } from "react"

interface Props {
  headers: string[]
  rows: (string | number | null)[][]
}

const PAGE_SIZE = 10

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-gray-50">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Buscar en los datos..."
          className="w-full sm:max-w-xs text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-300 placeholder-gray-400"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Sin resultados
                </td>
              </tr>
            ) : (
              pageRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-50 transition-colors">
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap max-w-xs truncate">
                      {row[ci] !== null ? String(row[ci]) : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-50 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total} filas
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs"
            >
              ← Anterior
            </button>
            <span className="px-3 py-1.5 text-xs">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
