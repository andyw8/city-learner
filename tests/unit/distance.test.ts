import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOLERANCE_M,
  checkLocate,
  distanceToGeometry,
  haversine,
  toleranceFor,
} from '../../src/deck/distance'
import type { Feature, Geometry, Position } from '../../src/deck/types'

const cnTower: Position = [-79.3871, 43.6426]
const rom: Position = [-79.3948, 43.6677]

function feature(overrides: Partial<Feature>): Feature {
  return {
    id: 'f',
    name: 'F',
    aliases: [],
    category: 'landmark',
    description: '',
    geometry: { type: 'Point', coordinates: [0, 0] },
    ...overrides,
  }
}

describe('haversine', () => {
  it('measures a known distance within a few percent', () => {
    expect(haversine(cnTower, rom)).toBeGreaterThan(2700)
    expect(haversine(cnTower, rom)).toBeLessThan(3000)
  })

  it('is zero for the same point and symmetric', () => {
    expect(haversine(cnTower, cnTower)).toBe(0)
    expect(haversine(cnTower, rom)).toBeCloseTo(haversine(rom, cnTower), 6)
  })
})

describe('distanceToGeometry', () => {
  it('measures point distance', () => {
    const geometry: Geometry = { type: 'Point', coordinates: rom }
    expect(distanceToGeometry(cnTower, geometry)).toBeCloseTo(haversine(cnTower, rom), 6)
  })

  it('measures perpendicular distance to a line', () => {
    const geometry: Geometry = {
      type: 'LineString',
      coordinates: [
        [-79.4, 43.65],
        [-79.38, 43.65],
      ],
    }
    const near: Position = [-79.39, 43.6505]
    expect(distanceToGeometry(near, geometry)).toBeLessThan(100)

    const far: Position = [-79.39, 43.7]
    expect(distanceToGeometry(far, geometry)).toBeGreaterThan(4000)
  })

  it('returns zero inside a polygon and a positive distance outside', () => {
    const geometry: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-79.4, 43.65],
          [-79.38, 43.65],
          [-79.38, 43.66],
          [-79.4, 43.66],
          [-79.4, 43.65],
        ],
      ],
    }
    expect(distanceToGeometry([-79.39, 43.655], geometry)).toBe(0)
    expect(distanceToGeometry([-79.39, 43.67], geometry)).toBeGreaterThan(500)
  })

  it('treats a point in a hole as outside', () => {
    const geometry: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-79.4, 43.65],
          [-79.38, 43.65],
          [-79.38, 43.66],
          [-79.4, 43.66],
          [-79.4, 43.65],
        ],
        [
          [-79.395, 43.653],
          [-79.385, 43.653],
          [-79.385, 43.657],
          [-79.395, 43.657],
          [-79.395, 43.653],
        ],
      ],
    }
    expect(distanceToGeometry([-79.39, 43.655], geometry)).toBeGreaterThan(0)
  })
})

describe('toleranceFor', () => {
  it('uses the category default', () => {
    expect(toleranceFor(feature({ category: 'road' }))).toBe(DEFAULT_TOLERANCE_M.road)
  })

  it('prefers an explicit tolerance', () => {
    expect(toleranceFor(feature({ category: 'road', toleranceM: 42 }))).toBe(42)
  })

  it('applies a per-category override', () => {
    expect(toleranceFor(feature({ category: 'road' }), { road: 999 })).toBe(999)
  })
})

describe('checkLocate', () => {
  it('is correct within the tolerance and incorrect beyond it', () => {
    const target = feature({
      category: 'landmark',
      geometry: { type: 'Point', coordinates: cnTower },
    })
    const close = checkLocate([-79.3873, 43.6427], target)
    expect(close.correct).toBe(true)

    const far = checkLocate([-79.42, 43.68], target)
    expect(far.correct).toBe(false)
  })

  it('honours a tolerance override', () => {
    const target = feature({
      category: 'landmark',
      geometry: { type: 'Point', coordinates: cnTower },
    })
    const click: Position = [-79.3873, 43.6427]
    expect(checkLocate(click, target, { landmark: 1 }).correct).toBe(false)
    expect(checkLocate(click, target, { landmark: 1000 }).correct).toBe(true)
  })
})
