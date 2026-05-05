import IndicadoresContent from "@/components/dashboard/IndicadoresContent"

export default function IndicadoresPage() {
  const sheetId =
    process.env.NEXT_PUBLIC_SHEET3_ID ?? "1QjhmHFpwL9J7io10v2Ie31avOFrMK4oGYf_zHTi82Vg"

  return <IndicadoresContent sheetId={sheetId} />
}
