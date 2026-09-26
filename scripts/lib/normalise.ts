import type { BBox, Category, Feature, Geometry, Position } from '../../src/deck/types.ts'
import {
  clipGeometryToBbox,
  closeRing,
  dedupeConsecutive,
  geometrySizeM,
  lineLengthM,
  ringAreaM2,
  roundGeometry,
  samePosition,
  simplifyGeometry,
  stitchRings,
} from './geometry.ts'
import type { OsmElement, OsmWay } from './overpass.ts'

export interface Candidate {
  feature: Feature
  nameKey: string
  wikidata: string | null
  sizeM: number
  lineCoords?: Position[]
  isPolygon: boolean
}

export interface NormaliseOptions {
  precision: number
  simplifyToleranceM: number
  bbox: BBox
  stripDirectional?: boolean
}

const DIRECTIONAL_SUFFIX = /\s+(east|west|north|south)$/i

export function stripDirectionalSuffix(name: string): string {
  return name.replace(DIRECTIONAL_SUFFIX, '').trim()
}

export function normalizeName(name: string, stripDirectional = false): string {
  const base = stripDirectional ? stripDirectionalSuffix(name) : name
  return base.toLowerCase()
}

const ROAD_KINDS: Record<string, string> = {
  motorway: 'motorway',
  trunk: 'trunk road',
  primary: 'primary road',
  secondary: 'secondary road',
  tertiary: 'tertiary road',
  residential: 'residential street',
}

const WATER_KINDS: Record<string, string> = {
  river: 'river',
  canal: 'canal',
  stream: 'stream',
  water: 'body of water',
  bay: 'bay',
  lake: 'lake',
}

const LANDMARK_KINDS: Record<string, string> = {
  attraction: 'visitor attraction',
  museum: 'museum',
  gallery: 'gallery',
  viewpoint: 'viewpoint',
  artwork: 'public artwork',
  castle: 'castle',
  monument: 'monument',
  memorial: 'memorial',
  tower: 'tower',
}

export function describe(category: Category, tags: Record<string, string>): string {
  switch (category) {
    case 'road': {
      const kind = ROAD_KINDS[tags.highway ?? ''] ?? 'road'
      return `A ${kind} in Toronto.`
    }
    case 'neighbourhood':
      return 'A neighbourhood in Toronto.'
    case 'water': {
      const kind = WATER_KINDS[tags.waterway ?? ''] ?? WATER_KINDS[tags.natural ?? ''] ?? 'body of water'
      return `A ${kind} in Toronto.`
    }
    case 'landmark': {
      const kind =
        LANDMARK_KINDS[tags.tourism ?? ''] ??
        LANDMARK_KINDS[tags.historic ?? ''] ??
        LANDMARK_KINDS[tags.man_made ?? ''] ??
        'landmark'
      return `A ${kind} in Toronto.`
    }
  }
}

function geometryFromCoords(coords: Position[], category: Category): Geometry | null {
  const deduped = dedupeConsecutive(coords)
  if (deduped.length < 2) return null
  const closed = deduped.length >= 4 && samePosition(deduped[0]!, deduped[deduped.length - 1]!)
  if (closed && category !== 'road') {
    return { type: 'Polygon', coordinates: [closeRing(deduped)] }
  }
  return { type: 'LineString', coordinates: deduped }
}

function wayGeometry(way: OsmWay, category: Category): Geometry | null {
  const coords = (way.geometry ?? []).map(({ lon, lat }): Position => [lon, lat])
  return geometryFromCoords(coords, category)
}

function relationGeometry(element: Extract<OsmElement, { type: 'relation' }>): Geometry | null {
  const segments = (element.members ?? [])
    .filter((member) => member.role === '' || member.role === 'outer')
    .flatMap((member) =>
      member.geometry && member.geometry.length >= 2
        ? [member.geometry.map(({ lon, lat }): Position => [lon, lat])]
        : [],
    )
  if (segments.length === 0) return null

  const rings = stitchRings(segments)
  const closed = rings.filter(
    (ring) => ring.length >= 4 && samePosition(ring[0]!, ring[ring.length - 1]!),
  )
  if (closed.length > 0) {
    const best = closed.reduce((a, b) => (ringAreaM2(a) >= ringAreaM2(b) ? a : b))
    return { type: 'Polygon', coordinates: [closeRing(best)] }
  }

  const lines = rings.filter((ring) => ring.length >= 2)
  if (lines.length > 0) {
    const best = lines.reduce((a, b) => (lineLengthM(a) >= lineLengthM(b) ? a : b))
    return { type: 'LineString', coordinates: best }
  }
  return null
}

function elementGeometry(element: OsmElement, category: Category): Geometry | null {
  switch (element.type) {
    case 'node':
      return { type: 'Point', coordinates: [element.lon, element.lat] }
    case 'way':
      return wayGeometry(element, category)
    case 'relation':
      return relationGeometry(element)
  }
}

export function candidateFromElement(
  element: OsmElement,
  category: Category,
  options: NormaliseOptions,
): Candidate | null {
  const name = element.tags?.name?.trim()
  if (!name) return null

  const raw = elementGeometry(element, category)
  if (!raw) return null

  const clipped = clipGeometryToBbox(raw, options.bbox)
  if (!clipped) return null

  const geometry = roundGeometry(
    simplifyGeometry(clipped, options.simplifyToleranceM),
    options.precision,
  )
  if (geometry.type === 'LineString' && lineLengthM(geometry.coordinates) === 0) return null

  const feature: Feature = {
    id: `osm:${element.type}/${element.id}`,
    name,
    aliases: [],
    category,
    description: describe(category, element.tags ?? {}),
    geometry,
    osmId: `${element.type}/${element.id}`,
  }

  return {
    feature,
    nameKey: normalizeName(name, options.stripDirectional),
    wikidata: element.tags?.wikidata ?? null,
    sizeM: geometrySizeM(geometry),
    ...(geometry.type === 'LineString' ? { lineCoords: geometry.coordinates } : {}),
    isPolygon: geometry.type === 'Polygon',
  }
}
