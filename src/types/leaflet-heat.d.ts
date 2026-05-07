// Type declarations for leaflet.heat (no official @types package)
declare module "leaflet.heat" {
  const value: unknown
  export default value
}

declare module "leaflet" {
  function heatLayer(
    latlngs: [number, number, number?][],
    options?: {
      minOpacity?: number
      maxZoom?: number
      max?: number
      radius?: number
      blur?: number
      gradient?: Record<string, string>
    }
  ): Layer
}
