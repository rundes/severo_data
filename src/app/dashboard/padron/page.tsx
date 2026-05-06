import PadronEnriquecidoContent from "@/components/dashboard/PadronEnriquecidoContent"

export default function PadronPage() {
  const sheetId =
    process.env.NEXT_PUBLIC_SHEET3_ID ?? "1QjhmHFpwL9J7io10v2Ie31avOFrMK4oGYf_zHTi82Vg"

  return <PadronEnriquecidoContent sheetId={sheetId} />
}
