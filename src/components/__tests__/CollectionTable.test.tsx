/**
 * CollectionTable.test.tsx — Smoke tests for CollectionTable.
 *
 * Tests: empty state, seeded entries render in table.
 * NEVER uses vi.useFakeTimers().
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CollectionProvider } from '../../lib/collection'
import { CollectionTable } from '../CollectionTable'
import { freshCollectionDb, closeAndDelete } from '../../lib/__tests__/db-helpers'
import type { CollectionDb } from '../../lib/collection-db'
import {
  FIXTURE_CARD_SOL_RING,
  FIXTURE_CARD_COUNTERSPELL,
} from '../../lib/__tests__/fixtures'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testDb: CollectionDb

afterEach(async () => {
  cleanup()
  if (testDb) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
    await closeAndDelete(testDb)
  }
})

function renderWithProvider(children: ReactNode, db: CollectionDb) {
  return render(<CollectionProvider db={db}>{children}</CollectionProvider>)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionTable — empty state', () => {
  it('renders empty state message when collection is empty', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(<CollectionTable />, testDb)

    await waitFor(() => {
      expect(
        screen.getByText(/Tu colección está vacía/i),
      ).toBeInTheDocument()
    })
  })
})

describe('CollectionTable — with entries', () => {
  it('renders table rows for seeded entries', async () => {
    testDb = await freshCollectionDb()

    // Seed cards and collection entries
    await testDb.cards.bulkPut([
      { ...FIXTURE_CARD_SOL_RING, cachedAt: Date.now() },
      { ...FIXTURE_CARD_COUNTERSPELL, cachedAt: Date.now() },
    ])
    const now = Date.now()
    await testDb.collection.bulkAdd([
      {
        cardId: FIXTURE_CARD_SOL_RING.id,
        finish: 'nonfoil' as const,
        condition: 'NM' as const,
        quantity: 2,
        forTrade: false,
        language: 'en',
        addedAt: now,
        updatedAt: now,
      },
      {
        cardId: FIXTURE_CARD_COUNTERSPELL.id,
        finish: 'foil' as const,
        condition: 'LP' as const,
        quantity: 1,
        forTrade: true,
        language: 'en',
        addedAt: now,
        updatedAt: now,
      },
    ])

    renderWithProvider(<CollectionTable />, testDb)

    await waitFor(() => {
      expect(screen.getByText('Sol Ring')).toBeInTheDocument()
    })

    expect(screen.getByText('Counterspell')).toBeInTheDocument()
  })

  it('shows entry count in footer', async () => {
    testDb = await freshCollectionDb()

    await testDb.cards.put({ ...FIXTURE_CARD_SOL_RING, cachedAt: Date.now() })
    const now = Date.now()
    await testDb.collection.add({
      cardId: FIXTURE_CARD_SOL_RING.id,
      finish: 'nonfoil' as const,
      condition: 'NM' as const,
      quantity: 1,
      forTrade: false,
      language: 'en',
      addedAt: now,
      updatedAt: now,
    })

    renderWithProvider(<CollectionTable />, testDb)

    await waitFor(() => {
      expect(screen.getByText(/1 entrada/i)).toBeInTheDocument()
    })
  })
})
