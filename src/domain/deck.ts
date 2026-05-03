// Domain types for commander decks.
// TS 6.0 erasableSyntaxOnly: ZERO enum keywords — use `as const` arrays + derived union types.

export const DECK_CATEGORIES = ['commander', 'mainboard', 'sideboard', 'maybeboard'] as const
export type DeckCategory = (typeof DECK_CATEGORIES)[number]

/** v1: commander only. Additional formats may be added in future schema versions. */
export const DECK_FORMATS = ['commander'] as const
export type DeckFormat = (typeof DECK_FORMATS)[number]

export interface Deck {
  /** Auto-increment PK managed by Dexie. */
  id?: number
  /** User-defined deck name (max 100 chars). Required. */
  name: string
  /** Scryfall UUID of the commander card. Required. */
  commanderId: string
  format: DeckFormat
  description?: string
  /** Unix ms timestamp. */
  createdAt: number
  /** Unix ms timestamp. */
  updatedAt: number
}

export interface DeckCard {
  /** Auto-increment PK managed by Dexie. */
  id?: number
  deckId: number
  /** Scryfall UUID. */
  cardId: string
  /** Quantity. Always ≥ 1. Singleton rule enforced in application code for commander format. */
  quantity: number
  category: DeckCategory
  /** Unix ms timestamp. */
  addedAt: number
}
