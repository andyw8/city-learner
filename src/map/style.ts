import { layers, namedFlavor } from '@protomaps/basemaps'
import type { StyleSpecification } from 'maplibre-gl'

export const BASEMAP_SOURCE = 'protomaps'

export const BASEMAP_URL = '/tiles/toronto.pmtiles'

export const BASEMAP_ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>'

export function basemapStyle(): StyleSpecification {
  const baseLayers = layers(BASEMAP_SOURCE, namedFlavor('light'), { lang: 'en' })
    .filter((layer) => layer.type !== 'symbol')

  return {
    version: 8,
    sources: {
      [BASEMAP_SOURCE]: {
        type: 'vector',
        url: `pmtiles://${BASEMAP_URL}`,
        attribution: BASEMAP_ATTRIBUTION,
      },
    },
    layers: baseLayers,
  }
}
