// Token domain types — derived, never persisted to Dexie directly.
// Tokens may be stored as regular CollectionEntry records when the user owns them.

export interface Token {
  /** Scryfall UUID of the token card. */
  cardId: string
  name: string
  imageUrl?: string
  /** Which deck card IDs reference this token (via all_parts). */
  fromCardIds: string[]
  /** Number of owned copies across all finishes and conditions. */
  ownedQuantity: number
  status: 'have' | 'missing'
}

export interface TokenStatus {
  token: Token
  have: boolean
  ownedQuantity: number
}
