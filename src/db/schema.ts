import Dexie, { type Table } from 'dexie'
import type { Card } from '../srs/types'

export interface MetaRecord {
  key: string
  value: unknown
}

export class CityLearnerDatabase extends Dexie {
  cards!: Table<Card, string>
  meta!: Table<MetaRecord, string>

  constructor() {
    super('city-learner')
    this.version(1).stores({ cards: 'id, due, featureId, mode' })
    this.version(2).stores({ cards: 'id, due, featureId, mode', meta: 'key' })
    this.version(3)
      .stores({ cards: 'id, due, featureId, mode, city', meta: 'key' })
      .upgrade((tx) =>
        tx
          .table('cards')
          .toCollection()
          .modify((card: { city?: string }) => {
            card.city ??= 'toronto'
          }),
      )
  }
}

export const db = new CityLearnerDatabase()
