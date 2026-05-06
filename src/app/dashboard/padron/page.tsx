import PadronEnriquecidoContent from "@/components/dashboard/PadronEnriquecidoContent"

export default function PadronPage() {
  const sheetId     = process.env.NEXT_PUBLIC_SHEET_MAIN_ID ?? "1rN-b37nqFm9ymiIf8YwmutUAYz_6ukwZXRPzFtsayxQ"
  const votoSheetId = process.env.NEXT_PUBLIC_SHEET_VOTO_ID ?? "1DtROntjZ0FqZxvbikb30N_fcagHbFf18PVTOONB9Xlo"

  return <PadronEnriquecidoContent sheetId={sheetId} votoSheetId={votoSheetId} />
}
