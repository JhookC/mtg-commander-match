import type { FetchProgress } from './CardSource'

export interface ShopifyVariant {
  id: number
  title: string
  sku: string
  price: string
  available: boolean
  option1: string | null
  option2: string | null
  option3: string | null
}

export interface ShopifyImage {
  src: string
}

export interface ShopifyOption {
  name: string
  position: number
  values: string[]
}

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  vendor: string
  product_type: string
  tags: string[]
  options: ShopifyOption[]
  variants: ShopifyVariant[]
  images: ShopifyImage[]
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[]
}

const PAGE_SIZE = 250

async function fetchPage(
  baseUrl: string,
  page: number,
  signal?: AbortSignal,
): Promise<ShopifyProduct[]> {
  const res = await fetch(`${baseUrl}?limit=${PAGE_SIZE}&page=${page}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok)
    throw new Error(`Shopify fetch failed (page ${page}): ${res.status}`)
  const data = (await res.json()) as ShopifyProductsResponse
  return data.products
}

export async function fetchAllShopifyProducts(
  baseUrl: string,
  signal?: AbortSignal,
  onProgress?: (p: FetchProgress) => void,
): Promise<ShopifyProduct[]> {
  onProgress?.({ loaded: 0, total: 1 })
  const all: ShopifyProduct[] = []
  let page = 1
  while (true) {
    const products = await fetchPage(baseUrl, page, signal)
    all.push(...products)
    if (products.length < PAGE_SIZE) break
    page++
    onProgress?.({ loaded: page - 1, total: page })
  }
  onProgress?.({ loaded: 1, total: 1 })
  return all
}
