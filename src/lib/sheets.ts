import type { SheetData, SheetTab, DriveFile } from "@/types"

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets"
const DRIVE_BASE = "https://www.googleapis.com/drive/v3"

export async function fetchSheetData(
  spreadsheetId: string,
  range: string,
  accessToken: string
): Promise<SheetData> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Error HTTP ${res.status}`)
  }

  const data = await res.json()
  const values: string[][] = data.values ?? []
  if (values.length === 0) return { headers: [], rows: [] }

  const headers = values[0]
  const rows = values.slice(1).map((row) =>
    headers.map((_, i) => {
      const cell = row[i]
      if (cell === undefined || cell === "") return null
      // Handle Argentine number format (1.234,56 → 1234.56)
      // Only strip thousand-separator dots when a comma is also present;
      // plain decimal values like "-34.6201" must NOT have their dot removed.
      const normalized = cell.includes(",")
        ? cell.replace(/\./g, "").replace(",", ".")
        : cell
      const num = Number(normalized)
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
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Error HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.sheets.map(
    (s: { properties: { sheetId: number; title: string } }) => ({
      id: s.properties.sheetId,
      title: s.properties.title,
    })
  )
}

export async function fetchDriveFolder(
  folderId: string,
  accessToken: string
): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime)")
  const url = `${DRIVE_BASE}/files?q=${q}&fields=${fields}&pageSize=100&orderBy=name`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Error Drive ${res.status}`)
  }

  const data = await res.json()
  return (data.files ?? []) as DriveFile[]
}
