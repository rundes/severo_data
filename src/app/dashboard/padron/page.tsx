import PadronEnriquecidoContent from "@/components/dashboard/PadronEnriquecidoContent"

export default function PadronPage() {
  const PADRON_SHEET = process.env.NEXT_PUBLIC_SHEET_PADRON_ID ?? "1QjhmHFpwL9J7io10v2Ie31avOFrMK4oGYf_zHTi82Vg"
  const sheetId     = PADRON_SHEET
  const votoSheetId = process.env.NEXT_PUBLIC_SHEET_VOTO_ID ?? PADRON_SHEET

  return <PadronEnriquecidoContent sheetId={sheetId} votoSheetId={votoSheetId} />
}
