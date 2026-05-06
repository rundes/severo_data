import ProblematicasContent from "@/components/dashboard/ProblematicasContent"

export default function ProblematicasPage() {
  const sheetId = process.env.NEXT_PUBLIC_SHEET_MAIN_ID ?? "1rN-b37nqFm9ymiIf8YwmutUAYz_6ukwZXRPzFtsayxQ"
  return <ProblematicasContent sheetId={sheetId} />
}
