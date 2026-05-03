import type { CardSource } from '../CardSource'
import type { NormalizedCard } from '../../domain/card'
import { toMatchKey } from '../../domain/card'
import {
  fetchAllShopifyProducts,
  type ShopifyProduct,
  type ShopifyVariant,
} from '../shopify-paginate'

const SOURCE_NAME = 'KartenJager'
const PRODUCTS_URL =
  'https://kartenjager.co/collections/all-singles/products.json'

const CONDITION_MAP: Record<string, string> = {
  'Near Mint': 'Near Mint',
  'Lightly Played': 'Lightly Played',
  'Moderately Played': 'Moderately Played',
  'Heavily Played': 'Heavily Played',
  Damaged: 'Damaged',
}

function parseTitle(title: string): { name: string; finish: string } {
  const m = title.match(/^(.+?)\s*\((Foil|Non-Foil)\)\s*$/i)
  if (!m) return { name: title, finish: 'nonfoil' }
  return {
    name: m[1],
    finish: m[2].toLowerCase() === 'foil' ? 'foil' : 'nonfoil',
  }
}

function parseSku(sku: string): { setCode: string; collectorNumber: string } {
  const parts = sku.split('_')
  return {
    setCode: (parts[0] ?? '').toUpperCase(),
    collectorNumber: parts[1] ?? '',
  }
}

function mapVariant(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  name: string,
  finish: string,
): NormalizedCard | null {
  if (!variant.available) return null
  const condition = CONDITION_MAP[variant.title]
  if (!condition) return null
  const price = Math.round(parseFloat(variant.price))
  if (price <= 0) return null
  const { setCode, collectorNumber } = parseSku(variant.sku)
  return {
    matchKey: toMatchKey(name),
    displayName: name,
    setName: '',
    setCode,
    collectorNumber,
    finish,
    rarity: '',
    condition,
    language: 'EN',
    typeLine: '',
    price,
    currency: 'COP',
    stock: 1,
    imageUrl: product.images[0]?.src ?? null,
    sourceName: SOURCE_NAME,
    sourceId: String(variant.id),
    sourceMeta: { handle: product.handle, variantId: variant.id },
  }
}

function mapProduct(product: ShopifyProduct): NormalizedCard[] {
  const { name, finish } = parseTitle(product.title)
  return product.variants
    .map((v) => mapVariant(product, v, name, finish))
    .filter((c): c is NormalizedCard => c !== null)
}

export const kartenJagerSource: CardSource = {
  name: SOURCE_NAME,
  async fetchInStock(signal, onProgress) {
    const products = await fetchAllShopifyProducts(
      PRODUCTS_URL,
      signal,
      onProgress,
    )
    return products.flatMap(mapProduct)
  },
}
