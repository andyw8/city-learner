import { describe, expect, it } from 'vitest'
import { State } from 'ts-fsrs'
import type { Feature } from '../../src/deck/types'
import { newCard, review } from '../../src/srs/scheduler'

const feature: Feature = {
  id: 'osm:node/x',
  name: 'X',
  aliases: [],
  category: 'landmark',
  description: '',
  geometry: { type: 'Point', coordinates: [0, 0] },
}

const now = new Date('2026-09-26T12:00:00Z')

describe('newCard', () => {
  it('creates a new card keyed by feature and mode', () => {
    const card = newCard(feature, 'identify', now)
    expect(card.id).toBe('osm:node/x:identify')
    expect(card.featureId).toBe('osm:node/x')
    expect(card.mode).toBe('identify')
    expect(card.state).toBe(State.New)
    expect(card.reps).toBe(0)
  })
})

describe('review', () => {
  it('advances a correct card and keeps its identity', () => {
    const card = newCard(feature, 'locate', now)
    const next = review(card, true, now)

    expect(next.reps).toBe(1)
    expect(next.state).toBe(State.Learning)
    expect(next.id).toBe(card.id)
    expect(next.featureId).toBe('osm:node/x')
    expect(next.mode).toBe('locate')
    expect(next.due.getTime()).toBeGreaterThan(now.getTime())
  })

  it('schedules an incorrect card no later than a correct one', () => {
    const card = newCard(feature, 'identify', now)
    expect(review(card, false, now).due.getTime()).toBeLessThanOrEqual(
      review(card, true, now).due.getTime(),
    )
  })
})
