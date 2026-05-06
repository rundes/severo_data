import DiagnosticoContent from "@/components/dashboard/DiagnosticoContent"

export default function DiagnosticoPage() {
  const sheetId = process.env.NEXT_PUBLIC_SHEET_MAIN_ID ?? "1rN-b37nqFm9ymiIf8YwmutUAYz_6ukwZXRPzFtsayxQ"
  return <DiagnosticoContent sheetId={sheetId} />
}
