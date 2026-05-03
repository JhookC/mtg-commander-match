// Domain types for the MTG collection module.
// TS 6.0 erasableSyntaxOnly: ZERO enum keywords — use `as const` arrays + derived union types.

export const FINISHES = ['nonfoil', 'foil', 'etched'] as const
export type Finish = (typeof FINISHES)[number]

export const CONDITIONS = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG'] as const
export type Condition = (typeof CONDITIONS)[number]
export const DEFAULT_CONDITION: Condition = 'NM'

export interface CardImageUris {
  small?: string
  normal?: string
  large?: string
  art_crop?: string
}

export interface CardRelatedPart {
  id: string
  name: string
  type_line: string
  component: 'token' | 'meld_part' | 'meld_result' | 'combo_piece'
  uri?: string
}

export interface CardPrices {
  usd?: string | null
  eur?: string | null
}

export interface Card {
  /** Scryfall UUID — primary key in Dexie `cards` table. */
  id: string
  oracle_id?: string
  name: string
  set: string
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus'
  type_line: string
  colors: string[]
  color_identity: string[]
  cmc: number
  mana_cost?: string
  oracle_text?: string
  /** Scryfall layout: 'normal' | 'token' | 'transform' | 'modal_dfc' | ... */
  layout: string
  image_uris?: CardImageUris
  card_faces?: Array<{ name: string; image_uris?: CardImageUris }>
  all_parts?: CardRelatedPart[]
  prices?: CardPrices
  /** Unix ms timestamp of when this card was cached from Scryfall. */
  cachedAt: number
}

export interface CollectionEntry {
  /** Auto-increment PK managed by Dexie. */
  id?: number
  /** Scryfall card UUID. */
  cardId: string
  finish: Finish
  condition: Condition
  /** Quantity owned. Always ≥ 1. */
  quantity: number
  forTrade: boolean
  /** ISO language code, e.g. 'en'. */
  language: string
  /** Unix ms timestamp of when this entry was first added. */
  addedAt: number
  /** Unix ms timestamp of last update. */
  updatedAt: number
  notes?: string
}
