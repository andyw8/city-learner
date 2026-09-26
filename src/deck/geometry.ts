import type { BBox, Geometry, Position } from './types'

function positions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates]
    case 'LineString':
      return geometry.coordinates
    case 'MultiLineString':
      return geometry.coordinates.flat()
    case 'Polygon':
      return geometry.coordinates.flat()
  }
}

export function bboxOf(geometry: Geometry): BBox {
  const points = positions(geometry)
  const first = points[0]
  if (!first) throw new Error('Geometry has no coordinates')

  let [minLng, minLat] = first
  let [maxLng, maxLat] = first

  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }

  return [minLng, minLat, maxLng, maxLat]
}

export function centerOf(geometry: Geometry): Position {
  const [minLng, minLat, maxLng, maxLat] = bboxOf(geometry)
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}
