import type { CardSource } from '../CardSource'
import type { NormalizedCard } from '../../domain/card'
import { toMatchKey } from '../../domain/card'
import { dracoDb } from '../../lib/draco-db'

const SOURCE_NAME = 'Draco'

export interface DracoCard {
  name: string
  setName: string
  setCode: string
  collectorNumber: string
  finish: string
  language: string
  rarity: string
  price: number
  imageUrl: string | null
  inStock: boolean
  slug: string
}

export interface DracoInventory {
  exportedAt: string
  cards: DracoCard[]
}

export async function saveDracoInventory(inv: DracoInventory): Promise<void> {
  await dracoDb.transaction('rw', dracoDb.cards, dracoDb.meta, async () => {
    await dracoDb.cards.clear()
    await dracoDb.cards.bulkAdd(inv.cards)
    await dracoDb.meta.put({ id: 1, exportedAt: inv.exportedAt, cardCount: inv.cards.length })
  })
}

export async function clearDracoInventory(): Promise<void> {
  await dracoDb.transaction('rw', dracoDb.cards, dracoDb.meta, async () => {
    await dracoDb.cards.clear()
    await dracoDb.meta.clear()
  })
}

export async function getDracoMeta(): Promise<{ exportedAt: string; cardCount: number } | null> {
  const row = await dracoDb.meta.get(1)
  return row ? { exportedAt: row.exportedAt, cardCount: row.cardCount } : null
}

function mapCard(c: DracoCard): NormalizedCard {
  return {
    matchKey: toMatchKey(c.name),
    displayName: c.name,
    setName: c.setName,
    setCode: c.setCode,
    collectorNumber: c.collectorNumber,
    finish: c.finish,
    rarity: c.rarity,
    condition: 'NM',
    language: c.language,
    typeLine: '',
    price: c.price,
    currency: 'COP',
    stock: 1,
    imageUrl: c.imageUrl,
    sourceName: SOURCE_NAME,
    sourceId: `${c.slug}-${c.finish}`,
    sourceMeta: { slug: c.slug } as unknown as Record<string, unknown>,
  }
}

export const dracoSource: CardSource = {
  name: SOURCE_NAME,
  async fetchInStock(_signal, onProgress) {
    onProgress?.({ loaded: 0, total: 1 })
    const all = await dracoDb.cards.toArray()
    const cards = all.filter((c) => c.inStock)
    onProgress?.({ loaded: 1, total: 1 })
    return cards.map(mapCard)
  },
}
