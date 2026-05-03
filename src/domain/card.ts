export interface NormalizedCard {
  /** Slug-style key: lowercase, alphanumeric only, no spaces. Used to match across sources. */
  matchKey: string
  displayName: string
  setName: string
  setCode: string
  collectorNumber: string
  finish: string
  rarity: string
  condition: string
  language: string
  typeLine: string
  /** Price in minor units (e.g. cents). Source decides currency. */
  price: number
  currency: string
  stock: number
  imageUrl: string | null
  sourceName: string
  /** Stable id within the source. */
  sourceId: string
  /** Opaque source-specific payload used to rebuild a cart transfer. */
  sourceMeta?: Record<string, unknown>
}

export interface MatchedCardGroup {
  matchKey: string
  displayName: string
  category: string
  categoryHeader: string
  synergy: number
  inclusion: number
  numDecks: number
  potentialDecks: number
  /** Inclusion ratio in 0..1 (numDecks / potentialDecks). */
  inclusionRate: number
  isHighSynergy: boolean
  isTopCard: boolean
  isGameChanger: boolean
  /** All in-stock printings, sorted by price ascending. */
  variants: NormalizedCard[]
  /** Cheapest variant — used for default display. */
  primaryVariant: NormalizedCard
  minPrice: number
  totalStock: number
  currency: string
  /** Unique source names that have at least one variant in stock. */
  availableSources: string[]
}

export function toMatchKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}
