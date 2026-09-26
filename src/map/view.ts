import { LngLatBounds } from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { bboxOf } from '../deck/geometry'
import type { Deck } from '../deck/types'

export function fitDeck(map: MapLibreMap, deck: Deck): void {
  const bounds = new LngLatBounds()

  for (const feature of deck.features) {
    const [minLng, minLat, maxLng, maxLat] = bboxOf(feature.geometry)
    bounds.extend([minLng, minLat])
    bounds.extend([maxLng, maxLat])
  }

  map.fitBounds(bounds, { padding: 40, duration: 0 })
}
