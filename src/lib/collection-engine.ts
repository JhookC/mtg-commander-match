/**
 * collection-engine.ts — Pure functions for derived collection data.
 *
 * All functions take data as arguments and return data.
 * No Dexie, no React, no side effects — fully testable without mocks.
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import type { Card, CollectionEntry } from '../domain/collection'
import type { DeckCard } from '../domain/deck'
import type { Token } from '../domain/token'

// ---------------------------------------------------------------------------
// detectTokensFromDeck
// ---------------------------------------------------------------------------

/**
 * Derives the list of tokens produced by a deck.
 *
 * For each deck card, inspects `card.all_parts` for entries with
 * `component === 'token'`. Deduplicates by token cardId.
 *
 * @param deckCards   - Cards currently in the deck.
 * @param cardsById   - Map of cardId → Card (all cards the deck references must be present).
 * @param ownedTokens - Set of cardIds the user owns at least one copy of (any finish/condition).
 * @returns Array of Token objects, deduped by cardId.
 *
 * KNOWN V1 GAP: If `all_parts` is absent on a card, tokens for that card are NOT detected.
 * A fire-and-forget background refresh via `getCardByExactName` can update the card cache,
 * but this function itself makes no network calls. The caller is responsible for re-querying
 * if the card cache is updated.
 */
export function detectTokensFromDeck(
  deckCards: DeckCard[],
  cardsById: ReadonlyMap<string, Card>,
  ownedTokens: ReadonlySet<string>,
): Token[] {
  const out = new Map<string, Token>()

  for (const dc of deckCards) {
    const card = cardsById.get(dc.cardId)
    if (!card) continue

    if (!card.all_parts?.length) {
      // No all_parts available — cannot detect tokens for this card.
      // Caller should refresh card data from Scryfall if needed.
      continue
    }

    for (const part of card.all_parts) {
      if (part.component !== 'token') continue
      // Avoid self-reference (card listed as its own part)
      if (part.id === card.id) continue

      const existing = out.get(part.id)
      if (existing) {
        if (!existing.fromCardIds.includes(dc.cardId)) {
          existing.fromCardIds.push(dc.cardId)
        }
      } else {
        const ownedQuantity = ownedTokens.has(part.id) ? 1 : 0
        out.set(part.id, {
          cardId: part.id,
          name: part.name,
          imageUrl: undefined, // resolved lazily via getCardByExactName in UI
          fromCardIds: [dc.cardId],
          ownedQuantity,
          status: ownedQuantity > 0 ? 'have' : 'missing',
        })
      }
    }
  }

  return Array.from(out.values())
}

// ---------------------------------------------------------------------------
// computeTradeAvailability
// ---------------------------------------------------------------------------

export interface TradeAvailability {
  cardId: string
  totalOwned: number
  inDecks: number
  available: number
  isAvailable: boolean
}

/**
 * Computes trade availability for every card in the collection.
 *
 * Trade availability = (sum of quantity across all collection entries for a cardId)
 *                    − (sum of quantity across all deckCards for that cardId)
 *
 * Result is always ≥ 0 (negative values are clamped to 0).
 * `forTrade` flag is INDEPENDENT from trade availability — this function does not use it.
 *
 * @param collection - All collection entries (across all finishes and conditions).
 * @param deckCards  - All deck cards (across all decks).
 * @returns Map keyed by cardId with TradeAvailability values.
 */
export function computeTradeAvailability(
  collection: CollectionEntry[],
  deckCards: DeckCard[],
): Map<string, TradeAvailability> {
  // Sum quantity per cardId from collection
  const ownedByCard = new Map<string, number>()
  for (const entry of collection) {
    ownedByCard.set(entry.cardId, (ownedByCard.get(entry.cardId) ?? 0) + entry.quantity)
  }

  // Sum quantity per cardId from all decks
  const inDecksByCard = new Map<string, number>()
  for (const dc of deckCards) {
    inDecksByCard.set(dc.cardId, (inDecksByCard.get(dc.cardId) ?? 0) + dc.quantity)
  }

  // Build result map (only cards that are in the collection)
  const result = new Map<string, TradeAvailability>()
  for (const [cardId, totalOwned] of ownedByCard) {
    const inDecks = inDecksByCard.get(cardId) ?? 0
    const available = Math.max(0, totalOwned - inDecks)
    result.set(cardId, {
      cardId,
      totalOwned,
      inDecks,
      available,
      isAvailable: available > 0,
    })
  }

  return result
}
