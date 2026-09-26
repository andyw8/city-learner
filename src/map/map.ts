import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { City } from '../deck/cities'
import { basemapStyle } from './style'

let configured = false

function configureMaplibre(): void {
  if (configured) return
  setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`)
  configured = true
}

export async function createMap(container: HTMLElement, city: City): Promise<MapLibreMap> {
  configureMaplibre()

  const map = new MapLibreMap({
    container,
    style: await basemapStyle(),
    center: city.center,
    zoom: city.zoom,
    minZoom: 9,
    maxZoom: 17,
  })

  map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  map.touchZoomRotate.disableRotation()

  return map
}
