import type { CardSource } from '../CardSource'
import type { NormalizedCard } from '../../domain/card'
import { toMatchKey } from '../../domain/card'

interface RohanCard {
  id: string
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

export const rohanSource: CardSource = {
  name: SOURCE_NAME,
  async fetchInStock(signal) {
    const res = await fetch(ENDPOINT, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Rohan source failed: ${res.status}`)
    }
    const data = (await res.json()) as RohanResponse
    return data.results.filter((c) => c.hasStock).map(mapRohanCard)
  },
}

function mapRohanCard(c: RohanCard): NormalizedCard {
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
  }
}
