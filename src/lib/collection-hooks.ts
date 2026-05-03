/**
 * collection-hooks.ts — Live query hooks for collection data.
 *
 * All hooks use useLiveQuery from dexie-react-hooks for reactive UI updates.
 * Components consume these hooks directly — reads are NOT exposed through CollectionContext.
 *
 * NEVER call vi.useFakeTimers() in tests that exercise these hooks.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './collection-db'
import { detectTokensFromDeck, computeTradeAvailability } from './collection-engine'
import type { CollectionEntry, Card } from '../domain/collection'
import type { Deck, DeckCard } from '../domain/deck'
import type { Token } from '../domain/token'
import type { TradeAvailability } from './collection-engine'

// ---------------------------------------------------------------------------
// Collection filter + sort types
// ---------------------------------------------------------------------------

export interface CollectionFilter {
  /** Case-insensitive substring match on card name. */
  name?: string
  /** Exact match on card set code (3-letter). */
  set?: string
  /** Exact match on card rarity. */
  rarity?: Card['rarity']
  /** Multi-select: card must have ALL selected colors. */
  colors?: string[]
  /** Exact match on entry finish. */
  finish?: CollectionEntry['finish']
  /** When true, shows only entries where forTrade=true. */
  forTrade?: boolean
  /** Exact match on entry condition. */
  condition?: CollectionEntry['condition']
}

export type CollectionSortField =
  | 'name'
  | 'set'
  | 'rarity'
  | 'cmc'
  | 'price'
  | 'addedAt'

export interface CollectionSort {
  field: CollectionSortField
  direction: 'asc' | 'desc'
}

const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3 }

// ---------------------------------------------------------------------------
// useCollectionEntries
// ---------------------------------------------------------------------------

/**
 * Returns all collection entries with optional filter and sort applied.
 * Uses a single live query over the collection table; JS-side filtering for free-text.
 */
export function useCollectionEntries(
  filter?: CollectionFilter,
  sort?: CollectionSort,
): CollectionEntry[] {
  return (
    useLiveQuery(async (): Promise<CollectionEntry[]> => {
      let entries = await db.collection.toArray()

      if (filter) {
        if (filter.finish) {
          entries = entries.filter((e) => e.finish === filter.finish)
        }
        if (filter.forTrade !== undefined) {
          entries = entries.filter((e) => e.forTrade === filter.forTrade)
        }
        if (filter.condition) {
          entries = entries.filter((e) => e.condition === filter.condition)
        }

        // Card-based filters require joining with cards table
        if (filter.name || filter.set || filter.rarity || filter.colors?.length) {
          const cardIds = entries.map((e) => e.cardId)
          const cards = await db.cards.bulkGet(cardIds)
          const cardMap = new Map<string, Card>()
          for (const card of cards) {
            if (card) cardMap.set(card.id, card)
          }

          const nameLower = filter.name?.toLowerCase()
          entries = entries.filter((e) => {
            const card = cardMap.get(e.cardId)
            if (!card) return false
            if (nameLower && !card.name.toLowerCase().includes(nameLower)) return false
            if (filter.set && card.set !== filter.set) return false
            if (filter.rarity && card.rarity !== filter.rarity) return false
            if (filter.colors?.length) {
              const hasAllColors = filter.colors.every((c) => card.colors.includes(c))
              if (!hasAllColors) return false
            }
            return true
          })
        }
      }

      if (sort) {
        const dir = sort.direction === 'asc' ? 1 : -1
        entries = [...entries].sort((a, b) => {
          switch (sort.field) {
            case 'addedAt':
              return (a.addedAt - b.addedAt) * dir
            case 'name':
            case 'set':
            case 'rarity':
            case 'cmc':
            case 'price':
              // These require card data — return stable sort for now
              // Full card-based sorting is handled in the component with cardsById
              return 0
            default:
              return 0
          }
        })
      }

      return entries
    }, [
      filter?.name,
      filter?.set,
      filter?.rarity,
      filter?.finish,
      filter?.forTrade,
      filter?.condition,
      filter?.colors?.join(','),
      sort?.field,
      sort?.direction,
    ]) ?? []
  )
}

// ---------------------------------------------------------------------------
// useCollectionEntry
// ---------------------------------------------------------------------------

/** Returns a single collection entry by id, or undefined if not found. */
export function useCollectionEntry(id: number): CollectionEntry | undefined {
  return useLiveQuery(
    (): Promise<CollectionEntry | undefined> => db.collection.get(id),
    [id],
  )
}

