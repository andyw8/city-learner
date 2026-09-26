import type { Card as FsrsCard } from 'ts-fsrs'
import type { Mode } from '../deck/types'

export interface Card extends FsrsCard {
  id: string
  city: string
  featureId: string
  mode: Mode
}

export function cardId(featureId: string, mode: Mode): string {
  return `${featureId}:${mode}`
}
