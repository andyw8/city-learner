import { describe, expect, it } from 'vitest'
import { createEmptyCard, State } from 'ts-fsrs'
import { parseDeck } from '../../src/deck/load'
import type { Mode } from '../../src/deck/types'
import { summarize } from '../../src/srs/stats'
import type { Card } from '../../src/srs/types'

const now = new Date('2026-09-26T12:00:00Z')

const deck = parseDeck({
  city: 'Test',
  version: 1,
  features: [
    {
      id: 'a',
      name: 'A',
      category: 'road',
      description: '',
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    {
      id: 'b',
      name: 'B',
      category: 'landmark',
      description: '',
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
  ],
})

function card(id: string, featureId: string, mode: Mode, overrides: Partial<Card> = {}): Card {
  return { ...createEmptyCard(now), id, featureId, mode, ...overrides }
}

describe('summarize', () => {
  const cards = [
    card('a:identify', 'a', 'identify', {
      state: State.Review,
      due: new Date(now.getTime() - 1000),
    }),
    card('a:locate', 'a', 'locate'),
    card('b:identify', 'b', 'identify', { state: State.Learning }),
    card('b:locate', 'b', 'locate', {
      state: State.Review,
      due: new Date(now.getTime() + 100_000),
    }),
  ]

  it('counts cards by state', () => {
    const stats = summarize(deck, cards, now)
    expect(stats.total).toBe(4)
    expect(stats.fresh).toBe(1)
    expect(stats.learning).toBe(1)
    expect(stats.review).toBe(2)
    expect(stats.due).toBe(2)
  })

  it('breaks progress down by category', () => {
    const stats = summarize(deck, cards, now)
    expect(stats.byCategory.road).toEqual({ total: 2, learned: 1, due: 1 })
    expect(stats.byCategory.landmark).toEqual({ total: 2, learned: 1, due: 1 })
  })

  it('ignores cards without a matching feature', () => {
    const stats = summarize(deck, [...cards, card('z:identify', 'z', 'identify')], now)
    expect(stats.total).toBe(4)
  })
})
