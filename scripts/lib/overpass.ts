import type { BBox } from '../../src/deck/types.ts'

export interface OverpassGeometryPoint {
  lat: number
  lon: number
}

export interface OsmNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

export interface OsmWay {
  type: 'way'
  id: number
  geometry?: OverpassGeometryPoint[]
  tags?: Record<string, string>
}

export interface OsmRelationMember {
  type: string
  ref: number
  role: string
  geometry?: OverpassGeometryPoint[]
}

export interface OsmRelation {
  type: 'relation'
  id: number
  members?: OsmRelationMember[]
  tags?: Record<string, string>
}

export type OsmElement = OsmNode | OsmWay | OsmRelation

const USER_AGENT = 'city-learner/0.1 (+https://github.com/andyw8/city-learner)'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function bboxToOverpass(bbox: BBox): string {
  const [minLng, minLat, maxLng, maxLat] = bbox
  return `${minLat},${minLng},${maxLat},${maxLng}`
}

export function buildQuery(statements: string[], scope: string, preamble = ''): string {
  const body = statements.map((statement) => statement.trim().replaceAll('${scope}', scope)).join('\n')
  const header = preamble ? `${preamble}\n` : ''
  return `[out:json][timeout:180];\n${header}(\n${body}\n);\nout geom;`
}

export interface FetchOptions {
  fetchImpl?: typeof fetch
  attemptsPerEndpoint?: number
  retryDelayMs?: number
}

export async function fetchElements(
  endpoints: string[],
  query: string,
  options: FetchOptions = {},
): Promise<OsmElement[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const attempts = options.attemptsPerEndpoint ?? 3
  const retryDelayMs = options.retryDelayMs ?? 5000
  const failures: string[] = []

  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(240_000),
        })

        if (response.ok) {
          const payload = (await response.json()) as { elements?: OsmElement[] }
          return payload.elements ?? []
        }

        failures.push(`${endpoint} returned ${response.status}`)
        if (response.status !== 429 && response.status < 500) break
      } catch (error) {
        failures.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`)
      }

      if (attempt < attempts) await sleep(retryDelayMs * attempt)
    }
  }

  throw new Error(`Overpass request failed (${failures.join('; ')})`)
}
