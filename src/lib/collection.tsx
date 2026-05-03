/**
 * collection.tsx — CollectionProvider: async Dexie-backed collection state.
 *
 * Mirrors wishlist.tsx pattern but with async Dexie writes and isReady lifecycle.
 * Reactive reads are NOT exposed through context — components use useLiveQuery directly.
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Card } from '../domain/collection'
import type { Deck, DeckCategory } from '../domain/deck'
import { db as defaultDb } from './collection-db'
import type { CollectionDb } from './collection-db'
import {
  CollectionContext,
  SingletonViolationError,
} from './collection-context'
import type { AddCardOpts, ImportSummary } from './collection-context'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBasicLand(card: Card): boolean {
  return card.type_line.includes('Basic Land')
}

// ---------------------------------------------------------------------------
// CollectionProvider
// ---------------------------------------------------------------------------

interface CollectionProviderProps {
  children: ReactNode
  /**
   * Optional Dexie instance to use instead of the singleton.
   * Pass a freshCollectionDb() instance in tests for isolation.
   */
  db?: CollectionDb
}

export function CollectionProvider({ children, db = defaultDb }: CollectionProviderProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    db.open()
      .then(() => {
        if (!cancelled) setIsReady(true)
      })
      .catch(() => {
        // DB open failure is silently ignored in production.
        // isReady stays false — UI shows loading state indefinitely.
      })
    return () => {
      cancelled = true
    }
  }, [db])

  // ---- Collection mutations ------------------------------------------------

  const addCard = useCallback(
    async (card: Card, opts: AddCardOpts = {}) => {
      const finish = opts.finish ?? 'nonfoil'
      const condition = opts.condition ?? 'NM'
      const quantity = opts.quantity ?? 1
      const forTrade = opts.forTrade ?? false
      const language = opts.language ?? 'en'
      const now = Date.now()

      await db.transaction('rw', db.cards, db.collection, async () => {
        // Upsert card metadata (idempotent on Scryfall UUID)
        await db.cards.put({ ...card, cachedAt: now })

        // Check for existing entry by compound key [cardId+finish+condition]
        const existing = await db.collection
          .where('[cardId+finish+condition]')
          .equals([card.id, finish, condition])
          .first()

        if (existing?.id !== undefined) {
          // Increment quantity on existing entry
          await db.collection.update(existing.id, {
            quantity: existing.quantity + quantity,
            updatedAt: now,
          })
        } else {
          // Create new entry
          await db.collection.add({
            cardId: card.id,
            finish,
            condition,
            quantity,
            forTrade,
            language,
            addedAt: now,
            updatedAt: now,
          })
        }
      })
    },
    [db],
  )

  const removeEntry = useCallback(
    async (id: number) => {
      await db.collection.delete(id)
    },
    [db],
  )

  const setQuantity = useCallback(
    async (id: number, quantity: number) => {
      if (quantity < 1) throw new RangeError('quantity must be ≥ 1')
      await db.collection.update(id, { quantity, updatedAt: Date.now() })
    },
    [db],
  )

  const toggleForTrade = useCallback(
    async (id: number) => {
      const entry = await db.collection.get(id)
      if (!entry) return
      await db.collection.update(id, { forTrade: !entry.forTrade, updatedAt: Date.now() })
    },
    [db],
  )

  // ---- Deck mutations -------------------------------------------------------

  const createDeck = useCallback(
    async (name: string, commanderId: string): Promise<number> => {
      const now = Date.now()
      const id = await db.decks.add({
        name,
        commanderId,
        format: 'commander',
        createdAt: now,
        updatedAt: now,
      } as Deck)
      return id as number
    },
    [db],
  )

  const updateDeck = useCallback(
    async (id: number, patch: Partial<Pick<Deck, 'name' | 'description'>>) => {
      await db.decks.update(id, { ...patch, updatedAt: Date.now() })
    },
    [db],
  )

  const deleteDeck = useCallback(
    async (id: number) => {
      await db.transaction('rw', db.decks, db.deckCards, async () => {
        await db.deckCards.where('deckId').equals(id).delete()
        await db.decks.delete(id)
      })
    },
    [db],
  )

  const addCardToDeck = useCallback(
    async (
      deckId: number,
      card: Card,
      opts: { category?: DeckCategory; quantity?: number } = {},
    ) => {
      const category = opts.category ?? 'mainboard'
      const quantity = opts.quantity ?? 1
      const now = Date.now()

      await db.transaction('rw', db.cards, db.decks, db.deckCards, async () => {
        // Upsert card metadata
        await db.cards.put({ ...card, cachedAt: now })

        const deck = await db.decks.get(deckId)
        if (!deck) throw new Error(`Deck ${deckId} not found`)

        // Singleton enforcement for commander format (non-commander categories)
        if (deck.format === 'commander' && category !== 'commander' && !isBasicLand(card)) {
          // Sum current quantity for this card in all non-commander categories of this deck
          const existingCards = await db.deckCards
            .where('deckId')
            .equals(deckId)
            .filter((dc) => dc.cardId === card.id && dc.category !== 'commander')
            .toArray()

          const currentQty = existingCards.reduce((sum, dc) => sum + dc.quantity, 0)

          if (currentQty + quantity > 1) {
            throw new SingletonViolationError(card.name)
          }
        }

        // Check for existing DeckCard by [deckId+cardId] compound (same category)
        const existing = await db.deckCards
          .where('[deckId+cardId]')
          .equals([deckId, card.id])
          .filter((dc) => dc.category === category)
          .first()

        if (existing?.id !== undefined) {
          await db.deckCards.update(existing.id, { quantity: existing.quantity + quantity })
        } else {
          await db.deckCards.add({
            deckId,
            cardId: card.id,
            quantity,
            category,
            addedAt: now,
          })
        }
      })
    },
    [db],
  )

  const removeFromDeck = useCallback(
    async (id: number) => {
      await db.deckCards.delete(id)
    },
    [db],
  )

  // ---- IO ------------------------------------------------------------------

  const importCsv = useCallback(
    async (text: string, format: 'moxfield' | 'archidekt' | 'auto' = 'auto'): Promise<ImportSummary> => {
      const { importCsv: doImport } = await import('./collection-io')
      return doImport(text, format, db)
    },
    [db],
  )

  const importBackup = useCallback(
    async (blob: Blob, mode: 'merge' | 'replace', mergeStrategy?: import('./collection-io').MergeStrategy): Promise<ImportSummary> => {
      const { importBackup: doImport } = await import('./collection-io')
      return doImport(blob, mode, db, mergeStrategy)
    },
    [db],
  )

  const exportBackup = useCallback(async (): Promise<Blob> => {
    const { exportBackup: doExport } = await import('./collection-io')
    return doExport(db)
  }, [db])

  const exportCsv = useCallback(async (): Promise<Blob> => {
    const { exportCsv: doExport } = await import('./collection-io')
    return doExport(db)
  }, [db])

  // ---- Context value -------------------------------------------------------

  const api = useMemo(
    () => ({
      isReady,
      addCard,
      removeEntry,
      setQuantity,
      toggleForTrade,
      createDeck,
      updateDeck,
      deleteDeck,
      addCardToDeck,
      removeFromDeck,
      importCsv,
      importBackup,
      exportBackup,
      exportCsv,
    }),
    [
      isReady,
      addCard,
      removeEntry,
      setQuantity,
      toggleForTrade,
      createDeck,
      updateDeck,
      deleteDeck,
      addCardToDeck,
      removeFromDeck,
      importCsv,
      importBackup,
      exportBackup,
      exportCsv,
    ],
  )

  return <CollectionContext.Provider value={api}>{children}</CollectionContext.Provider>
}
