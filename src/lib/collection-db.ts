/**
 * collection-db.ts — Dexie v4 database singleton for the MTG collection module.
 *
 * SCHEMA CONTRACT (v1 — additive-only after first release):
 *   To add new fields: use version(2).stores({ ...existingTables, newTable: '...' }).
 *   Never remove or rename existing indexes — this breaks existing user data.
 *   Breaking changes require a new DB name (e.g. 'mtg-collection-v2') plus a migrator.
 *
 * INDEX NOTES:
 *   - cards.id          — Scryfall UUID string PK (no ++). Idempotent via db.cards.put(card).
 *   - cards.*colors     — Multi-entry index for color filtering.
 *   - collection.&[cardId+finish+condition] — Compound UNIQUE.
 *                          finish is STRING ('nonfoil'|'foil'|'etched'), never boolean.
 *                          Boolean fields cannot participate in compound indexes in IndexedDB.
 *   - deckCards.[deckId+cardId] — Compound index (non-unique) for fast deck card lookups.
 */

import Dexie, { type Table } from 'dexie'
import type { Card, CollectionEntry } from '../domain/collection'
import type { Deck, DeckCard } from '../domain/deck'

export class CollectionDb extends Dexie {
  cards!: Table<Card, string>
  collection!: Table<CollectionEntry, number>
  decks!: Table<Deck, number>
  deckCards!: Table<DeckCard, number>

  constructor() {
    super('mtg-collection-v1')
    this.version(1).stores({
      cards: 'id, name, set, rarity, cmc, *colors, layout, prices.usd',
      collection: '++id, cardId, &[cardId+finish+condition], finish, condition, forTrade, addedAt',
      decks: '++id, name, commanderId, format, updatedAt',
      deckCards: '++id, deckId, cardId, [deckId+cardId], category',
    })
  }
}

/** Singleton instance — import this throughout the app. */
export const db = new CollectionDb()
