import OperacionContent from "@/components/dashboard/OperacionContent"

export default function OperacionPage() {
  const sheetId = process.env.NEXT_PUBLIC_SHEET_RELEVAMIENTO_ID ?? "1qzLuz42e3GZ0yXf_z-wjpAQJP6rGsCVTgg-whZSt2UA"
  return <OperacionContent sheetId={sheetId} />
}
