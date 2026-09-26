import type { Feature as GeoJSONFeature, FeatureCollection } from 'geojson'
import type { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { bboxOf } from '../deck/geometry'
import type { Feature, Position } from '../deck/types'

const SOURCE_ID = 'highlight'
const FILL_ID = 'highlight-fill'
const LINE_ID = 'highlight-line'
const POINT_ID = 'highlight-point'

const GUESS_SOURCE_ID = 'guess'
const GUESS_POINT_ID = 'guess-point'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

function toGeoJSON(feature: Feature): GeoJSONFeature {
  return { type: 'Feature', properties: {}, geometry: feature.geometry }
}

export function addHighlightLayers(map: MapLibreMap): void {
  map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY })

  map.addLayer({
    id: FILL_ID,
    type: 'fill',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#e63946', 'fill-opacity': 0.25 },
  })

  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['!=', ['geometry-type'], 'Point'],
    paint: { 'line-color': '#e63946', 'line-width': 4, 'line-opacity': 0.9 },
  })

  map.addLayer({
    id: POINT_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 8,
      'circle-color': '#e63946',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
}

export function addGuessLayer(map: MapLibreMap): void {
  map.addSource(GUESS_SOURCE_ID, { type: 'geojson', data: EMPTY })

  map.addLayer({
    id: GUESS_POINT_ID,
    type: 'circle',
    source: GUESS_SOURCE_ID,
    paint: {
      'circle-radius': 9,
      'circle-color': ['case', ['get', 'correct'], '#2a9d2a', '#d33'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
}

export function setHighlight(map: MapLibreMap, feature: Feature): void {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
  if (!source) throw new Error(`Missing ${SOURCE_ID} source`)
  source.setData(toGeoJSON(feature))
}

export function clearHighlight(map: MapLibreMap): void {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
  if (!source) throw new Error(`Missing ${SOURCE_ID} source`)
  source.setData(EMPTY)
}

export function setGuess(map: MapLibreMap, point: Position, correct: boolean): void {
  const source = map.getSource(GUESS_SOURCE_ID) as GeoJSONSource | undefined
  if (!source) throw new Error(`Missing ${GUESS_SOURCE_ID} source`)
  source.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { correct },
        geometry: { type: 'Point', coordinates: point },
      },
    ],
  })
}

export function clearGuess(map: MapLibreMap): void {
  const source = map.getSource(GUESS_SOURCE_ID) as GeoJSONSource | undefined
  if (!source) throw new Error(`Missing ${GUESS_SOURCE_ID} source`)
  source.setData(EMPTY)
}

export function focusFeature(map: MapLibreMap, feature: Feature): void {
  if (feature.geometry.type === 'Point') {
    map.flyTo({ center: feature.geometry.coordinates, zoom: 14 })
    return
  }

  const [minLng, minLat, maxLng, maxLat] = bboxOf(feature.geometry)
  const bounds: LngLatBoundsLike = [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
  map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 0 })
}
