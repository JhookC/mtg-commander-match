import type { NormalizedCard } from './card'

export interface WishlistItem {
  /** Stable id derived from the variant (for remove/has lookups). */
  id: string
  matchKey: string
  displayName: string
  sourceName: string
  setName: string
  setCode: string
  collectorNumber: string
  finish: string
  condition: string
  language: string
  price: number
  currency: string
  imageUrl: string | null
  qty: number
  addedAt: number
  sourceMeta?: Record<string, unknown>
}

export function variantId(v: NormalizedCard): string {
  return [
    v.sourceName,
    v.matchKey,
    v.setCode,
    v.collectorNumber,
    v.finish,
    v.condition,
    v.language,
  ].join('|')
}

export function fromVariant(v: NormalizedCard, qty = 1): WishlistItem {
  return {
    id: variantId(v),
    matchKey: v.matchKey,
    displayName: v.displayName,
    sourceName: v.sourceName,
    setName: v.setName,
    setCode: v.setCode,
    collectorNumber: v.collectorNumber,
    finish: v.finish,
    condition: v.condition,
    language: v.language,
    price: v.price,
    currency: v.currency,
    imageUrl: v.imageUrl,
    qty,
    addedAt: Date.now(),
    sourceMeta: v.sourceMeta,
  }
}
