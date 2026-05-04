import PadronContent from "@/components/dashboard/PadronContent"

export default function PadronPage() {
  const sheetId =
    process.env.NEXT_PUBLIC_SHEET1_ID ?? "1CcxJyZOhfOS7ZxMbyZLZ1apjmMrpkAuMMsuqdtmlHUs"

  return <PadronContent sheetId={sheetId} />
}
