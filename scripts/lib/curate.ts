import { z } from 'zod'
import {
  categorySchema,
  geometrySchema,
  type Category,
  type Feature,
  type Position,
} from '../../src/deck/types.ts'
import { lineLengthM, stitchLines } from './geometry.ts'
import { describe, normalizeName, stripDirectionalSuffix, type Candidate } from './normalise.ts'

export type MergeStrategy = 'longest-line' | 'largest-area' | 'first-with-wikidata'

export interface CategoryRule {
  query: string
  merge: MergeStrategy
  max: number
  minLengthM?: number
  stripDirectional?: boolean
}

export interface Curation {
  city: string
  version: number
  endpoints: string[]
  area?: number
  bbox: [number, number, number, number]
  precision: number
  simplifyToleranceM: number
  categories: Record<Category, CategoryRule>
  exclude?: Partial<Record<Category, string[]>>
  include?: Partial<Record<Category, string[]>>
  manual: ManualEntry[]
}

export const manualEntrySchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    category: categorySchema,
    description: z.string().optional(),
    aliases: z.array(z.string().min(1)).optional(),
    toleranceM: z.number().positive().optional(),
    geometry: geometrySchema.optional(),
  })
  .refine(
    (entry) => entry.geometry !== undefined || entry.description !== undefined || entry.aliases !== undefined || entry.toleranceM !== undefined,
    { message: 'A manual entry needs geometry or metadata to apply' },
  )

export type ManualEntry = z.infer<typeof manualEntrySchema>

export interface SelectResult {
  features: Feature[]
  missingInclude: string[]
}

type IncludeExclude = Pick<Curation, 'include' | 'exclude'>

function rank(candidate: Candidate): number {
  return (candidate.wikidata ? 1_000_000 : 0) + candidate.sizeM
}

function pickBase(group: Candidate[]): Candidate {
  return group.find((candidate) => candidate.wikidata) ?? group[0]!
}

function pickLargest(group: Candidate[]): Candidate {
  return group.reduce((a, b) => (rank(a) >= rank(b) ? a : b))
}

function mergeGroup(group: Candidate[], rule: CategoryRule): Candidate {
  if (group.length === 1) return group[0]!

  switch (rule.merge) {
    case 'first-with-wikidata':
      return pickBase(group)
    case 'largest-area':
      return pickLargest(group)
    case 'longest-line': {
      const segments = group.flatMap((candidate) =>
        candidate.lineCoords ? [candidate.lineCoords] : [],
      )
      if (segments.length === 0) return pickLargest(group)
      const stitched = stitchLines(segments)
      const best = stitched.reduce((a, b) => (lineLengthM(a) >= lineLengthM(b) ? a : b))
      const base = pickBase(group)
      const names = [...new Set(group.map((candidate) => candidate.feature.name))]
      const name = rule.stripDirectional
        ? stripDirectionalSuffix(base.feature.name)
        : base.feature.name
      const aliases = names.filter((variant) => variant !== name).sort()
      const coordinates: Position[] = best
      return {
        ...base,
        feature: {
          ...base.feature,
          name,
          aliases,
          geometry: { type: 'LineString', coordinates },
        },
        lineCoords: coordinates,
        isPolygon: false,
        sizeM: lineLengthM(coordinates),
      }
    }
  }
}

export function selectFeatures(
  candidates: Candidate[],
  rule: CategoryRule,
  curation: IncludeExclude,
  category: Category,
): SelectResult {
  const groups = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const list = groups.get(candidate.nameKey) ?? []
    list.push(candidate)
    groups.set(candidate.nameKey, list)
  }

  const merged = [...groups.values()].map((group) => mergeGroup(group, rule))

  const strip = rule.stripDirectional ?? false
  const exclude = new Set(
    (curation.exclude?.[category] ?? []).map((name) => normalizeName(name, strip)),
  )
  const include = (curation.include?.[category] ?? []).map((name) => ({
    name,
    key: normalizeName(name, strip),
  }))
  const includeSet = new Set(include.map((entry) => entry.key))
  const byName = new Map(merged.map((candidate) => [candidate.nameKey, candidate]))

  const forced: Candidate[] = []
  const missingInclude: string[] = []
  for (const entry of include) {
    const candidate = byName.get(entry.key)
    if (!candidate) {
      missingInclude.push(entry.name)
      continue
    }
    if (!exclude.has(entry.key)) forced.push(candidate)
  }

  const automatic = merged
    .filter((candidate) => !exclude.has(candidate.nameKey))
    .filter((candidate) => !includeSet.has(candidate.nameKey))
    .filter((candidate) => candidate.sizeM >= (rule.minLengthM ?? 0))
    .sort((a, b) => rank(b) - rank(a) || a.nameKey.localeCompare(b.nameKey))

  const forcedNames = new Set(forced.map((candidate) => candidate.nameKey))
  const remaining = Math.max(0, rule.max - forced.length)
  const auto = automatic
    .filter((candidate) => !forcedNames.has(candidate.nameKey))
    .slice(0, remaining)

  return {
    features: [...forced, ...auto].map((candidate) => candidate.feature),
    missingInclude,
  }
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

export interface ManualResult {
  features: Feature[]
  unmatched: string[]
}

export function applyManual(features: Feature[], manual: ManualEntry[]): ManualResult {
  const result = features.map((feature) => ({ ...feature, aliases: [...feature.aliases] }))
  const unmatched: string[] = []

  for (const entry of manual) {
    if (entry.geometry) {
      result.push({
        id: entry.id ?? `manual:${slug(entry.name)}`,
        name: entry.name,
        aliases: entry.aliases ?? [],
        category: entry.category,
        description: entry.description ?? describe(entry.category, {}),
        geometry: entry.geometry,
        ...(entry.toleranceM !== undefined ? { toleranceM: entry.toleranceM } : {}),
      })
      continue
    }

    const target = result.find(
      (feature) => feature.name.toLowerCase() === entry.name.toLowerCase(),
    )
    if (!target) {
      unmatched.push(entry.name)
      continue
    }
    if (entry.description !== undefined) target.description = entry.description
    if (entry.aliases !== undefined) target.aliases = entry.aliases
    if (entry.toleranceM !== undefined) target.toleranceM = entry.toleranceM
  }

  return { features: result, unmatched }
}
