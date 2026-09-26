import { describe, expect, it } from 'vitest'
import { candidateFromElement, normalizeName, type NormaliseOptions } from '../../scripts/lib/normalise.ts'
import type { OsmElement } from '../../scripts/lib/overpass.ts'

const options: NormaliseOptions = {
  precision: 6,
  simplifyToleranceM: 1,
  bbox: [-80, 43, -79, 44],
  stripDirectional: true,
}

const square = [
  { lat: 43.64, lon: -79.38 },
  { lat: 43.64, lon: -79.379 },
  { lat: 43.641, lon: -79.379 },
  { lat: 43.641, lon: -79.38 },
  { lat: 43.64, lon: -79.38 },
]

describe('candidateFromElement', () => {
  it('turns a node into a point', () => {
    const element: OsmElement = { type: 'node', id: 1, lat: 43.64, lon: -79.38, tags: { name: 'CN Tower' } }
    const candidate = candidateFromElement(element, 'landmark', options)
    expect(candidate?.feature.geometry.type).toBe('Point')
    expect(candidate?.feature.id).toBe('osm:node/1')
  })

  it('turns a closed way into a polygon', () => {
    const element: OsmElement = { type: 'way', id: 2, geometry: square, tags: { name: 'Grenadier Pond' } }
    const candidate = candidateFromElement(element, 'water', options)
    expect(candidate?.feature.geometry.type).toBe('Polygon')
    expect(candidate?.isPolygon).toBe(true)
  })

  it('keeps closed roads as lines', () => {
    const element: OsmElement = { type: 'way', id: 3, geometry: square, tags: { name: 'Loop Road' } }
    const candidate = candidateFromElement(element, 'road', options)
    expect(candidate?.feature.geometry.type).toBe('LineString')
  })

  it('records a category-specific noun', () => {
    const road: OsmElement = {
      type: 'way',
      id: 6,
      geometry: [
        { lat: 43.64, lon: -79.38 },
        { lat: 43.65, lon: -79.38 },
      ],
      tags: { name: 'Bathurst Street', highway: 'secondary' },
    }
    expect(candidateFromElement(road, 'road', options)?.feature.noun).toBe('secondary road')

    const river: OsmElement = {
      type: 'way',
      id: 7,
      geometry: [
        { lat: 43.64, lon: -79.38 },
        { lat: 43.65, lon: -79.38 },
      ],
      tags: { name: 'Don River', waterway: 'river' },
    }
    expect(candidateFromElement(river, 'water', options)?.feature.noun).toBe('river')
  })

  it('skips elements without a name', () => {
    const element: OsmElement = { type: 'node', id: 4, lat: 43.64, lon: -79.38 }
    expect(candidateFromElement(element, 'landmark', options)).toBeNull()
  })

  it('assembles relation members into a ring', () => {
    const element: OsmElement = {
      type: 'relation',
      id: 5,
      tags: { name: 'Toronto Islands' },
      members: [
        { type: 'way', ref: 1, role: 'outer', geometry: [{ lat: 43.6, lon: -79.4 }, { lat: 43.6, lon: -79.3 }] },
        { type: 'way', ref: 2, role: 'outer', geometry: [{ lat: 43.6, lon: -79.3 }, { lat: 43.61, lon: -79.3 }] },
        { type: 'way', ref: 3, role: 'outer', geometry: [{ lat: 43.61, lon: -79.3 }, { lat: 43.61, lon: -79.4 }] },
        { type: 'way', ref: 4, role: 'outer', geometry: [{ lat: 43.61, lon: -79.4 }, { lat: 43.6, lon: -79.4 }] },
      ],
    }
    const candidate = candidateFromElement(element, 'water', options)
    expect(candidate?.feature.geometry.type).toBe('Polygon')
  })
})

describe('normalizeName', () => {
  it('strips a trailing direction when asked', () => {
    expect(normalizeName('Bloor Street West', true)).toBe('bloor street')
    expect(normalizeName('Bloor Street West', false)).toBe('bloor street west')
  })
})
