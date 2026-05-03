import Dexie, { type Table } from 'dexie'
import type { DracoCard } from '../sources/draco/DracoSource'

export interface DracoMeta {
  id: 1 // singleton row
  exportedAt: string
  cardCount: number
}

export class DracoDb extends Dexie {
  cards!: Table<DracoCard & { id?: number }, number>
  meta!: Table<DracoMeta, number>

  constructor() {
    super('draco-inventory')
    this.version(1).stores({
      cards: '++id, name, slug',
      meta: 'id',
    })
  }
}

export const dracoDb = new DracoDb()
