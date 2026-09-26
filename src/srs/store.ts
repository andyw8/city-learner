import { MODES, type Deck } from '../deck/types'
import { db } from '../db/schema'
import { newCard, review } from './scheduler'
import { cardId, type Card } from './types'

export async function syncCards(deck: Deck, now: Date = new Date()): Promise<void> {
  const existing = new Set((await db.cards.toArray()).map((card) => card.id))
  const missing: Card[] = []

  for (const feature of deck.features) {
    for (const mode of MODES) {
      const id = cardId(feature.id, mode)
      if (!existing.has(id)) missing.push(newCard(feature, mode, now))
    }
  }

  if (missing.length > 0) await db.cards.bulkPut(missing)
}

export async function loadCards(): Promise<Card[]> {
  return db.cards.toArray()
}

export async function applyReview(
  card: Card,
  correct: boolean,
  now: Date = new Date(),
): Promise<Card> {
  const updated = review(card, correct, now)
  await db.cards.put(updated)
  return updated
}
