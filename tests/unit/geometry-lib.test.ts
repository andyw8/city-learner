import { describe, expect, it } from 'vitest'
import {
  clipGeometryToBbox,
  closeRing,
  lineLengthM,
  ringAreaM2,
  roundGeometry,
  simplifyLine,
  stitchLines,
} from '../../scripts/lib/geometry.ts'
import type { BBox, Geometry, Position } from '../../src/deck/types.ts'

describe('simplifyLine', () => {
  it('drops collinear points within the tolerance', () => {
    const coords: Position[] = [
      [0, 0],
      [0.001, 0],
      [0.002, 0],
    ]
    expect(simplifyLine(coords, 10)).toEqual([
      [0, 0],
      [0.002, 0],
    ])
  })

  it('keeps points that deviate more than the tolerance', () => {
    const coords: Position[] = [
      [0, 0],
      [0.001, 0.001],
      [0.002, 0],
    ]
    expect(simplifyLine(coords, 10)).toHaveLength(3)
  })
})

describe('ringAreaM2', () => {
  it('measures a unit square at Toronto latitudes', () => {
    const square: Position[] = [
      [-79.38, 43.64],
      [-79.379, 43.64],
      [-79.379, 43.641],
      [-79.38, 43.641],
      [-79.38, 43.64],
    ]
    const area = ringAreaM2(square)
    expect(area).toBeGreaterThan(8000)
    expect(area).toBeLessThan(10000)
  })
})

describe('lineLengthM', () => {
  it('sums geodesic segment lengths', () => {
    expect(lineLengthM([
      [-79.38, 43.64],
      [-79.379, 43.64],
    ])).toBeGreaterThan(80)
  })
})

describe('stitchLines', () => {
  it('joins segments that share endpoints', () => {
    const joined = stitchLines([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 0],
        [1, 1],
      ],
    ])
    expect(joined).toHaveLength(1)
    expect(joined[0]).toHaveLength(3)
  })

  it('extends the line at both ends regardless of seed order', () => {
    const joined = stitchLines([
      [
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
      ],
    ])
    expect(joined).toHaveLength(1)
    expect(joined[0]).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
  })

  it('keeps disconnected segments as separate lines', () => {
    const joined = stitchLines([
      [
        [0, 0],
        [0, 1],
      ],
      [
        [5, 5],
        [5, 6],
      ],
    ])
    expect(joined).toHaveLength(2)
  })
})

describe('clipGeometryToBbox', () => {
  const bbox: BBox = [-1, -1, 5, 5]

  it('trims a line to the box', () => {
    const line: Geometry = {
      type: 'LineString',
      coordinates: [
        [-10, -10],
        [10, 10],
      ],
    }
    const clipped = clipGeometryToBbox(line, bbox)
    expect(clipped?.type).toBe('LineString')
    if (clipped?.type === 'LineString') {
      for (const [lng, lat] of clipped.coordinates) {
        expect(lng).toBeGreaterThanOrEqual(-1)
        expect(lng).toBeLessThanOrEqual(5)
        expect(lat).toBeGreaterThanOrEqual(-1)
        expect(lat).toBeLessThanOrEqual(5)
      }
    }
  })

  it('drops a point outside the box', () => {
    expect(clipGeometryToBbox({ type: 'Point', coordinates: [10, 10] }, bbox)).toBeNull()
  })

  it('keeps a point inside the box', () => {
    expect(clipGeometryToBbox({ type: 'Point', coordinates: [0, 0] }, bbox)).not.toBeNull()
  })
})

describe('closeRing', () => {
  it('closes an open ring', () => {
    const ring = closeRing([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(ring).toHaveLength(4)
  })
})

describe('roundGeometry', () => {
  it('caps coordinate precision', () => {
    const geometry = roundGeometry({ type: 'Point', coordinates: [1.2345678, -2.3456789] }, 4)
    expect(geometry).toEqual({ type: 'Point', coordinates: [1.2346, -2.3457] })
  })
})
