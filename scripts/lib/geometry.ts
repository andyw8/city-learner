import type { BBox, Geometry, Position } from '../../src/deck/types.ts'

const METERS_PER_DEG_LAT = 110574
const METERS_PER_DEG_LNG = 111320
const EARTH_RADIUS_M = 6371000

export function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

export function distanceM(a: Position, b: Position): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function lineLengthM(coords: Position[]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]
    const b = coords[i]
    if (a && b) total += distanceM(a, b)
  }
  return total
}

export function ringAreaM2(ring: Position[]): number {
  if (ring.length < 3) return 0
  const refLat = ring[0]?.[1] ?? 0
  const mPerLng = METERS_PER_DEG_LNG * Math.cos((refLat * Math.PI) / 180)
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    sum += a[0] * mPerLng * (b[1] * METERS_PER_DEG_LAT) - b[0] * mPerLng * (a[1] * METERS_PER_DEG_LAT)
  }
  return Math.abs(sum) / 2
}

export function geometrySizeM(geometry: Geometry): number {
  switch (geometry.type) {
    case 'Point':
      return 0
    case 'LineString':
      return lineLengthM(geometry.coordinates)
    case 'Polygon':
      return Math.sqrt(ringAreaM2(geometry.coordinates[0] ?? []))
  }
}

export function dedupeConsecutive(coords: Position[]): Position[] {
  return coords.filter((point, index) => index === 0 || !samePosition(point, coords[index - 1]!))
}

export function closeRing(coords: Position[]): Position[] {
  const deduped = dedupeConsecutive(coords)
  if (deduped.length < 3) return deduped
  if (!samePosition(deduped[0]!, deduped[deduped.length - 1]!)) deduped.push(deduped[0]!)
  return deduped
}

function project(point: Position, refLat: number): [number, number] {
  return [
    point[0] * METERS_PER_DEG_LNG * Math.cos((refLat * Math.PI) / 180),
    point[1] * METERS_PER_DEG_LAT,
  ]
}

export function simplifyLine(coords: Position[], toleranceM: number): Position[] {
  if (coords.length <= 2) return [...coords]
  const refLat = coords[0]![1]
  const projected = coords.map((point) => project(point, refLat))
  const keep = new Array<boolean>(coords.length).fill(false)
  keep[0] = true
  keep[coords.length - 1] = true

  const stack: [number, number][] = [[0, coords.length - 1]]
  while (stack.length > 0) {
    const [start, end] = stack.pop()!
    const a = projected[start]!
    const b = projected[end]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const span = Math.hypot(dx, dy)

    let farthest = -1
    let farthestIndex = -1
    for (let i = start + 1; i < end; i++) {
      const p = projected[i]!
      const distance =
        span === 0
          ? Math.hypot(p[0] - a[0], p[1] - a[1])
          : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / span
      if (distance > farthest) {
        farthest = distance
        farthestIndex = i
      }
    }

    if (farthest > toleranceM && farthestIndex > -1) {
      keep[farthestIndex] = true
      stack.push([start, farthestIndex], [farthestIndex, end])
    }
  }

  return coords.filter((_, index) => keep[index])
}

export function simplifyGeometry(geometry: Geometry, toleranceM: number): Geometry {
  switch (geometry.type) {
    case 'Point':
      return geometry
    case 'LineString': {
      const simplified = simplifyLine(geometry.coordinates, toleranceM)
      return {
        type: 'LineString',
        coordinates: simplified.length >= 2 ? simplified : geometry.coordinates,
      }
    }
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates.map((ring) => {
          const simplified = closeRing(simplifyLine(ring, toleranceM))
          return simplified.length >= 4 ? simplified : closeRing(ring)
        }),
      }
  }
}

type ClipEdge = { inside: (point: Position) => boolean; intersect: (a: Position, b: Position) => Position }

