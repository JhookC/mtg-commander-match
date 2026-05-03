import type { CardSource } from '../CardSource'
import type { NormalizedCard } from '../../domain/card'
import { toMatchKey } from '../../domain/card'

const BASE_URL = 'https://api.topcard-tcg.com/api/cards-mtg'
const PAGE_SIZE = 500
const SOURCE_NAME = 'TopCard'

interface TopcardImageAttrs {
  url?: string
}

interface TopcardImageData {
  attributes?: TopcardImageAttrs
}

interface TopcardImage {
  data?: TopcardImageData | null
}

interface TopcardStockAttrs {
  stock: number
  condition: string
  finishes: string
  language: string
}

interface TopcardStockEntry {
  id: number
  attributes: TopcardStockAttrs
}

interface TopcardStockMtgCards {
  data?: TopcardStockEntry[] | null
}

interface TopcardCardAttrs {
  name: string
  set?: string | null
  set_name: string
  type_line?: string | null
  collector_number?: string | null
  rarity?: string | null
  topcard_price?: number | null
  topcard_foil_price?: number | null
  topcard_etched_price?: number | null
  images?: TopcardImage
  stock_mtg_cards?: TopcardStockMtgCards
}

interface TopcardCard {
  id: number
  attributes: TopcardCardAttrs
}

interface TopcardResponse {
  data: TopcardCard[]
  meta: {
    pagination: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

const CARD_FIELDS = [
  'name',
  'set',
  'set_name',
  'type_line',
  'collector_number',
  'rarity',
  'topcard_price',
  'topcard_foil_price',
  'topcard_etched_price',
]

function buildUrl(page: number): string {
  const params = new URLSearchParams()
  CARD_FIELDS.forEach((f, i) => params.append(`fields[${i}]`, f))
  params.append('pagination[page]', String(page))
  params.append('pagination[pageSize]', String(PAGE_SIZE))
  params.append('filters[stock_mtg_cards][stock][$gt]', '0')
  params.append('populate[images][fields][0]', 'url')
  params.append('populate[stock_mtg_cards][fields][0]', 'stock')
  params.append('populate[stock_mtg_cards][fields][1]', 'condition')
  params.append('populate[stock_mtg_cards][fields][2]', 'finishes')
  params.append('populate[stock_mtg_cards][fields][3]', 'language')
  return `${BASE_URL}?${params.toString()}`
}

async function fetchPage(
  page: number,
  signal?: AbortSignal,
): Promise<TopcardResponse> {
  const res = await fetch(buildUrl(page), {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`TopCard fetch failed (page ${page}): ${res.status}`)
  }
  return (await res.json()) as TopcardResponse
}

function pickPrice(finish: string, attrs: TopcardCardAttrs): number | null {
  if (finish === 'foil') return attrs.topcard_foil_price ?? null
  if (finish === 'etched') return attrs.topcard_etched_price ?? null
  return attrs.topcard_price ?? null
}

function mapCard(card: TopcardCard): NormalizedCard[] {
  const attrs = card.attributes
  const stocks = attrs.stock_mtg_cards?.data ?? []
  const imageUrl = attrs.images?.data?.attributes?.url ?? null
  const matchKey = toMatchKey(attrs.name)
  const out: NormalizedCard[] = []
  for (const s of stocks) {
    const sa = s.attributes
    if (sa.stock <= 0) continue
    const price = pickPrice(sa.finishes, attrs)
    if (price === null || price <= 0) continue
    out.push({
      matchKey,
      displayName: attrs.name,
      setName: attrs.set_name,
      setCode: attrs.set ?? '',
      collectorNumber: attrs.collector_number ?? '',
      finish: sa.finishes,
      rarity: attrs.rarity ?? '',
      condition: sa.condition,
      language: sa.language,
      typeLine: attrs.type_line ?? '',
      price,
      currency: 'COP',
      stock: sa.stock,
      imageUrl,
      sourceName: SOURCE_NAME,
      sourceId: `${card.id}-${s.id}`,
    })
  }
  return out
}

export const topcardSource: CardSource = {
  name: SOURCE_NAME,
  async fetchInStock(signal) {
    const first = await fetchPage(1, signal)
    const totalPages = first.meta.pagination.pageCount
    const responses: TopcardResponse[] = [first]
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchPage(i + 2, signal),
        ),
      )
      responses.push(...rest)
    }
    return responses.flatMap((r) => r.data.flatMap(mapCard))
  },
}
