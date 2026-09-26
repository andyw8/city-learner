import { layers, namedFlavor } from '@protomaps/basemaps'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

export const BASEMAP_SOURCE = 'protomaps'

export const BASEMAP_URL = '/tiles/toronto.pmtiles'

export const BASEMAP_ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>'

const GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf'

const SPRITE_URL = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light'

export function basemapLayers(): LayerSpecification[] {
  return layers(BASEMAP_SOURCE, namedFlavor('light'), { lang: 'en' }).map((layer) =>
    layer.type === 'symbol'
      ? { ...layer, layout: { ...layer.layout, visibility: 'none' } }
      : layer,
  )
}

export function basemapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: SPRITE_URL,
    sources: {
      [BASEMAP_SOURCE]: {
        type: 'vector',
        url: `pmtiles://${BASEMAP_URL}`,
        attribution: BASEMAP_ATTRIBUTION,
      },
    },
    layers: basemapLayers(),
  }
}
