import { describe, expect, it } from 'vitest'
import { applyManual, selectFeatures, type CategoryRule } from '../../scripts/lib/curate.ts'
import { lineLengthM } from '../../scripts/lib/geometry.ts'
import { normalizeName, type Candidate } from '../../scripts/lib/normalise.ts'
import type { Feature, Geometry, Position } from '../../src/deck/types.ts'

function candidate(name: string, coordinates: Position[], wikidata: string | null = null): Candidate {
  const geometry: Geometry = { type: 'LineString', coordinates }
  const feature: Feature = {
    id: `osm:way/${name}`,
    name,
    aliases: [],
    category: 'road',
    description: '',
    geometry,
  }
  return {
    feature,
    nameKey: normalizeName(name, true),
    wikidata,
    sizeM: lineLengthM(coordinates),
    lineCoords: coordinates,
    isPolygon: false,
  }
}

const rule: CategoryRule = {
  query: '',
  merge: 'longest-line',
  max: 10,
  minLengthM: 0,
  stripDirectional: true,
}

describe('selectFeatures', () => {
  it('merges a street split by direction into one feature', () => {
    const { features } = selectFeatures(
      [candidate('Bloor Street West', [[-79.4, 43.66], [-79.38, 43.66]]), candidate('Bloor Street East', [[-79.38, 43.66], [-79.36, 43.66]])],
      rule,
      {},
      'road',
    )
    expect(features).toHaveLength(1)
    expect(features[0]?.name).toBe('Bloor Street')
    expect(features[0]?.aliases).toEqual(['Bloor Street East', 'Bloor Street West'])
    expect(features[0]?.geometry.type).toBe('MultiLineString')
  })

  it('keeps disconnected runs of the same street', () => {
    const { features } = selectFeatures(
      [
        candidate('Bathurst Street', [[-79.43, 43.67], [-79.43, 43.68]]),
        candidate('Bathurst Street', [[-79.43, 43.7], [-79.43, 43.71]]),
      ],
      rule,
      {},
      'road',
    )
    const geometry = features[0]?.geometry
    expect(geometry?.type).toBe('MultiLineString')
    if (geometry?.type === 'MultiLineString') {
      expect(geometry.coordinates).toHaveLength(2)
    }
  })

  it('forces included names past the size filter', () => {
    const short = candidate('Yonge Street', [[-79.38, 43.64], [-79.379, 43.64]])
    const { features, missingInclude } = selectFeatures(
      [short],
      { ...rule, minLengthM: 100000 },
      { include: { road: ['Yonge Street'] } },
      'road',
    )
    expect(features.map((feature) => feature.name)).toEqual(['Yonge Street'])
    expect(missingInclude).toEqual([])
  })

  it('reports include names that are missing', () => {
    const { missingInclude } = selectFeatures([], rule, { include: { road: ['Nowhere Road'] } }, 'road')
    expect(missingInclude).toEqual(['Nowhere Road'])
  })

  it('drops excluded names', () => {
    const { features } = selectFeatures(
      [candidate('Bloor Street West', [[-79.4, 43.66], [-79.38, 43.66]])],
      rule,
      { exclude: { road: ['Bloor Street West'] } },
      'road',
    )
    expect(features).toEqual([])
  })

  it('caps the automatic features', () => {
    const candidates = Array.from({ length: 5 }, (_, index) =>
      candidate(`Street ${index}`, [[-79.4, 43.6 + index * 0.01], [-79.39, 43.6 + index * 0.01]]),
    )
    expect(selectFeatures(candidates, { ...rule, max: 3 }, {}, 'road').features).toHaveLength(3)
  })
})

describe('applyManual', () => {
  const base: Feature = {
    id: 'osm:way/bloor',
    name: 'Bloor Street',
    aliases: [],
    category: 'road',
    description: 'A road.',
    geometry: { type: 'LineString', coordinates: [[-79.4, 43.66], [-79.38, 43.66]] },
  }

  it('patches a generated feature by name', () => {
    const { features, unmatched } = applyManual([base], [
      { name: 'Bloor Street', category: 'road', description: 'Mink Mile.', aliases: ['Bloor'] },
    ])
    expect(features[0]?.description).toBe('Mink Mile.')
    expect(features[0]?.aliases).toEqual(['Bloor'])
    expect(unmatched).toEqual([])
  })

  it('adds a manual feature with geometry', () => {
    const { features } = applyManual([base], [
      {
        name: 'Lake Ontario',
        category: 'water',
        geometry: { type: 'Point', coordinates: [-79.38, 43.6] },
      },
    ])
    expect(features.map((feature) => feature.name)).toContain('Lake Ontario')
  })

  it('reports manual entries that match nothing', () => {
    const { unmatched } = applyManual([base], [{ name: 'Ghost Road', category: 'road', description: 'x' }])
    expect(unmatched).toEqual(['Ghost Road'])
  })
})
