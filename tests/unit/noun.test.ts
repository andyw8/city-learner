import { describe, expect, it } from 'vitest'
import { featureNoun } from '../../src/deck/noun'
import type { Feature } from '../../src/deck/types'

function feature(overrides: Partial<Feature>): Feature {
  return {
    id: 'f',
    name: 'F',
    aliases: [],
    category: 'road',
    description: '',
    geometry: { type: 'Point', coordinates: [0, 0] },
    ...overrides,
  }
}

describe('featureNoun', () => {
  it('prefers the stored noun', () => {
    expect(featureNoun(feature({ category: 'water', noun: 'river' }))).toBe('river')
  })

  it('falls back to a noun for the category', () => {
    expect(featureNoun(feature({ category: 'road' }))).toBe('road')
    expect(featureNoun(feature({ category: 'neighbourhood' }))).toBe('neighbourhood')
    expect(featureNoun(feature({ category: 'water' }))).toBe('body of water')
    expect(featureNoun(feature({ category: 'landmark' }))).toBe('landmark')
  })
})
