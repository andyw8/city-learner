import { describe, expect, it } from 'vitest'
import { State, createEmptyCard } from 'ts-fsrs'
import { buildQueue } from '../../src/srs/queue'
import type { Card, } from '../../src/srs/types'
import type { Mode } from '../../src/deck/types'

const now = new Date('2026-09-26T12:00:00Z')

function card(id: string, mode: Mode, overrides: Partial<Card> = {}): Card {
  return { ...createEmptyCard(now), id, featureId: id, mode, ...overrides }
}

describe('buildQueue', () => {
  it('returns due cards before new ones', () => {
    const due = card('due', 'identify', {
      state: State.Review,
      due: new Date(now.getTime() - 1000),
    })
    const future = card('future', 'identify', {
      state: State.Review,
      due: new Date(now.getTime() + 100000),
    })
    const fresh = card('new', 'identify')

    expect(buildQueue([future, fresh, due], { now }).map((entry) => entry.id)).toEqual([
      'due',
      'new',
    ])
  })

  it('sorts due cards by due date', () => {
    const older = card('older', 'identify', {
      state: State.Review,
      due: new Date(now.getTime() - 5000),
    })
    const newer = card('newer', 'identify', {
      state: State.Review,
      due: new Date(now.getTime() - 1000),
    })

    expect(buildQueue([newer, older], { now }).map((entry) => entry.id)).toEqual([
      'older',
      'newer',
    ])
  })

  it('limits the number of new cards', () => {
    const cards = [card('a', 'identify'), card('b', 'identify'), card('c', 'identify')]
    expect(buildQueue(cards, { now, newLimit: 2 })).toHaveLength(2)
  })

  it('filters by mode', () => {
    const cards = [card('a', 'identify'), card('b', 'locate')]
    expect(buildQueue(cards, { now, mode: 'locate' }).map((entry) => entry.id)).toEqual(['b'])
  })
})
