interface Props {
  message: string
  hint?: string
}

export default function ErrorState({ message, hint }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 max-w-md mx-auto text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-gray-800 font-semibold">Error al cargar datos</h3>
      <p className="text-gray-500 text-sm">{message}</p>
      <p className="text-gray-400 text-xs">
        {hint ?? "Asegurate de que la hoja sea accesible con tu cuenta de Google y recargá la página."}
      </p>
    </div>
  )
}
