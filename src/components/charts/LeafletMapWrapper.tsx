"use client"
import dynamic from "next/dynamic"

interface Point {
  x: number
  y: number
  label?: string
  colorKey?: string
}

interface Props {
  data: Point[]
  title: string
  subtitle?: string
  badge?: string
  colorMap?: Record<string, string>
  mode?: "scatter" | "heat"
  height?: number
}

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-center h-[420px] text-gray-400 text-sm">
        Cargando mapa...
      </div>
    </div>
  ),
})

export default function LeafletMapWrapper(props: Props) {
  return <LeafletMap {...props} />
}