function clipEdges(bbox: BBox): ClipEdge[] {
  const [minLng, minLat, maxLng, maxLat] = bbox
  const at = (value: number, other: number): Position => [value, other]
  return [
    {
      inside: (p) => p[0] >= minLng,
      intersect: (a, b) => at(minLng, a[1] + ((minLng - a[0]) / (b[0] - a[0])) * (b[1] - a[1])),
    },
    {
      inside: (p) => p[1] >= minLat,
      intersect: (a, b) => [a[0] + ((minLat - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), minLat],
    },
    {
      inside: (p) => p[0] <= maxLng,
      intersect: (a, b) => at(maxLng, a[1] + ((maxLng - a[0]) / (b[0] - a[0])) * (b[1] - a[1])),
    },
    {
      inside: (p) => p[1] <= maxLat,
      intersect: (a, b) => [a[0] + ((maxLat - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), maxLat],
    },
  ]
}

function clipRing(ring: Position[], edges: ClipEdge[]): Position[] {
  let output = ring
  for (const edge of edges) {
    const input = output
    output = []
    if (input.length === 0) break
    let previous = input[input.length - 1]!
    for (const current of input) {
      if (edge.inside(current)) {
        if (!edge.inside(previous)) output.push(edge.intersect(previous, current))
        output.push(current)
      } else if (edge.inside(previous)) {
        output.push(edge.intersect(previous, current))
      }
      previous = current
    }
  }
  return closeRing(output)
}

function clipSegment(a: Position, b: Position, bbox: BBox): [Position, Position] | null {
  const [minLng, minLat, maxLng, maxLat] = bbox
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let t0 = 0
  let t1 = 1

  const checks: [number, number][] = [
    [-dx, a[0] - minLng],
    [dx, maxLng - a[0]],
    [-dy, a[1] - minLat],
    [dy, maxLat - a[1]],
  ]

  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const r = q / p
    if (p < 0) {
      if (r > t1) return null
      if (r > t0) t0 = r
    } else {
      if (r < t0) return null
      if (r < t1) t1 = r
    }
  }

  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ]
}

export function stitchLines(segments: Position[][]): Position[][] {
  const used = segments.map(() => false)
  const lines: Position[][] = []
  const keyOf = (point: Position) => `${point[0].toFixed(7)},${point[1].toFixed(7)}`

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue
    used[i] = true
    const line = [...segments[i]!]
    let extended = true
    while (extended) {
      extended = false
      const end = keyOf(line[line.length - 1]!)
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue
        const segment = segments[j]!
        if (keyOf(segment[0]!) === end) {
          line.push(...segment.slice(1))
        } else if (keyOf(segment[segment.length - 1]!) === end) {
          line.push(...segment.slice(0, -1).reverse())
        } else {
          continue
        }
        used[j] = true
        extended = true
        break
      }
    }
    lines.push(line)
  }

  return lines
}

export function stitchRings(segments: Position[][]): Position[][] {
  return stitchLines(segments)
}

export function clipGeometryToBbox(geometry: Geometry, bbox: BBox): Geometry | null {
  const [minLng, minLat, maxLng, maxLat] = bbox
  switch (geometry.type) {
    case 'Point': {
      const [lng, lat] = geometry.coordinates
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return null
      return geometry
    }
    case 'LineString': {
      const pieces: Position[][] = []
      for (let i = 1; i < geometry.coordinates.length; i++) {
        const clipped = clipSegment(geometry.coordinates[i - 1]!, geometry.coordinates[i]!, bbox)
        if (clipped) pieces.push([clipped[0], clipped[1]])
      }
      const stitched = stitchLines(pieces)
      if (stitched.length === 0) return null
      const longest = stitched.reduce((a, b) => (lineLengthM(a) >= lineLengthM(b) ? a : b))
      return longest.length >= 2 ? { type: 'LineString', coordinates: longest } : null
    }
    case 'Polygon': {
      const edges = clipEdges(bbox)
      const rings = geometry.coordinates
        .map((ring) => clipRing(ring, edges))
        .filter((ring) => ring.length >= 4)
      return rings.length > 0 ? { type: 'Polygon', coordinates: rings } : null
    }
  }
}

export function roundGeometry(geometry: Geometry, precision: number): Geometry {
  const round = (point: Position): Position => [
    Number(point[0].toFixed(precision)),
    Number(point[1].toFixed(precision)),
  ]
  switch (geometry.type) {
    case 'Point':
      return { type: 'Point', coordinates: round(geometry.coordinates) }
    case 'LineString':
      return { type: 'LineString', coordinates: dedupeConsecutive(geometry.coordinates.map(round)) }
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates.map((ring) => closeRing(ring.map(round))),
      }
  }
}
