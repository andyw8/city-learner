import Dexie, { type Table } from 'dexie'
import type { Card } from '../srs/types'

export class CityLearnerDatabase extends Dexie {
  cards!: Table<Card, string>

  constructor() {
    super('city-learner')
    this.version(1).stores({ cards: 'id, due, featureId, mode' })
  }
}

export const db = new CityLearnerDatabase()
