import { describe, expect, it } from 'vitest'
import { CHOICE_COUNT, buildChoices } from '../../src/deck/choices'
import { parseDeck } from '../../src/deck/load'

function deckOf(categories: string[]): ReturnType<typeof parseDeck> {
  return parseDeck({
    city: 'Test',
    version: 1,
    features: categories.map((category, index) => ({
      id: `f${index}`,
      name: `Feature ${index}`,
      category,
      description: '',
      geometry: { type: 'Point', coordinates: [0, 0] },
    })),
  })
}

describe('buildChoices', () => {
  it('returns four options including the correct one', () => {
    const deck = deckOf(['road', 'road', 'road', 'road', 'water'])
    const target = deck.features[0]!
    const choices = buildChoices(deck, target)

    expect(choices).toHaveLength(CHOICE_COUNT)
    expect(choices.map((choice) => choice.featureId)).toContain(target.id)
  })

  it('has unique option names', () => {
    const deck = deckOf(['road', 'road', 'road', 'road'])
    const choices = buildChoices(deck, deck.features[0]!)
    const names = new Set(choices.map((choice) => choice.name))
    expect(names.size).toBe(choices.length)
  })

  it('is deterministic for the same target', () => {
    const deck = deckOf(['road', 'road', 'road', 'road'])
    const target = deck.features[0]!
    expect(buildChoices(deck, target)).toEqual(buildChoices(deck, target))
  })

  it('prefers distractors from the same category', () => {
    const deck = deckOf(['road', 'road', 'road', 'road', 'water', 'water'])
    const target = deck.features[0]!
    const choices = buildChoices(deck, target)
    const distractors = choices.filter((choice) => choice.featureId !== target.id)
    const distractorsInDeck = distractors.map((choice) =>
      deck.features.find((feature) => feature.id === choice.featureId),
    )
    expect(distractorsInDeck.every((feature) => feature?.category === 'road')).toBe(true)
  })

  it('falls back to other categories when the category is too small', () => {
    const deck = deckOf(['road', 'water', 'water', 'water'])
    const target = deck.features[0]!
    const choices = buildChoices(deck, target)
    expect(choices).toHaveLength(CHOICE_COUNT)
    expect(choices.map((choice) => choice.featureId)).toContain(target.id)
  })
})
