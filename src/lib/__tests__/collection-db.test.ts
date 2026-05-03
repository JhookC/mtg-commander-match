/**
 * collection-db.test.ts — Schema integrity tests for CollectionDb.
 *
 * NEVER call vi.useFakeTimers() here — fake timers break Dexie/IndexedDB.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { CollectionDb } from '../collection-db'
import type { CollectionEntry } from '../../domain/collection'
import { freshCollectionDb, closeAndDelete, now } from './db-helpers'

let db: CollectionDb

beforeEach(async () => {
  db = await freshCollectionDb()
})

afterEach(async () => {
  await closeAndDelete(db)
})

// ---------------------------------------------------------------------------
// 1. Schema opens + all 4 tables exist
// ---------------------------------------------------------------------------

describe('CollectionDb schema', () => {
  it('opens without error', async () => {
    expect(db.isOpen()).toBe(true)
  })

  it('has all 4 required tables', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['cards', 'collection', 'deckCards', 'decks'].sort(),
    )
  })
})

// ---------------------------------------------------------------------------
// 2. Compound unique index: &[cardId+finish+condition]
// ---------------------------------------------------------------------------

describe('collection compound unique index [cardId+finish+condition]', () => {
  const baseEntry = (): Omit<CollectionEntry, 'id'> => ({
    cardId: 'abc-scryfall-uuid',
    finish: 'nonfoil',
    condition: 'NM',
    quantity: 1,
    forTrade: false,
    language: 'en',
    addedAt: now(),
    updatedAt: now(),
  })

  it('rejects a second insert with the same [cardId+finish+condition]', async () => {
    await db.collection.add(baseEntry())

    await expect(db.collection.add(baseEntry())).rejects.toThrow()
  })

  it('allows same cardId with different finish (nonfoil vs foil — separate variants)', async () => {
    await db.collection.add({ ...baseEntry(), finish: 'nonfoil' })
    await db.collection.add({ ...baseEntry(), finish: 'foil' })

    const rows = await db.collection.where('cardId').equals('abc-scryfall-uuid').toArray()
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.finish).sort()).toEqual(['foil', 'nonfoil'])
  })

  it('allows same cardId with different condition (NM vs LP — separate variants)', async () => {
    await db.collection.add({ ...baseEntry(), condition: 'NM' })
    await db.collection.add({ ...baseEntry(), condition: 'LP' })

    const rows = await db.collection.where('cardId').equals('abc-scryfall-uuid').toArray()
    expect(rows).toHaveLength(2)
  })

  it('allows same cardId with all three finishes (nonfoil, foil, etched)', async () => {
    await db.collection.add({ ...baseEntry(), finish: 'nonfoil' })
    await db.collection.add({ ...baseEntry(), finish: 'foil' })
    await db.collection.add({ ...baseEntry(), finish: 'etched' })

    const rows = await db.collection.where('cardId').equals('abc-scryfall-uuid').toArray()
    expect(rows).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// 3. cards.put is idempotent (Scryfall UUID as PK)
// ---------------------------------------------------------------------------

describe('cards table — string PK idempotent put', () => {
  it('puts a card with Scryfall UUID as PK without error', async () => {
    const ts = now()
    await db.cards.put({
      id: 'sol-ring-uuid-1234',
      name: 'Sol Ring',
      set: 'lea',
      rarity: 'uncommon',
      type_line: 'Artifact',
      colors: [],
      color_identity: [],
      cmc: 1,
      layout: 'normal',
      cachedAt: ts,
    })

    const card = await db.cards.get('sol-ring-uuid-1234')
    expect(card?.name).toBe('Sol Ring')
  })

  it('updating a card via put is idempotent (upsert)', async () => {
    const ts = now()
    const base = {
      id: 'sol-ring-uuid-1234',
      name: 'Sol Ring',
      set: 'lea',
      rarity: 'uncommon' as const,
      type_line: 'Artifact',
      colors: [] as string[],
      color_identity: [] as string[],
      cmc: 1,
      layout: 'normal',
      cachedAt: ts,
    }

    await db.cards.put(base)
    await db.cards.put({ ...base, cachedAt: ts + 1000 })

    const count = await db.cards.count()
    expect(count).toBe(1)

    const updated = await db.cards.get('sol-ring-uuid-1234')
    expect(updated?.cachedAt).toBe(ts + 1000)
  })
})
