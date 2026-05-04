import DiagnosticoContent from "@/components/dashboard/DiagnosticoContent"

export default function DiagnosticoPage() {
  const sheetId =
    process.env.NEXT_PUBLIC_SHEET2_ID ?? "1qzLuz42e3GZ0yXf_z-wjpAQJP6rGsCVTgg-whZSt2UA"

  return <DiagnosticoContent sheetId={sheetId} />
}
