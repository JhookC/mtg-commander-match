import type { CardSource } from '../CardSource'
import type { NormalizedCard } from '../../domain/card'
import { toMatchKey } from '../../domain/card'
import {
  fetchAllShopifyProducts,
  type ShopifyProduct,
  type ShopifyVariant,
} from '../shopify-paginate'

const SOURCE_NAME = 'TheVault'
const PRODUCTS_URL = 'https://thevaultmtg.com/collections/singles/products.json'

const RARITIES = new Set([
  'common',
  'uncommon',
  'rare',
  'mythic',
  'special',
  'bonus',
])

const KNOWN_NON_SET_TAGS = new Set([
  'card',
  'no-foil',
  'foil',
  'etched',
  'common',
  'uncommon',
  'rare',
  'mythic',
  'special',
  'bonus',
  'token',
])

function parseFinish(variantTitle: string): string {
  const lower = variantTitle.toLowerCase()
  if (lower.includes('etched')) return 'etched'
  if (lower === 'foil') return 'foil'
  return 'nonfoil'
}

function parseRarity(tags: string[]): string {
  return tags.find((t) => RARITIES.has(t.toLowerCase())) ?? ''
}

function parseSetName(tags: string[]): string {
  return tags.find((t) => !KNOWN_NON_SET_TAGS.has(t.toLowerCase())) ?? ''
}

function parseSku(sku: string): { setCode: string; collectorNumber: string } {
  const parts = sku.split('-')
  return {
    setCode: (parts[0] ?? '').toUpperCase(),
    collectorNumber: parts[1] ?? '',
  }
}

function mapVariant(
  product: ShopifyProduct,
  variant: ShopifyVariant,
): NormalizedCard | null {
  if (!variant.available) return null
  const price = Math.round(parseFloat(variant.price))
  if (price <= 0) return null
  const { setCode, collectorNumber } = parseSku(variant.sku)
  return {
    matchKey: toMatchKey(product.title),
    displayName: product.title,
    setName: parseSetName(product.tags),
    setCode,
    collectorNumber,
    finish: parseFinish(variant.title),
    rarity: parseRarity(product.tags),
    condition: 'Near Mint',
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
  return product.variants
    .map((v) => mapVariant(product, v))
    .filter((c): c is NormalizedCard => c !== null)
}

export const theVaultSource: CardSource = {
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
