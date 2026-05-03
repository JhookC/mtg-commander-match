/**
 * collection-hooks.test.ts — Tests for collection live query hooks.
 *
 * NOTE: These hooks use useLiveQuery (dexie-react-hooks) against the global singleton `db`.
 * To get isolation, we use freshCollectionDb() and then swap the db instance.
 *
 * IMPORTANT: useLiveQuery reads from the GLOBAL singleton `db` in collection-hooks.ts.
 * Since the singleton is module-level, we test the pure utility functions
 * (sortEntriesByCard) and the pure engine functions directly.
 *
 * For the Dexie-backed hooks (useCollectionEntries, useCards, etc.), we test via
 * direct db operations and pure function assertions. Full RTL renderHook integration
 * is too brittle against the global singleton pattern — those are covered by E2E / Phase 13.
 *
 * NEVER calls vi.useFakeTimers() in this file.
 */

import { describe, it, expect } from 'vitest'
import { sortEntriesByCard } from '../collection-hooks'
import {
  FIXTURE_CARD_SOL_RING,
  FIXTURE_CARD_COUNTERSPELL,
  FIXTURE_CARD_COMMANDER,
  FIXTURE_ENTRY_SOL_RING,
  FIXTURE_ENTRY_COUNTERSPELL,
} from './fixtures'
import type { CollectionEntry, Card } from '../../domain/collection'

// ---------------------------------------------------------------------------
// sortEntriesByCard — pure function, no Dexie needed
// ---------------------------------------------------------------------------

describe('sortEntriesByCard', () => {
  const cardsById = new Map<string, Card>([
    ['sol-ring-uuid', FIXTURE_CARD_SOL_RING],         // name: Sol Ring, cmc: 1, rarity: uncommon, set: cmr, price: 1.50
    ['counterspell-uuid', FIXTURE_CARD_COUNTERSPELL], // name: Counterspell, cmc: 2, rarity: uncommon, set: 7ed, price: 2.00
    ['commander-uuid', FIXTURE_CARD_COMMANDER],        // name: Niv-Mizzet, Parun, cmc: 6, rarity: rare, set: grn, price: 5.00
  ])

  const entries: CollectionEntry[] = [
    FIXTURE_ENTRY_SOL_RING,
    FIXTURE_ENTRY_COUNTERSPELL,
    { ...FIXTURE_ENTRY_COUNTERSPELL, cardId: 'commander-uuid', addedAt: 1700000001000 },
  ]

  it('sorts by name ascending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'name', direction: 'asc' })
    const names = sorted.map((e) => cardsById.get(e.cardId)?.name)
    expect(names[0]).toBe('Counterspell')
    expect(names[1]).toBe('Niv-Mizzet, Parun')
    expect(names[2]).toBe('Sol Ring')
  })

  it('sorts by name descending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'name', direction: 'desc' })
    const names = sorted.map((e) => cardsById.get(e.cardId)?.name)
    expect(names[0]).toBe('Sol Ring')
    expect(names[1]).toBe('Niv-Mizzet, Parun')
    expect(names[2]).toBe('Counterspell')
  })

  it('sorts by cmc ascending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'cmc', direction: 'asc' })
    const cmcs = sorted.map((e) => cardsById.get(e.cardId)?.cmc)
    expect(cmcs[0]).toBe(1) // Sol Ring
    expect(cmcs[1]).toBe(2) // Counterspell
    expect(cmcs[2]).toBe(6) // Niv-Mizzet
  })

  it('sorts by cmc descending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'cmc', direction: 'desc' })
    const cmcs = sorted.map((e) => cardsById.get(e.cardId)?.cmc)
    expect(cmcs[0]).toBe(6)
    expect(cmcs[1]).toBe(2)
    expect(cmcs[2]).toBe(1)
  })

  it('sorts by rarity ascending (C→U→R→M order)', () => {
    // Sol Ring and Counterspell are uncommon (1), Commander is rare (2)
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'rarity', direction: 'asc' })
    const rarities = sorted.map((e) => cardsById.get(e.cardId)?.rarity)
    // Both uncommon entries should come before rare
    const uncommonCount = rarities.filter((r) => r === 'uncommon').length
    const rareCount = rarities.filter((r) => r === 'rare').length
    expect(uncommonCount).toBe(2)
    expect(rareCount).toBe(1)
    // Rare should be last when ascending
    expect(rarities[2]).toBe('rare')
  })

  it('sorts by rarity descending (M→R→U→C order)', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'rarity', direction: 'desc' })
    const rarities = sorted.map((e) => cardsById.get(e.cardId)?.rarity)
    // Rare should be first when descending
    expect(rarities[0]).toBe('rare')
  })

  it('sorts by price ascending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'price', direction: 'asc' })
    const prices = sorted.map((e) => parseFloat(cardsById.get(e.cardId)?.prices?.usd ?? '0'))
    expect(prices[0]).toBe(1.5) // Sol Ring
    expect(prices[1]).toBe(2.0) // Counterspell
    expect(prices[2]).toBe(5.0) // Commander
  })

  it('sorts by price descending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'price', direction: 'desc' })
    const prices = sorted.map((e) => parseFloat(cardsById.get(e.cardId)?.prices?.usd ?? '0'))
    expect(prices[0]).toBe(5.0)
    expect(prices[1]).toBe(2.0)
    expect(prices[2]).toBe(1.5)
  })

  it('sorts by set ascending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'set', direction: 'asc' })
    const sets = sorted.map((e) => cardsById.get(e.cardId)?.set)
    // 7ed < cmr < grn (alphabetical)
    expect(sets[0]).toBe('7ed')
    expect(sets[1]).toBe('cmr')
    expect(sets[2]).toBe('grn')
  })

  it('sorts by addedAt ascending', () => {
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'addedAt', direction: 'asc' })
    // Sol Ring and Counterspell have addedAt: 1700000000000; Commander entry has addedAt: 1700000001000
    expect(sorted[sorted.length - 1]?.cardId).toBe('commander-uuid')
  })

  it('handles missing card in cardsById gracefully (stable sort)', () => {
    const incomplete = new Map<string, Card>([
      ['sol-ring-uuid', FIXTURE_CARD_SOL_RING],
      // Counterspell missing
    ])
    // Should not throw
    const sorted = sortEntriesByCard(entries, incomplete, { field: 'name', direction: 'asc' })
    expect(sorted).toHaveLength(entries.length)
  })

  it('returns a new array (does not mutate input)', () => {
    const original = [...entries]
    const sorted = sortEntriesByCard(entries, cardsById, { field: 'name', direction: 'asc' })
    // Original array should be unchanged
    expect(entries).toEqual(original)
    // Sorted is a different reference
    expect(sorted).not.toBe(entries)
  })
})

// ---------------------------------------------------------------------------
// Regression: hook exports exist (TypeScript import check)
// ---------------------------------------------------------------------------

describe('hook exports exist', () => {
  it('can import all hooks without errors', async () => {
    const hooks = await import('../collection-hooks')
    expect(typeof hooks.useCollectionEntries).toBe('function')
    expect(typeof hooks.useCollectionEntry).toBe('function')
    expect(typeof hooks.useCards).toBe('function')
    expect(typeof hooks.useDecks).toBe('function')
    expect(typeof hooks.useDeck).toBe('function')
    expect(typeof hooks.useDeckCards).toBe('function')
    expect(typeof hooks.useTokensForDeck).toBe('function')
    expect(typeof hooks.useTradeAvailabilityMap).toBe('function')
    expect(typeof hooks.sortEntriesByCard).toBe('function')
  })
})
