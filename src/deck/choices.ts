import type { Deck, Feature } from './types'

export interface Choice {
  featureId: string
  name: string
}

export const CHOICE_COUNT = 4

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = result[i]
    const b = result[j]
    if (a === undefined || b === undefined) continue
    result[i] = b
    result[j] = a
  }
  return result
}

export function buildChoices(deck: Deck, target: Feature, count = CHOICE_COUNT): Choice[] {
  const sameCategory = deck.features.filter(
    (feature) => feature.id !== target.id && feature.category === target.category,
  )
  const otherCategories = deck.features.filter(
    (feature) => feature.id !== target.id && feature.category !== target.category,
  )

  const chosen: Feature[] = []
  const usedNames = new Set([target.name])

  for (const feature of [...sameCategory, ...otherCategories]) {
    if (chosen.length >= count - 1) break
    if (usedNames.has(feature.name)) continue
    usedNames.add(feature.name)
    chosen.push(feature)
  }

  const correct: Choice = { featureId: target.id, name: target.name }
  const distractors = chosen.map((feature) => ({ featureId: feature.id, name: feature.name }))

  return shuffle([correct, ...distractors], mulberry32(hashString(target.id)))
}
