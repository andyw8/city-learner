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
    await syncCards('test', deck, now)
    const ids = (await loadCards('test')).map((card) => card.id).sort()
    expect(ids).toEqual(['f1:identify', 'f1:locate'])
    expect((await loadCards('test'))[0]?.city).toBe('test')
  })

  it('is idempotent', async () => {
    await syncCards('test', deck, now)
    await syncCards('test', deck, now)
    expect(await db.cards.count()).toBe(2)
  })

  it('tracks cities independently', async () => {
    const glasgowDeck = parseDeck({
      city: 'Glasgow',
      version: 1,
      features: [
        {
          id: 'g1',
          name: 'G1',
          category: 'road',
          description: '',
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    })

    await syncCards('toronto', deck, now)
    await syncCards('glasgow', glasgowDeck, now)

    expect((await loadCards('toronto')).map((card) => card.id)).toEqual([
      'f1:identify',
      'f1:locate',
    ])
    expect((await loadCards('glasgow')).map((card) => card.id)).toEqual([
      'g1:identify',
      'g1:locate',
    ])
    expect(await db.cards.count()).toBe(4)
  })

  it('prunes cards for features no longer in the deck', async () => {
    await syncCards('test', deck, now)

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
    await syncCards('test', nextDeck, now)

    const ids = (await loadCards('test')).map((card) => card.id).sort()
    expect(ids).toEqual(['f2:identify', 'f2:locate'])
  })

  it('persists a review', async () => {
    await syncCards('test', deck, now)
    const card = (await loadCards('test')).find((entry) => entry.mode === 'identify')!
    await applyReview(card, true, now)

    const stored = await db.cards.get(card.id)
    expect(stored?.reps).toBe(1)
  })
})
