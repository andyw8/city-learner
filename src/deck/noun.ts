import type { Category, Feature } from './types'

const GENERIC_NOUNS: Record<Category, string> = {
  road: 'road',
  neighbourhood: 'neighbourhood',
  water: 'body of water',
  landmark: 'landmark',
}

export function featureNoun(feature: Feature): string {
  return feature.noun ?? GENERIC_NOUNS[feature.category]
}
