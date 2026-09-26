import { describe, expect, it } from 'vitest'
import { bboxOf, centerOf } from '../../src/deck/geometry'
import type { Geometry } from '../../src/deck/types'

describe('bboxOf', () => {
  it('returns the point itself for a Point', () => {
    const geometry: Geometry = { type: 'Point', coordinates: [-79.3871, 43.6426] }
    expect(bboxOf(geometry)).toEqual([-79.3871, 43.6426, -79.3871, 43.6426])
  })

  it('covers every vertex of a LineString', () => {
    const geometry: Geometry = {
      type: 'LineString',
      coordinates: [
        [-79.5, 43.6],
        [-79.3, 43.75],
        [-79.4, 43.7],
      ],
    }
    expect(bboxOf(geometry)).toEqual([-79.5, 43.6, -79.3, 43.75])
  })

  it('covers every line of a MultiLineString', () => {
    const geometry: Geometry = {
      type: 'MultiLineString',
      coordinates: [
        [
          [-79.5, 43.6],
          [-79.4, 43.65],
        ],
        [
          [-79.3, 43.75],
          [-79.35, 43.7],
        ],
      ],
    }
    expect(bboxOf(geometry)).toEqual([-79.5, 43.6, -79.3, 43.75])
  })

  it('covers all rings of a Polygon', () => {
    const geometry: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-79.42, 43.63],
          [-79.41, 43.63],
          [-79.41, 43.64],
          [-79.42, 43.63],
        ],
      ],
    }
    expect(bboxOf(geometry)).toEqual([-79.42, 43.63, -79.41, 43.64])
  })
})

describe('centerOf', () => {
  it('returns the middle of the bounding box', () => {
    const geometry: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-79.42, 43.63],
          [-79.41, 43.63],
          [-79.41, 43.65],
          [-79.42, 43.65],
          [-79.42, 43.63],
        ],
      ],
    }
    const center = centerOf(geometry)
    expect(center[0]).toBeCloseTo(-79.415, 10)
    expect(center[1]).toBeCloseTo(43.64, 10)
  })
})
