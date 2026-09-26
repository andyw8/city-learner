import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Deck, Mode } from './deck/types'

declare global {
  interface Window {
    cityLearner?: {
      map: MapLibreMap
      deck?: Deck
      current?: { featureId: string; mode: Mode }
    }
  }
}

export {}
