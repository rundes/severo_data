export default function LoadingSpinner({ label = "Cargando datos..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-hairline-strong border-t-accent rounded-full animate-spin" />
      <p className="text-ink-3 text-sm">{label}</p>
    </div>
  )
}
