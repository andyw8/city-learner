import { deckSchema, type Deck, type Feature } from './types'

export function parseDeck(raw: unknown): Deck {
  const deck = deckSchema.parse(raw)

  const seen = new Set<string>()
  for (const feature of deck.features) {
    if (seen.has(feature.id)) {
      throw new Error(`Duplicate feature id: ${feature.id}`)
    }
    seen.add(feature.id)
  }

  return deck
}

export async function loadDeck(url: string): Promise<Deck> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load deck from ${url}: ${response.status}`)
  }
  return parseDeck(await response.json())
}

export function featureById(deck: Deck): Map<string, Feature> {
  return new Map(deck.features.map((feature) => [feature.id, feature]))
}
