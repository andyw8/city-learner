import { Rating, createEmptyCard, fsrs } from 'ts-fsrs'
import type { Feature, Mode } from '../deck/types'
import { cardId, type Card } from './types'

const scheduler = fsrs()

export function newCard(feature: Feature, mode: Mode, now: Date): Card {
  return {
    ...createEmptyCard(now),
    id: cardId(feature.id, mode),
    featureId: feature.id,
    mode,
  }
}

export function review(card: Card, correct: boolean, now: Date): Card {
  const rating = correct ? Rating.Good : Rating.Again
  const next = scheduler.repeat(card, now)[rating].card
  return { ...next, id: card.id, featureId: card.featureId, mode: card.mode }
}
