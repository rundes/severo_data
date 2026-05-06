import PadronEnriquecidoContent from "@/components/dashboard/PadronEnriquecidoContent"

export default function PadronPage() {
  const sheetId =
    process.env.NEXT_PUBLIC_SHEET1_ID ?? "1CcxJyZOhfOS7ZxMbyZLZ1apjmMrpkAuMMsuqdtmlHUs"

  return <PadronEnriquecidoContent sheetId={sheetId} />
}
