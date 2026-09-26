import type { Map as MapLibreMap } from 'maplibre-gl'

export function setLabelsVisible(map: MapLibreMap, visible: boolean): void {
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol') {
      map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none')
    }
  }
}
