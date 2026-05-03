import type { CardSource } from '../CardSource'
import type { NormalizedCard } from '../../domain/card'
import { toMatchKey } from '../../domain/card'
import type { WishlistItem } from '../../domain/wishlist'

interface RohanCard {
  id: string
  cardPrintingId: string
  name: string
  setName: string
  setCode: string
  collectorNumber: string
  language: string
  finish: string
  rarity: string
  typeLine: string
  price: number
  stock: number
  hasStock: boolean
  condition: string
  imageUrl: string | null
}

interface RohanResponse {
  results: RohanCard[]
}

const ENDPOINT =
  'https://uti6iqgn2d.execute-api.us-east-1.amazonaws.com/catalog/in-stock'

const SOURCE_NAME = 'Rohan'

interface RohanSourceMeta {
  stockId: string
  cardPrintingId: string
  name: string
  setName: string
  setCode: string
  imageUrl: string | null
  price: number
  language: string
  condition: string
  finish: string
  maxQuantity: number
}

export const rohanSource: CardSource = {
  name: SOURCE_NAME,
  async fetchInStock(signal, onProgress) {
    onProgress?.({ loaded: 0, total: 1 })
    const res = await fetch(ENDPOINT, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Rohan source failed: ${res.status}`)
    }
    const data = (await res.json()) as RohanResponse
    const mapped = data.results.filter((c) => c.hasStock).map(mapRohanCard)
    onProgress?.({ loaded: 1, total: 1 })
    return mapped
  },
}

function mapRohanCard(c: RohanCard): NormalizedCard {
  const meta: RohanSourceMeta = {
    stockId: c.id,
    cardPrintingId: c.cardPrintingId,
    name: c.name,
    setName: c.setName,
    setCode: c.setCode,
    imageUrl: c.imageUrl,
    price: c.price,
    language: c.language,
    condition: c.condition,
    finish: c.finish,
    maxQuantity: c.stock,
  }
  return {
    matchKey: toMatchKey(c.name),
    displayName: c.name,
    setName: c.setName,
    setCode: c.setCode,
    collectorNumber: c.collectorNumber,
    finish: c.finish,
    rarity: c.rarity,
    condition: c.condition,
    language: c.language,
    typeLine: c.typeLine,
    price: c.price,
    currency: 'COP',
    stock: c.stock,
    imageUrl: c.imageUrl,
    sourceName: SOURCE_NAME,
    sourceId: c.id,
    sourceMeta: meta as unknown as Record<string, unknown>,
  }
}

function capitalizeFinish(f: string): string {
  const lower = f.toLowerCase()
  if (lower === 'foil') return 'Foil'
  if (lower === 'nonfoil') return 'Non-foil'
  if (lower === 'etched') return 'Etched'
  return f
}

/**
 * Builds the exact JSON that Rohan Spellbook expects in `localStorage.cart`.
 * Returns null if no items have the source meta needed.
 */
export function buildSpellbookCartPayload(
  items: WishlistItem[],
): string | null {
  const eligible = items.filter(
    (it) => it.sourceName === SOURCE_NAME && it.sourceMeta,
  )
  if (eligible.length === 0) return null
  const cartItems = eligible.map((it) => {
    const meta = it.sourceMeta as unknown as RohanSourceMeta
    return {
      id: `card-${meta.stockId}`,
      productType: 'card',
      stockId: meta.stockId,
      cardPrintingId: meta.cardPrintingId,
      name: meta.name,
      setName: meta.setName,
      setCode: meta.setCode.toUpperCase(),
      imageUrl: meta.imageUrl,
      price: meta.price,
      quantity: it.qty,
      maxQuantity: meta.maxQuantity,
      language: meta.language,
      condition: meta.condition,
      category: 'singles',
      finish: capitalizeFinish(meta.finish),
    }
  })
  return JSON.stringify(cartItems)
}
