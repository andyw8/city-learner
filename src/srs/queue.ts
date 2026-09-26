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

export function buildQueue(cards: Card[], options: QueueOptions): Card[] {
  const { now, mode, newLimit = DEFAULT_NEW_LIMIT } = options
  const pool = mode ? cards.filter((card) => card.mode === mode) : cards

  const due = pool
    .filter((card) => isDue(card, now))
    .sort((a, b) => a.due.getTime() - b.due.getTime())

  const fresh = pool.filter((card) => card.state === State.New).slice(0, newLimit)

  return [...due, ...fresh]
}
