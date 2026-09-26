import { State } from 'ts-fsrs'
import type { Mode } from '../deck/types'
import type { Card } from './types'

export const DEFAULT_NEW_LIMIT = 10

export interface QueueOptions {
  now: Date
  mode?: Mode
  newLimit?: number
}

function isDue(card: Card, now: Date): boolean {
  return card.state !== State.New && card.due.getTime() <= now.getTime()
}

/**
 * Reorder so a feature's identify and locate cards are not adjacent, keeping
 * the original order as far as possible. Cards are stored ordered by
 * `${featureId}:${mode}`, which would otherwise pair the two modes back to back.
 */
function spaceByFeature(cards: Card[]): Card[] {
  const remaining = [...cards]
  const result: Card[] = []

  while (remaining.length > 0) {
    const lastFeature = result[result.length - 1]?.featureId
    const index = remaining.findIndex((card) => card.featureId !== lastFeature)
    result.push(...remaining.splice(index === -1 ? 0 : index, 1))
  }

  return result
}

export function buildQueue(cards: Card[], options: QueueOptions): Card[] {
  const { now, mode, newLimit = DEFAULT_NEW_LIMIT } = options
  const pool = mode ? cards.filter((card) => card.mode === mode) : cards

  const due = pool
    .filter((card) => isDue(card, now))
    .sort((a, b) => a.due.getTime() - b.due.getTime())

  const fresh = pool.filter((card) => card.state === State.New).slice(0, newLimit)

  return spaceByFeature([...due, ...fresh])
}
