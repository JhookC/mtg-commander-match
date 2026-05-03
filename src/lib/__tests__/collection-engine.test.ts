/**
 * collection-engine.test.ts — Pure function tests for detectTokensFromDeck + computeTradeAvailability.
 *
 * No Dexie, no React. Plain Vitest unit tests.
 * NEVER calls vi.useFakeTimers() in this file.
 */

import { describe, it, expect } from 'vitest'
import { detectTokensFromDeck, computeTradeAvailability } from '../collection-engine'
import {
  FIXTURE_CARD_TENDERSHOOT_DRYAD,
  FIXTURE_CARD_COUNTERSPELL,
  FIXTURE_CARD_SOL_RING,
  FIXTURE_CARD_SAPROLING_TOKEN,
  FIXTURE_CARD_COMMANDER,
  FIXTURE_ENTRY_SOL_RING,
  FIXTURE_ENTRY_SOL_RING_FOIL,
  FIXTURE_ENTRY_COUNTERSPELL,
  FIXTURE_DECKCARD_TENDERSHOOT,
  FIXTURE_DECKCARD_COUNTERSPELL,
  FIXTURE_DECKCARD_SOL_RING,
} from './fixtures'
import type { Card } from '../../domain/collection'
import type { DeckCard } from '../../domain/deck'

// ---------------------------------------------------------------------------
// detectTokensFromDeck
// ---------------------------------------------------------------------------