// ---------------------------------------------------------------------------
// useCards
// ---------------------------------------------------------------------------

/** Returns all cards as a Map<id, Card> for O(1) lookups by id. */
export function useCards(): Map<string, Card> {
  return (
    useLiveQuery(
      (): Promise<Map<string, Card>> =>
        db.cards.toArray().then((arr) => new Map(arr.map((c) => [c.id, c]))),
      [],
    ) ?? new Map()
  )
}

// ---------------------------------------------------------------------------
// useDecks
// ---------------------------------------------------------------------------

/** Returns all decks. */
export function useDecks(): Deck[] {
  return useLiveQuery((): Promise<Deck[]> => db.decks.toArray(), []) ?? []
}

// ---------------------------------------------------------------------------
// useDeck
// ---------------------------------------------------------------------------

/** Returns a single deck by id, or undefined. */
export function useDeck(deckId: number): Deck | undefined {
  return useLiveQuery((): Promise<Deck | undefined> => db.decks.get(deckId), [deckId])
}

// ---------------------------------------------------------------------------
// useDeckCards
// ---------------------------------------------------------------------------

/** Returns all DeckCard rows for a given deck. */
export function useDeckCards(deckId: number): DeckCard[] {
  return (
    useLiveQuery(
      (): Promise<DeckCard[]> => db.deckCards.where('deckId').equals(deckId).toArray(),
      [deckId],
    ) ?? []
  )
}

// ---------------------------------------------------------------------------
// useTokensForDeck
// ---------------------------------------------------------------------------

/**
 * Derives the token list for a deck by composing:
 * - useDeckCards (deck's card list)
 * - useCards (card metadata including all_parts)
 * - collection ownership (Set of owned token cardIds)
 */
export function useTokensForDeck(deckId: number): Token[] {
  const deckCards = useDeckCards(deckId)
  const cardsById = useCards()

  return (
    useLiveQuery(async (): Promise<Token[]> => {
      if (deckCards.length === 0) return []

      // Build set of owned token cardIds from collection
      const ownedEntries = await db.collection.toArray()
      const ownedTokenIds = new Set(ownedEntries.map((e) => e.cardId))

      return detectTokensFromDeck(deckCards, cardsById, ownedTokenIds)
    }, [deckId, deckCards, cardsById]) ?? []
  )
}

// ---------------------------------------------------------------------------
// useTradeAvailabilityMap
// ---------------------------------------------------------------------------

/**
 * Computes trade availability for all cards in a single live query.
 * Uses computeTradeAvailability to derive Map<cardId, TradeAvailability>.
 */
export function useTradeAvailabilityMap(): Map<string, TradeAvailability> {
  return (
    useLiveQuery(async (): Promise<Map<string, TradeAvailability>> => {
      const [collection, deckCards] = await Promise.all([
        db.collection.toArray(),
        db.deckCards.toArray(),
      ])
      return computeTradeAvailability(collection, deckCards)
    }, []) ?? new Map()
  )
}

// ---------------------------------------------------------------------------
// Sorting helper (exported for component use)
// ---------------------------------------------------------------------------

/**
 * Sorts collection entries by card data (requires cardsById map).
 * Use in conjunction with useCollectionEntries for card-data-based sorting.
 */
export function sortEntriesByCard(
  entries: CollectionEntry[],
  cardsById: Map<string, Card>,
  sort: CollectionSort,
): CollectionEntry[] {
  const dir = sort.direction === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    const cardA = cardsById.get(a.cardId)
    const cardB = cardsById.get(b.cardId)
    if (!cardA || !cardB) return 0

    switch (sort.field) {
      case 'name':
        return cardA.name.localeCompare(cardB.name) * dir
      case 'set':
        return cardA.set.localeCompare(cardB.set) * dir
      case 'rarity':
        return ((RARITY_ORDER[cardA.rarity] ?? 0) - (RARITY_ORDER[cardB.rarity] ?? 0)) * dir
      case 'cmc':
        return (cardA.cmc - cardB.cmc) * dir
      case 'price': {
        const priceA = parseFloat(cardA.prices?.usd ?? '0')
        const priceB = parseFloat(cardB.prices?.usd ?? '0')
        return (priceA - priceB) * dir
      }
      case 'addedAt':
        return (a.addedAt - b.addedAt) * dir
      default:
        return 0
    }
  })
}
