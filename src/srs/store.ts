import { MODES, type Deck } from '../deck/types'
import { db } from '../db/schema'
import { newCard, review } from './scheduler'
import { cardId, type Card } from './types'

export async function syncCards(
  city: string,
  deck: Deck,
  now: Date = new Date(),
): Promise<void> {
  const existing = new Set(
    (await db.cards.where('city').equals(city).toArray()).map((card) => card.id),
  )
  const validIds = new Set<string>()
  const missing: Card[] = []

  for (const feature of deck.features) {
    for (const mode of MODES) {
      const id = cardId(feature.id, mode)
      validIds.add(id)
      if (!existing.has(id)) missing.push(newCard(feature, mode, now, city))
    }
  }

  const orphaned = [...existing].filter((id) => !validIds.has(id))
  if (missing.length === 0 && orphaned.length === 0) return

  await db.transaction('rw', db.cards, async () => {
    if (orphaned.length > 0) await db.cards.bulkDelete(orphaned)
    if (missing.length > 0) await db.cards.bulkPut(missing)
  })
}

export async function loadCards(city: string): Promise<Card[]> {
  return db.cards.where('city').equals(city).toArray()
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
