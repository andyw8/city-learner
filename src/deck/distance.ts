import type { Category, Feature, Geometry, Position } from './types'

const EARTH_RADIUS_M = 6371008.8
const TO_RAD = Math.PI / 180

export const DEFAULT_TOLERANCE_M: Record<Category, number> = {
  landmark: 150,
  road: 250,
  water: 400,
  neighbourhood: 600,
}

export function haversine(a: Position, b: Position): number {
  const dLat = (b[1] - a[1]) * TO_RAD
  const dLng = (b[0] - a[0]) * TO_RAD
  const lat1 = a[1] * TO_RAD
  const lat2 = b[1] * TO_RAD
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

function offsetMeters(point: Position, origin: Position): [number, number] {
  const x = (point[0] - origin[0]) * TO_RAD * EARTH_RADIUS_M * Math.cos(origin[1] * TO_RAD)
  const y = (point[1] - origin[1]) * TO_RAD * EARTH_RADIUS_M
  return [x, y]
}

function pointToSegmentMeters(point: Position, a: Position, b: Position): number {
  const [ax, ay] = offsetMeters(a, point)
  const [bx, by] = offsetMeters(b, point)

  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) return Math.hypot(ax, ay)

  const t = Math.max(0, Math.min(1, (-ax * dx + -ay * dy) / lengthSq))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

function distanceToLine(point: Position, line: Position[]): number {
  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]
    const b = line[i + 1]
    if (!a || !b) continue
    min = Math.min(min, pointToSegmentMeters(point, a, b))
  }
  return min
}

function pointInRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (!a || !b) continue

    const [xi, yi] = a
    const [xj, yj] = b
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }

  return inside
}

function pointInPolygon(point: Position, rings: Position[][]): boolean {
  const outer = rings[0]
  if (!outer || !pointInRing(point, outer)) return false
  return !rings.slice(1).some((hole) => pointInRing(point, hole))
}

export function distanceToGeometry(point: Position, geometry: Geometry): number {
  switch (geometry.type) {
    case 'Point':
      return haversine(point, geometry.coordinates)
    case 'LineString':
      return distanceToLine(point, geometry.coordinates)
    case 'Polygon':
      if (pointInPolygon(point, geometry.coordinates)) return 0
      return Math.min(...geometry.coordinates.map((ring) => distanceToLine(point, ring)))
  }
}

export function toleranceFor(feature: Feature): number {
  return feature.toleranceM ?? DEFAULT_TOLERANCE_M[feature.category]
}

export interface LocateResult {
  distanceM: number
  toleranceM: number
  correct: boolean
}

export function checkLocate(point: Position, feature: Feature): LocateResult {
  const distanceM = distanceToGeometry(point, feature.geometry)
  const toleranceM = toleranceFor(feature)
  return { distanceM, toleranceM, correct: distanceM <= toleranceM }
}
