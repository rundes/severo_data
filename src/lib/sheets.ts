import type { SheetData, SheetTab } from "@/types"

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets"

export async function fetchSheetData(
  spreadsheetId: string,
  range: string,
  accessToken: string
): Promise<SheetData> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  const values: string[][] = data.values ?? []
  if (values.length === 0) return { headers: [], rows: [] }

  const headers = values[0]
  const rows = values.slice(1).map((row) =>
    headers.map((_, i) => {
      const cell = row[i]
      if (cell === undefined || cell === "") return null
      const num = Number(cell.replace(/\./g, "").replace(",", "."))
      return isNaN(num) ? cell : num
    })
  )

  return { headers, rows }
}

export async function fetchSheetTabs(
  spreadsheetId: string,
  accessToken: string
): Promise<SheetTab[]> {
  const url = `${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.sheets.map(
    (s: { properties: { sheetId: number; title: string } }) => ({
      id: s.properties.sheetId,
      title: s.properties.title,
    })
  )
}
