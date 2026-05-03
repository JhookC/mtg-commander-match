import type { CardSource } from '../CardSource'
import type { NormalizedCard } from '../../domain/card'
import { toMatchKey } from '../../domain/card'
import type { WishlistItem } from '../../domain/wishlist'

const BASE_URL = 'https://api.topcard-tcg.com/api/cards-mtg'
const PAGE_SIZE = 500
const SOURCE_NAME = 'TopCard'

interface TopcardImageFormat {
  name?: string
  url?: string
  width?: number
  height?: number
}

interface TopcardImageAttrs {
  name?: string
  url?: string
  width?: number
  height?: number
  isUrlSigned?: boolean
  formats?: {
    small?: TopcardImageFormat
    medium?: TopcardImageFormat
    xsmall?: TopcardImageFormat
    thumbnail?: TopcardImageFormat
  }
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
  topcard_price?: number | null
  has_discount?: boolean
  show_home_page?: boolean
  show_carousel?: boolean
  discount?: number | null
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
  id_scryfall?: string
  set?: string | null
  set_name: string
  type_line?: string | null
  collector_number?: string | null
  rarity?: string | null
  finishes?: string | null
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

interface TopcardImageBlock {
  name: string
  url: string
  width: number
  height: number
  formats: Record<string, TopcardImageFormat>
}

interface TopcardStockBlock {
  id: number
  condition: string
  discount: number | null
  show_home_page: boolean
  has_discount: boolean
  show_carousel: boolean
  finishes: string
  language: string
  topcard_price: number
  stock: number
  card: {
    id: number
    id_scryfall: string
    name: string
    set: string
    set_name: string
    type_line: string
    collector_number: string
  }
}

interface TopcardCardBlock {
  id: number
  name: string
  set_name: string
  type_line: string
  collector_number: string
  finishes: string[]
  topcard_etched_price: number | null
  topcard_foil_price: number | null
  topcard_price: number | null
  game_tag: 'mtg'
  images: TopcardImageBlock
  stock_card: TopcardStockBlock[]
}

/**
 * Source-specific payload kept on each NormalizedCard so we can rebuild
 * TopCard's `shopping_cart` localStorage format later.
 */
interface TopcardSourceMeta {
  thisStock: TopcardStockBlock
  card: TopcardCardBlock
}

const CARD_FIELDS = [
  'name',
  'id_scryfall',
  'set',
  'set_name',
  'type_line',
  'collector_number',
  'rarity',
  'finishes',
  'topcard_price',
  'topcard_foil_price',
  'topcard_etched_price',
]

const IMAGE_FIELDS = ['name', 'url', 'width', 'height', 'formats']

const STOCK_FIELDS = [
  'stock',
  'condition',
  'finishes',
  'language',
  'topcard_price',
  'has_discount',
  'show_home_page',
  'show_carousel',
  'discount',
]

function buildUrl(page: number): string {
  const params = new URLSearchParams()
  CARD_FIELDS.forEach((f, i) => params.append(`fields[${i}]`, f))
  params.append('pagination[page]', String(page))
  params.append('pagination[pageSize]', String(PAGE_SIZE))
  params.append('filters[stock_mtg_cards][stock][$gt]', '0')
  IMAGE_FIELDS.forEach((f, i) =>
    params.append(`populate[images][fields][${i}]`, f),
  )
  STOCK_FIELDS.forEach((f, i) =>
    params.append(`populate[stock_mtg_cards][fields][${i}]`, f),
  )
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

function parseFinishes(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function buildImageBlock(img?: TopcardImageAttrs): TopcardImageBlock {
  return {
    name: img?.name ?? '',
    url: img?.url ?? '',
    width: img?.width ?? 0,
    height: img?.height ?? 0,
    formats:
      (img?.formats as Record<string, TopcardImageFormat> | undefined) ?? {},
  }
}

function buildStockBlock(
  stock: TopcardStockEntry,
  card: TopcardCard,
): TopcardStockBlock {
  const ca = card.attributes
  const sa = stock.attributes
  return {
    id: stock.id,
    condition: sa.condition,
    discount: sa.discount ?? null,
    show_home_page: sa.show_home_page ?? false,
    has_discount: sa.has_discount ?? false,
    show_carousel: sa.show_carousel ?? false,
    finishes: sa.finishes,
    language: sa.language,
    topcard_price: sa.topcard_price ?? 0,
    stock: sa.stock,
    card: {
      id: card.id,
      id_scryfall: ca.id_scryfall ?? '',
      name: ca.name,
      set: ca.set ?? '',
      set_name: ca.set_name,
      type_line: ca.type_line ?? '',
      collector_number: ca.collector_number ?? '',
    },
  }
}

function buildCardBlock(card: TopcardCard): TopcardCardBlock {
  const ca = card.attributes
  const allStocks = (ca.stock_mtg_cards?.data ?? []).map((s) =>
    buildStockBlock(s, card),
  )
  return {
    id: card.id,
    name: ca.name,
    set_name: ca.set_name,
    type_line: ca.type_line ?? '',
    collector_number: ca.collector_number ?? '',
    finishes: parseFinishes(ca.finishes),
    topcard_etched_price: ca.topcard_etched_price ?? null,
    topcard_foil_price: ca.topcard_foil_price ?? null,
    topcard_price: ca.topcard_price ?? null,
    game_tag: 'mtg',
    images: buildImageBlock(card.attributes.images?.data?.attributes),
    stock_card: allStocks,
  }
}

function mapCard(card: TopcardCard): NormalizedCard[] {
  const attrs = card.attributes
  const stocks = attrs.stock_mtg_cards?.data ?? []
  const imageUrl = attrs.images?.data?.attributes?.url ?? null
  const matchKey = toMatchKey(attrs.name)
  const cardBlock = buildCardBlock(card)
  const out: NormalizedCard[] = []
  for (const s of stocks) {
    const sa = s.attributes
    if (sa.stock <= 0) continue
    const price = pickPrice(sa.finishes, attrs)
    if (price === null || price <= 0) continue
    const stockBlock = buildStockBlock(s, card)
    const meta: TopcardSourceMeta = { thisStock: stockBlock, card: cardBlock }
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
      sourceMeta: meta as unknown as Record<string, unknown>,
    })
  }
  return out
}

/**
 * Builds the exact JSON that TopCard expects in `localStorage.shopping_cart`.
 * Returns null if no items have the source meta needed.
 */
export function buildTopcardCartPayload(items: WishlistItem[]): string | null {
  const eligible = items.filter(
    (it) => it.sourceName === SOURCE_NAME && it.sourceMeta,
  )
  if (eligible.length === 0) return null
  const cartItems = eligible.map((it) => {
    const meta = it.sourceMeta as unknown as TopcardSourceMeta
    return {
      Item: {
        id: meta.thisStock.id,
        condition: meta.thisStock.condition,
        discount: meta.thisStock.discount,
        show_home_page: meta.thisStock.show_home_page,
        has_discount: meta.thisStock.has_discount,
        show_carousel: meta.thisStock.show_carousel,
        finishes: meta.thisStock.finishes,
        language: meta.thisStock.language,
        topcard_price: 0,
        stock: meta.thisStock.stock,
        card: meta.thisStock.card,
      },
      Quantity: it.qty,
      type: 'StockCard' as const,
      card: meta.card,
      isValid: true,
    }
  })
  return JSON.stringify({
    state: { cart: { Items: cartItems } },
    version: 0,
  })
}

export const topcardSource: CardSource = {
  name: SOURCE_NAME,
  async fetchInStock(signal, onProgress) {
    onProgress?.({ loaded: 0, total: 1 })
    const first = await fetchPage(1, signal)
    const totalPages = first.meta.pagination.pageCount
    let done = 1
    onProgress?.({ loaded: done, total: totalPages })
    const responses: TopcardResponse[] = [first]
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchPage(i + 2, signal).then((r) => {
            done++
            onProgress?.({ loaded: done, total: totalPages })
            return r
          }),
        ),
      )
      responses.push(...rest)
    }
    return responses.flatMap((r) => r.data.flatMap(mapCard))
  },
}
