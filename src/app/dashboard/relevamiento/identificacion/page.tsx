import IdentificacionContent from "@/components/dashboard/IdentificacionContent"

export default function IdentificacionPage() {
  const sheetId = process.env.NEXT_PUBLIC_SHEET_RELEVAMIENTO_ID ?? "1qzLuz42e3GZ0yXf_z-wjpAQJP6rGsCVTgg-whZSt2UA"
  return <IdentificacionContent sheetId={sheetId} />
}
