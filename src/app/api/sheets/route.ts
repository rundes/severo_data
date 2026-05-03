import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { fetchSheetData, fetchSheetTabs } from "@/lib/sheets"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.accessToken) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Sesión expirada, por favor volvé a iniciar sesión" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sheetId = searchParams.get("sheetId")
  const range = searchParams.get("range") ?? "A:Z"
  const metaOnly = searchParams.get("meta") === "true"

  if (!sheetId) {
    return NextResponse.json({ error: "sheetId es requerido" }, { status: 400 })
  }

  try {
    if (metaOnly) {
      const sheets = await fetchSheetTabs(sheetId, session.accessToken)
      return NextResponse.json({ sheets })
    }

    const data = await fetchSheetData(sheetId, range, session.accessToken)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    const status = message.includes("403") || message.includes("404") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