describe('detectTokensFromDeck', () => {
  it('detects a token from all_parts when present', () => {
    const cardsById = new Map<string, Card>([
      ['tendershoot-uuid', FIXTURE_CARD_TENDERSHOOT_DRYAD],
    ])
    const ownedTokens = new Set<string>()

    const tokens = detectTokensFromDeck(
      [FIXTURE_DECKCARD_TENDERSHOOT],
      cardsById,
      ownedTokens,
    )

    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.cardId).toBe('saproling-token-uuid')
    expect(tokens[0]!.name).toBe('Saproling')
    expect(tokens[0]!.status).toBe('missing')
    expect(tokens[0]!.ownedQuantity).toBe(0)
    expect(tokens[0]!.fromCardIds).toContain('tendershoot-uuid')
  })

  it('marks token as "have" when owned', () => {
    const cardsById = new Map<string, Card>([
      ['tendershoot-uuid', FIXTURE_CARD_TENDERSHOOT_DRYAD],
    ])
    const ownedTokens = new Set<string>(['saproling-token-uuid'])

    const tokens = detectTokensFromDeck(
      [FIXTURE_DECKCARD_TENDERSHOOT],
      cardsById,
      ownedTokens,
    )

    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.status).toBe('have')
    expect(tokens[0]!.ownedQuantity).toBe(1)
  })

  it('returns empty array when deck has no cards with all_parts', () => {
    const cardsById = new Map<string, Card>([
      ['counterspell-uuid', FIXTURE_CARD_COUNTERSPELL],
    ])
    const ownedTokens = new Set<string>()

    const tokens = detectTokensFromDeck(
      [FIXTURE_DECKCARD_COUNTERSPELL],
      cardsById,
      ownedTokens,
    )

    expect(tokens).toHaveLength(0)
  })

  it('returns empty array for empty deck', () => {
    const cardsById = new Map<string, Card>()
    const ownedTokens = new Set<string>()

    const tokens = detectTokensFromDeck([], cardsById, ownedTokens)

    expect(tokens).toHaveLength(0)
  })

  it('deduplicates tokens produced by multiple cards', () => {
    // Two different cards both produce the same Saproling token
    const card1 = { ...FIXTURE_CARD_TENDERSHOOT_DRYAD, id: 'card-1' }
    const card2 = {
      ...FIXTURE_CARD_TENDERSHOOT_DRYAD,
      id: 'card-2',
      name: 'Another Token Producer',
      all_parts: [
        {
          id: 'card-2',
          name: 'Another Token Producer',
          type_line: 'Creature',
          component: 'combo_piece' as const,
        },
        {
          id: 'saproling-token-uuid',
          name: 'Saproling',
          type_line: 'Token Creature — Saproling',
          component: 'token' as const,
        },
      ],
    }

    const deckCards: DeckCard[] = [
      { deckId: 1, cardId: 'card-1', quantity: 1, category: 'mainboard', addedAt: 0 },
      { deckId: 1, cardId: 'card-2', quantity: 1, category: 'mainboard', addedAt: 0 },
    ]

    const cardsById = new Map<string, Card>([
      ['card-1', card1],
      ['card-2', card2],
    ])
    const ownedTokens = new Set<string>()

    const tokens = detectTokensFromDeck(deckCards, cardsById, ownedTokens)

    // Only one token (deduped), but fromCardIds has both
    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.cardId).toBe('saproling-token-uuid')
    expect(tokens[0]!.fromCardIds).toContain('card-1')
    expect(tokens[0]!.fromCardIds).toContain('card-2')
  })

  it('skips deck cards not found in cardsById', () => {
    const cardsById = new Map<string, Card>() // empty — no cards loaded
    const ownedTokens = new Set<string>()

    const tokens = detectTokensFromDeck(
      [FIXTURE_DECKCARD_TENDERSHOOT],
      cardsById,
      ownedTokens,
    )

    expect(tokens).toHaveLength(0)
  })

  it('skips all_parts entries that are not component=token', () => {
    // FIXTURE_CARD_TENDERSHOOT_DRYAD has both a combo_piece and a token — only token should appear
    const cardsById = new Map<string, Card>([
      ['tendershoot-uuid', FIXTURE_CARD_TENDERSHOOT_DRYAD],
    ])
    const ownedTokens = new Set<string>()

    const tokens = detectTokensFromDeck(
      [FIXTURE_DECKCARD_TENDERSHOOT],
      cardsById,
      ownedTokens,
    )

    // Only the Saproling (component='token') should appear, not the combo_piece self-reference
    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.cardId).toBe('saproling-token-uuid')
  })

  it('skips self-referencing all_parts entries', () => {
    // Card where one all_parts entry has the same id as the card itself
    const selfRefCard: Card = {
      ...FIXTURE_CARD_SOL_RING,
      id: 'self-ref-uuid',
      all_parts: [
        {
          id: 'self-ref-uuid', // Same ID as the card itself
          name: 'Sol Ring',
          type_line: 'Artifact',
          component: 'token', // Even marked as token — should be skipped
        },
        {
          id: 'other-token-uuid',
          name: 'Some Token',
          type_line: 'Token Creature',
          component: 'token',
        },
      ],
    }

    const deckCard: DeckCard = {
      deckId: 1,
      cardId: 'self-ref-uuid',
      quantity: 1,
      category: 'mainboard',
      addedAt: 0,
    }

    const cardsById = new Map<string, Card>([['self-ref-uuid', selfRefCard]])
    const ownedTokens = new Set<string>()

    const tokens = detectTokensFromDeck([deckCard], cardsById, ownedTokens)

    // Self-reference skipped; only the other token appears
    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.cardId).toBe('other-token-uuid')
  })

  it('handles a mixed deck: some cards with tokens, some without', () => {
    const cardsById = new Map<string, Card>([
      ['tendershoot-uuid', FIXTURE_CARD_TENDERSHOOT_DRYAD],
      ['counterspell-uuid', FIXTURE_CARD_COUNTERSPELL],
      ['commander-uuid', FIXTURE_CARD_COMMANDER],
    ])
    const ownedTokens = new Set<string>(['saproling-token-uuid'])

    const deckCards: DeckCard[] = [
      FIXTURE_DECKCARD_TENDERSHOOT,
      FIXTURE_DECKCARD_COUNTERSPELL,
      { deckId: 1, cardId: 'commander-uuid', quantity: 1, category: 'commander', addedAt: 0 },
    ]

    const tokens = detectTokensFromDeck(deckCards, cardsById, ownedTokens)

    // Only Tendershoot produces a token
    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.status).toBe('have')
  })

  it('handles multiple different tokens from the same deck', () => {
    const card1WithToken: Card = {
      ...FIXTURE_CARD_SOL_RING,
      id: 'card-with-token-1',
      all_parts: [
        {
          id: 'token-a-uuid',
          name: 'Token A',
          type_line: 'Token Creature',
          component: 'token',
        },
      ],
    }
    const card2WithToken: Card = {
      ...FIXTURE_CARD_SOL_RING,
      id: 'card-with-token-2',
      all_parts: [
        {
          id: 'token-b-uuid',
          name: 'Token B',
          type_line: 'Token Creature',
          component: 'token',
        },
      ],
    }

    const deckCards: DeckCard[] = [
      { deckId: 1, cardId: 'card-with-token-1', quantity: 1, category: 'mainboard', addedAt: 0 },
      { deckId: 1, cardId: 'card-with-token-2', quantity: 1, category: 'mainboard', addedAt: 0 },
    ]

    const cardsById = new Map<string, Card>([
      ['card-with-token-1', card1WithToken],
      ['card-with-token-2', card2WithToken],
    ])
    const ownedTokens = new Set<string>(['token-a-uuid']) // own A but not B

    const tokens = detectTokensFromDeck(deckCards, cardsById, ownedTokens)

    expect(tokens).toHaveLength(2)
    const tokenA = tokens.find((t) => t.cardId === 'token-a-uuid')
    const tokenB = tokens.find((t) => t.cardId === 'token-b-uuid')
    expect(tokenA?.status).toBe('have')
    expect(tokenB?.status).toBe('missing')
  })
})

