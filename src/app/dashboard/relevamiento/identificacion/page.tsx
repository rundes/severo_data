import IdentificacionContent from "@/components/dashboard/IdentificacionContent"

export default function IdentificacionPage() {
  const sheetId = process.env.NEXT_PUBLIC_SHEET_MAIN_ID ?? "1rN-b37nqFm9ymiIf8YwmutUAYz_6ukwZXRPzFtsayxQ"
  return <IdentificacionContent sheetId={sheetId} />
}
