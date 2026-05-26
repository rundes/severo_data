"use client"
import dynamic from "next/dynamic"

interface Point {
  x: number
  y: number
  label?: string
  colorKey?: string
  size?: number
}

interface Props {
  data: Point[]
  title: string
  subtitle?: string
  badge?: string
  colorMap?: Record<string, string>
  mode?: "scatter" | "heat" | "bubble"
  height?: number
}

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-surface rounded-md border border-hairline overflow-hidden">
      <div className="flex items-center justify-center h-[420px] text-ink-3 text-sm">
        Cargando mapa...
      </div>
    </div>
  ),
})

export default function LeafletMapWrapper(props: Props) {
  return <LeafletMap {...props} />
}
