import RelevamientoContent from "@/components/dashboard/RelevamientoContent"

export default function RelevamientoPage() {
  const sheetId =
    process.env.NEXT_PUBLIC_SHEET2_ID ?? "1qzLuz42e3GZ0yXf_z-wjpAQJP6rGsCVTgg-whZSt2UA"

  return <RelevamientoContent sheetId={sheetId} />
}
