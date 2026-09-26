import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { parseDeck } from '../src/deck/load.ts'
import { CATEGORIES, type Category } from '../src/deck/types.ts'
import {
  applyManual,
  manualEntrySchema,
  selectFeatures,
  type Curation,
} from './lib/curate.ts'
import { candidateFromElement, type Candidate } from './lib/normalise.ts'
import { bboxToOverpass, buildQuery, fetchElements, type OsmElement } from './lib/overpass.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const cityId = args.find((arg) => !arg.startsWith('--')) ?? 'toronto'
const configPath = resolve(root, `scripts/curate/${cityId}.yaml`)
const outputPath = resolve(root, `data/decks/${cityId}.json`)
const cacheDir = resolve(root, 'scripts/.cache')

const categoryRuleSchema = z.object({
  query: z.string().min(1),
  merge: z.enum(['longest-line', 'largest-area', 'first-with-wikidata']),
  max: z.number().int().positive(),
  minLengthM: z.number().positive().optional(),
  stripDirectional: z.boolean().optional(),
})

const curationSchema = z.object({
  city: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
  endpoints: z.array(z.string().min(1)).min(1),
  area: z.number().int().positive().optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  precision: z.number().int().min(0).max(9),
  simplifyToleranceM: z.number().positive(),
  categories: z.record(z.enum(CATEGORIES), categoryRuleSchema),
  exclude: z.record(z.enum(CATEGORIES), z.array(z.string())).optional(),
  include: z.record(z.enum(CATEGORIES), z.array(z.string())).optional(),
  manual: z.array(manualEntrySchema).default([]),
})

function loadCuration(): Curation {
  return curationSchema.parse(parseYaml(readFileSync(configPath, 'utf8')))
}

function cachePath(category: Category, query: string): string {
  const hash = createHash('sha256').update(query).digest('hex').slice(0, 12)
  return resolve(cacheDir, `${cityId}-${category}-${hash}.json`)
}

async function loadElements(
  curation: Curation,
  category: Category,
  refresh: boolean,
): Promise<OsmElement[]> {
  const scope = curation.area ? 'area.toronto' : bboxToOverpass(curation.bbox)
  const preamble = curation.area ? `area(${curation.area})->.toronto;` : ''
  const query = buildQuery([curation.categories[category].query], scope, preamble)

  const path = cachePath(category, query)
  if (!refresh && existsSync(path)) {
    console.log(`${category}: using cached Overpass response`)
    return JSON.parse(readFileSync(path, 'utf8')) as OsmElement[]
  }

  const elements = await fetchElements(curation.endpoints, query)
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(path, JSON.stringify(elements, null, 0))
  await new Promise((resolve) => setTimeout(resolve, 3000))
  return elements
}

async function main(): Promise<void> {
  const curation = loadCuration()

  const options = {
    precision: curation.precision,
    simplifyToleranceM: curation.simplifyToleranceM,
    bbox: curation.bbox,
    cityName: curation.name,
  }

  const collected: Candidate[] = []
  const missingInclude: string[] = []

  for (const category of CATEGORIES) {
    const rule = curation.categories[category]
    const elements = await loadElements(curation, category, refresh)
    const candidates = elements.flatMap((element) => {
      const candidate = candidateFromElement(element, category, {
        ...options,
        stripDirectional: rule.stripDirectional ?? false,
      })
      return candidate ? [candidate] : []
    })

    const { features, missingInclude: missing } = selectFeatures(
      candidates,
      rule,
      curation,
      category,
    )
    missingInclude.push(...missing)
    collected.push(
      ...features.map((feature) => ({
        feature,
        nameKey: feature.name.toLowerCase(),
        wikidata: null,
        sizeM: 0,
        isPolygon: feature.geometry.type === 'Polygon',
      })),
    )

    console.log(
      `${category}: ${elements.length} elements, ${candidates.length} candidates, ${features.length} features`,
    )
  }

  const { features, unmatched } = applyManual(
    collected.map((candidate) => candidate.feature),
    curation.manual,
    curation.name,
  )

  if (missingInclude.length > 0) {
    console.warn(`Include names not found: ${missingInclude.join(', ')}`)
  }
  if (unmatched.length > 0) {
    console.warn(`Manual entries matched nothing: ${unmatched.join(', ')}`)
  }

  const order = new Map(CATEGORIES.map((category, index) => [category, index]))
  features.sort(
    (a, b) =>
      (order.get(a.category) ?? 0) - (order.get(b.category) ?? 0) ||
      a.name.localeCompare(b.name, 'en'),
  )

  const deck = parseDeck({ city: curation.city, version: curation.version, features })
  writeFileSync(outputPath, `${JSON.stringify(deck, null, 2)}\n`)
  console.log(`Wrote ${deck.features.length} features to ${outputPath}`)
}

await main()
