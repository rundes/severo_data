import DashboardContent from "@/components/dashboard/DashboardContent"

export default function DashboardPage() {
  const sheetId =
    process.env.NEXT_PUBLIC_SHEET1_ID ?? "1CcxJyZOhfOS7ZxMbyZLZ1apjmMrpkAuMMsuqdtmlHUs"

  return (
    <DashboardContent
      sheetId={sheetId}
      title="Dashboard Principal"
      description="Datos vinculados a Google Sheets · actualización bajo demanda"
    />
  )
}
