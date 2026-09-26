import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/schema'
import { parseDeck } from '../../src/deck/load'
import { applyReview, loadCards, syncCards } from '../../src/srs/store'

const now = new Date('2026-09-26T12:00:00Z')

const deck = parseDeck({
  city: 'Test',
  version: 1,
  features: [
    {
      id: 'f1',
      name: 'F1',
      category: 'road',
      description: '',
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
  ],
})

describe('card store', () => {
  beforeEach(async () => {
    await db.cards.clear()
  })

  it('creates one card per feature and mode', async () => {
    await syncCards(deck, now)
    const ids = (await loadCards()).map((card) => card.id).sort()
    expect(ids).toEqual(['f1:identify', 'f1:locate'])
  })

  it('is idempotent', async () => {
    await syncCards(deck, now)
    await syncCards(deck, now)
    expect(await db.cards.count()).toBe(2)
  })

  it('prunes cards for features no longer in the deck', async () => {
    await syncCards(deck, now)

    const nextDeck = parseDeck({
      city: 'Test',
      version: 2,
      features: [
        {
          id: 'f2',
          name: 'F2',
          category: 'road',
          description: '',
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    })
    await syncCards(nextDeck, now)

    const ids = (await loadCards()).map((card) => card.id).sort()
    expect(ids).toEqual(['f2:identify', 'f2:locate'])
  })

  it('persists a review', async () => {
    await syncCards(deck, now)
    const card = (await loadCards()).find((entry) => entry.mode === 'identify')!
    await applyReview(card, true, now)

    const stored = await db.cards.get(card.id)
    expect(stored?.reps).toBe(1)
  })
})
