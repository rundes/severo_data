import OperacionContent from "@/components/dashboard/OperacionContent"

export default function OperacionPage() {
  const sheetId = process.env.NEXT_PUBLIC_SHEET_MAIN_ID ?? "1rN-b37nqFm9ymiIf8YwmutUAYz_6ukwZXRPzFtsayxQ"
  return <OperacionContent sheetId={sheetId} />
}
