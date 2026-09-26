import { describe, expect, it } from 'vitest'
import toronto from '../../data/decks/toronto.json'
import { parseDeck } from '../../src/deck/load'

const minimalFeature = {
  id: 'osm:node/example',
  name: 'Example',
  category: 'road',
  description: '',
  geometry: { type: 'Point', coordinates: [0, 0] },
}

describe('parseDeck', () => {
  it('parses the Toronto deck', () => {
    const deck = parseDeck(toronto)
    expect(deck.city).toBe('Toronto, Ontario, Canada')
    expect(deck.features).toHaveLength(13)
  })

  it('defaults aliases to an empty array', () => {
    const deck = parseDeck({ city: 'X', version: 1, features: [minimalFeature] })
    expect(deck.features[0]?.aliases).toEqual([])
  })

  it('rejects duplicate feature ids', () => {
    const raw = { city: 'X', version: 1, features: [minimalFeature, minimalFeature] }
    expect(() => parseDeck(raw)).toThrow(/Duplicate feature id/)
  })

  it('rejects an unknown category', () => {
    const raw = {
      city: 'X',
      version: 1,
      features: [{ ...minimalFeature, category: 'mountain' }],
    }
    expect(() => parseDeck(raw)).toThrow()
  })

  it('rejects malformed geometry', () => {
    const raw = {
      city: 'X',
      version: 1,
      features: [
        { ...minimalFeature, geometry: { type: 'LineString', coordinates: [[0, 0]] } },
      ],
    }
    expect(() => parseDeck(raw)).toThrow()
  })
})
