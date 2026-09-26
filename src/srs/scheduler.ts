import { Rating, createEmptyCard, fsrs } from 'ts-fsrs'
import type { Feature, Mode } from '../deck/types'
import { cardId, type Card } from './types'

const scheduler = fsrs()

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
