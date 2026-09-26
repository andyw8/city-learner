import { Rating, createEmptyCard, fsrs } from 'ts-fsrs'
import type { Feature, Mode } from '../deck/types'
import { cardId, type Card } from './types'

// Tuned for a lighter, less repetitive load: review at 85% recall, scatter
// intervals across days, keep a one-year ceiling, and skip the minute-level
// (re)learning steps that bounce a card straight back into the next session.
const scheduler = fsrs({
  request_retention: 0.85,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: false,
})

export function newCard(feature: Feature, mode: Mode, now: Date, city: string): Card {
  return {
    ...createEmptyCard(now),
    id: cardId(feature.id, mode),
    city,
    featureId: feature.id,
    mode,
  }
}

export function review(card: Card, correct: boolean, now: Date): Card {
  const rating = correct ? Rating.Good : Rating.Again
  const next = scheduler.repeat(card, now)[rating].card
  return { ...next, id: card.id, city: card.city, featureId: card.featureId, mode: card.mode }
}
