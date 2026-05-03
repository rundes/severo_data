export default function LoadingSpinner({ label = "Cargando datos..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  )
}
