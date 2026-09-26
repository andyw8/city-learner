import { Map as MapLibreMap, addProtocol, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createPmtilesProtocol } from './pmtiles'
import { basemapStyle } from './style'

export const TORONTO_CENTER: [number, number] = [-79.3832, 43.6532]

let configured = false

function configureMaplibre(): void {
  if (configured) return
  addProtocol('pmtiles', createPmtilesProtocol().tile)
  setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`)
  configured = true
}

export function createMap(container: HTMLElement): MapLibreMap {
  configureMaplibre()

  return new MapLibreMap({
    container,
    style: basemapStyle(),
    center: TORONTO_CENTER,
    zoom: 11,
    minZoom: 9,
    maxZoom: 17,
  })
}
