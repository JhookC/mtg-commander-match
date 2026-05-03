/**
 * collection-context.ts — CollectionApi interface, React context, and useCollection hook.
 *
 * Mirrors the wishlist-context.ts pattern.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { createContext, useContext } from 'react'
import type { Card } from '../domain/collection'
import type { Finish, Condition } from '../domain/collection'
import type { Deck, DeckCard, DeckCategory } from '../domain/deck'

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export interface AddCardOpts {
  /** Defaults to 'nonfoil'. */
  finish?: Finish
  /** Defaults to 'NM'. */
  condition?: Condition
  /** Defaults to 1. */
  quantity?: number
  /** Defaults to false. */
  forTrade?: boolean
  /** ISO language code. Defaults to 'en'. */
  language?: string
}

export interface ImportSummary {
  added: number
  updated: number
  skipped: number
  errors: Array<{ row: number; reason: string }>
}

// ---------------------------------------------------------------------------
// CollectionApi
// ---------------------------------------------------------------------------

export interface CollectionApi {
  /** True once db.open() has resolved. Consumers should show loading state while false. */
  isReady: boolean

  // ---- Collection mutations ------------------------------------------------

  /** Upserts a card into the `cards` table, then adds/increments a CollectionEntry. */
  addCard: (card: Card, opts?: AddCardOpts) => Promise<void>

  /** Removes a collection entry by its auto-increment id. */
  removeEntry: (id: number) => Promise<void>

  /** Sets the quantity for a collection entry. Must be ≥ 1. */
  setQuantity: (id: number, quantity: number) => Promise<void>

  /** Toggles the forTrade flag on a collection entry. */
  toggleForTrade: (id: number) => Promise<void>

  // ---- Deck mutations -------------------------------------------------------

  /** Creates a new deck and returns its auto-generated id. */
  createDeck: (name: string, commanderId: string) => Promise<number>

  /** Updates mutable fields on a deck. */
  updateDeck: (id: number, patch: Partial<Pick<Deck, 'name' | 'description'>>) => Promise<void>

  /** Deletes a deck and all its DeckCard rows. */
  deleteDeck: (id: number) => Promise<void>

  /**
   * Adds a card to a deck slot.
   * Enforces the commander-format singleton rule (throws SingletonViolationError for
   * non-basic land cards that would exceed qty=1 in mainboard+sideboard+maybeboard).
   * Upserts the card into the `cards` table first.
   */
  addCardToDeck: (
    deckId: number,
    card: Card,
    opts?: { category?: DeckCategory; quantity?: number },
  ) => Promise<void>

  /** Removes a DeckCard row by its auto-increment id. */
  removeFromDeck: (id: number) => Promise<void>

  // ---- IO ------------------------------------------------------------------

  /** Imports a CSV string in Moxfield or Archidekt format. */
  importCsv: (text: string, format?: 'moxfield' | 'archidekt' | 'auto') => Promise<ImportSummary>

  /** Imports from a JSON backup blob. */
  importBackup: (blob: Blob, mode: 'merge' | 'replace', mergeStrategy?: import('./collection-io').MergeStrategy) => Promise<ImportSummary>

  /** Exports the full database as a JSON backup blob. */
  exportBackup: () => Promise<Blob>

  /** Exports the collection as a CSV blob in Archidekt format. */
  exportCsv: () => Promise<Blob>
}

// ---------------------------------------------------------------------------
// Context + hook
// ---------------------------------------------------------------------------

export const CollectionContext = createContext<CollectionApi | null>(null)

export function useCollection(): CollectionApi {
  const ctx = useContext(CollectionContext)
  if (!ctx) {
    throw new Error('useCollection must be used inside CollectionProvider')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Singleton violation error
// ---------------------------------------------------------------------------

/** Thrown by addCardToDeck when the commander singleton rule would be violated. */
export class SingletonViolationError extends Error {
  constructor(cardName: string) {
    super(
      `Formato Comandante: solo se permite 1 copia de cada carta (excepto tierras básicas) — "${cardName}"`,
    )
    this.name = 'SingletonViolationError'
  }
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { DeckCard }