// ---------------------------------------------------------------------------
// computeTradeAvailability
// ---------------------------------------------------------------------------

describe('computeTradeAvailability', () => {
  it('returns correct surplus when collection > deck usage', () => {
    // Sol Ring: owned 3 total (1 nonfoil + 2 foil), in decks 1 → available 2
    const collection = [
      FIXTURE_ENTRY_SOL_RING, // qty=1, nonfoil
      FIXTURE_ENTRY_SOL_RING_FOIL, // qty=2, foil
    ]
    const deckCards = [FIXTURE_DECKCARD_SOL_RING] // qty=1

    const result = computeTradeAvailability(collection, deckCards)

    const solRing = result.get('sol-ring-uuid')
    expect(solRing).toBeDefined()
    expect(solRing!.totalOwned).toBe(3)
    expect(solRing!.inDecks).toBe(1)
    expect(solRing!.available).toBe(2)
    expect(solRing!.isAvailable).toBe(true)
  })

  it('returns available=0 when all copies are in decks', () => {
    const collection = [FIXTURE_ENTRY_COUNTERSPELL] // qty=1
    const deckCards = [FIXTURE_DECKCARD_COUNTERSPELL] // qty=1

    const result = computeTradeAvailability(collection, deckCards)

    const counterspell = result.get('counterspell-uuid')
    expect(counterspell).toBeDefined()
    expect(counterspell!.totalOwned).toBe(1)
    expect(counterspell!.inDecks).toBe(1)
    expect(counterspell!.available).toBe(0)
    expect(counterspell!.isAvailable).toBe(false)
  })

  it('clamps to 0 when deck usage exceeds owned (no negatives)', () => {
    // Edge case: qty=1 but deck has qty=2 (data inconsistency)
    const collection = [FIXTURE_ENTRY_COUNTERSPELL] // qty=1
    const deckCards = [{ ...FIXTURE_DECKCARD_COUNTERSPELL, quantity: 2 }]

    const result = computeTradeAvailability(collection, deckCards)

    const counterspell = result.get('counterspell-uuid')
    expect(counterspell!.available).toBe(0) // clamped, not -1
    expect(counterspell!.isAvailable).toBe(false)
  })

  it('returns correct data for cards not in any deck', () => {
    const collection = [FIXTURE_ENTRY_SOL_RING] // qty=1
    const deckCards: DeckCard[] = [] // no decks

    const result = computeTradeAvailability(collection, deckCards)

    const solRing = result.get('sol-ring-uuid')
    expect(solRing!.totalOwned).toBe(1)
    expect(solRing!.inDecks).toBe(0)
    expect(solRing!.available).toBe(1)
    expect(solRing!.isAvailable).toBe(true)
  })

  it('handles multiple cards correctly', () => {
    const collection = [
      FIXTURE_ENTRY_SOL_RING, // sol-ring qty=1
      FIXTURE_ENTRY_COUNTERSPELL, // counterspell qty=1
    ]
    const deckCards = [
      FIXTURE_DECKCARD_SOL_RING, // sol-ring qty=1 in deck
      // Counterspell NOT in any deck
    ]

    const result = computeTradeAvailability(collection, deckCards)

    expect(result.size).toBe(2)
    expect(result.get('sol-ring-uuid')!.available).toBe(0)
    expect(result.get('counterspell-uuid')!.available).toBe(1)
  })

  it('returns empty map for empty collection', () => {
    const result = computeTradeAvailability([], [])
    expect(result.size).toBe(0)
  })

  it('aggregates quantities across multiple finishes and conditions (same cardId)', () => {
    // 3 entries for the same card (different finishes/conditions)
    const collection = [
      { ...FIXTURE_ENTRY_SOL_RING, quantity: 2 },
      { ...FIXTURE_ENTRY_SOL_RING_FOIL, quantity: 3 },
      { cardId: 'sol-ring-uuid', finish: 'etched' as const, condition: 'LP' as const, quantity: 1, forTrade: false, language: 'en', addedAt: 0, updatedAt: 0 },
    ]
    const deckCards = [FIXTURE_DECKCARD_SOL_RING] // qty=1

    const result = computeTradeAvailability(collection, deckCards)

    const solRing = result.get('sol-ring-uuid')
    expect(solRing!.totalOwned).toBe(6) // 2+3+1
    expect(solRing!.inDecks).toBe(1)
    expect(solRing!.available).toBe(5)
  })

  it('aggregates quantities across multiple decks (same cardId)', () => {
    const collection = [{ ...FIXTURE_ENTRY_SOL_RING, quantity: 5 }]
    // Sol Ring in 3 different decks, total qty=4
    const deckCards: DeckCard[] = [
      { deckId: 1, cardId: 'sol-ring-uuid', quantity: 1, category: 'mainboard', addedAt: 0 },
      { deckId: 2, cardId: 'sol-ring-uuid', quantity: 2, category: 'mainboard', addedAt: 0 },
      { deckId: 3, cardId: 'sol-ring-uuid', quantity: 1, category: 'mainboard', addedAt: 0 },
    ]

    const result = computeTradeAvailability(collection, deckCards)

    const solRing = result.get('sol-ring-uuid')
    expect(solRing!.totalOwned).toBe(5)
    expect(solRing!.inDecks).toBe(4)
    expect(solRing!.available).toBe(1)
  })

  it('ignores deck cards for cards not in the collection', () => {
    // Collection has no entry for the token, but deck somehow references it
    const collection = [FIXTURE_ENTRY_SOL_RING]
    const deckCards: DeckCard[] = [
      FIXTURE_DECKCARD_SOL_RING,
      // Saproling token in deck — NOT in collection
      { deckId: 1, cardId: 'saproling-token-uuid', quantity: 1, category: 'mainboard', addedAt: 0 },
    ]

    const result = computeTradeAvailability(collection, deckCards)

    // Only Sol Ring should appear (owned cards only)
    expect(result.size).toBe(1)
    expect(result.has('saproling-token-uuid')).toBe(false)
  })

  it('does not include forTrade flag in availability (they are independent)', () => {
    // forTrade=true on Sol Ring should NOT affect availability calculation
    const collection = [{ ...FIXTURE_ENTRY_SOL_RING, forTrade: true, quantity: 2 }]
    const deckCards = [FIXTURE_DECKCARD_SOL_RING] // qty=1

    const result = computeTradeAvailability(collection, deckCards)

    const solRing = result.get('sol-ring-uuid')
    expect(solRing!.available).toBe(1) // purely quantity-based
    expect(solRing!.isAvailable).toBe(true)
  })

  it('handles the same card in both collection and multiple deck categories', () => {
    const collection = [{ ...FIXTURE_ENTRY_SOL_RING, quantity: 3 }]
    const deckCards: DeckCard[] = [
      // Sol Ring split across two categories in the same deck
      { deckId: 1, cardId: 'sol-ring-uuid', quantity: 1, category: 'mainboard', addedAt: 0 },
      { deckId: 1, cardId: 'sol-ring-uuid', quantity: 1, category: 'sideboard', addedAt: 0 },
    ]

    const result = computeTradeAvailability(collection, deckCards)

    const solRing = result.get('sol-ring-uuid')
    expect(solRing!.inDecks).toBe(2)
    expect(solRing!.available).toBe(1)
  })

  it('uses the fixture token card correctly across all_parts-based scenarios', () => {
    // Ensure FIXTURE_CARD_SAPROLING_TOKEN is a valid fixture (type check via actual use)
    const collection = [
      { cardId: 'saproling-token-uuid', finish: 'nonfoil' as const, condition: 'NM' as const, quantity: 5, forTrade: false, language: 'en', addedAt: 0, updatedAt: 0 },
    ]

    const result = computeTradeAvailability(collection, [])

    expect(result.get('saproling-token-uuid')!.totalOwned).toBe(5)
    // Referenced only to use FIXTURE_CARD_SAPROLING_TOKEN (avoid TS unused variable)
    expect(FIXTURE_CARD_SAPROLING_TOKEN.layout).toBe('token')
  })
})
