import { State } from 'ts-fsrs'
import { CATEGORIES, MODES, type Category, type Deck } from '../deck/types'
import { cardId, type Card } from './types'

export interface CategoryProgress {
  total: number
  learned: number
  due: number
}

export interface Stats {
  total: number
  fresh: number
  learning: number
  review: number
  due: number
  byCategory: Record<Category, CategoryProgress>
}

export function summarize(deck: Deck, cards: Card[], now: Date): Stats {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const byCategory = Object.fromEntries(
    CATEGORIES.map((category) => [category, { total: 0, learned: 0, due: 0 }]),
  ) as Record<Category, CategoryProgress>

  const stats: Stats = { total: 0, fresh: 0, learning: 0, review: 0, due: 0, byCategory }

  for (const feature of deck.features) {
    const progress = byCategory[feature.category]
    for (const mode of MODES) {
      const card = byId.get(cardId(feature.id, mode))
      if (!card) continue

      stats.total++
      progress.total++

      if (card.state === State.New) stats.fresh++
      else if (card.state === State.Review) stats.review++
      else stats.learning++

      if (card.state !== State.New && card.due.getTime() <= now.getTime()) {
        stats.due++
        progress.due++
      }
      if (card.state === State.Review) progress.learned++
    }
  }

  return stats
}
