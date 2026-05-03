/**
 * collection-provider.test.tsx — Integration tests for CollectionProvider.
 *
 * Uses freshCollectionDb() for per-test isolation.
 * Passes the fresh db via the optional `db` prop on CollectionProvider.
 * NEVER calls vi.useFakeTimers() in this file.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CollectionProvider } from '../collection'
import { useCollection, SingletonViolationError } from '../collection-context'
import { freshCollectionDb, closeAndDelete } from './db-helpers'
import type { CollectionDb } from '../collection-db'
import {
  FIXTURE_CARD_SOL_RING,
  FIXTURE_CARD_COUNTERSPELL,
  FIXTURE_CARD_FOREST,
  FIXTURE_CARD_COMMANDER,
} from './fixtures'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testDb: CollectionDb

afterEach(async () => {
  // Unmount all rendered components first to stop any async effects
  cleanup()
  if (testDb) {
    // Small delay to let in-flight transactions complete before closing
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
    await closeAndDelete(testDb)
  }
})

/**
 * Renders a component inside CollectionProvider using the test-isolated db.
 */
function renderWithProvider(children: ReactNode, db: CollectionDb) {
  return render(<CollectionProvider db={db}>{children}</CollectionProvider>)
}

// ---------------------------------------------------------------------------
// isReady lifecycle
// ---------------------------------------------------------------------------

describe('CollectionProvider — isReady', () => {
  it('becomes true after db.open() resolves', async () => {
    testDb = await freshCollectionDb()

    function IsReadyDisplay() {
      const { isReady } = useCollection()
      return <div data-testid="ready">{isReady ? 'ready' : 'loading'}</div>
    }

    renderWithProvider(<IsReadyDisplay />, testDb)

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })
  })
})

// ---------------------------------------------------------------------------
// addCard
// ---------------------------------------------------------------------------

describe('CollectionProvider — addCard', () => {
  it('adds a new entry to the collection', async () => {
    testDb = await freshCollectionDb()
    let capturedCount = 0

    function AddAndCount() {
      const { addCard } = useCollection()

      async function handleClick() {
        await addCard(FIXTURE_CARD_SOL_RING, { finish: 'nonfoil', condition: 'NM', quantity: 1 })
        capturedCount = await testDb.collection.count()
      }

      return (
        <button onClick={handleClick} data-testid="add-btn">
          Add
        </button>
      )
    }

    renderWithProvider(<AddAndCount />, testDb)

    await act(async () => {
      screen.getByTestId('add-btn').click()
    })

    await waitFor(() => {
      expect(capturedCount).toBe(1)
    })
  })

  it('increments quantity when same [cardId+finish+condition] added again', async () => {
    testDb = await freshCollectionDb()
    let capturedQuantity = 0

    function AddTwice() {
      const { addCard } = useCollection()

      async function handleClick() {
        await addCard(FIXTURE_CARD_SOL_RING, { finish: 'nonfoil', condition: 'NM', quantity: 1 })
        await addCard(FIXTURE_CARD_SOL_RING, { finish: 'nonfoil', condition: 'NM', quantity: 2 })
        const entry = await testDb.collection
          .where('[cardId+finish+condition]')
          .equals([FIXTURE_CARD_SOL_RING.id, 'nonfoil', 'NM'])
          .first()
        capturedQuantity = entry?.quantity ?? 0
      }

      return (
        <button onClick={handleClick} data-testid="add-btn">
          Add Twice
        </button>
      )
    }

    renderWithProvider(<AddTwice />, testDb)

    await act(async () => {
      screen.getByTestId('add-btn').click()
    })

    await waitFor(() => {
      expect(capturedQuantity).toBe(3) // 1 + 2
    })
  })

  it('creates separate entries for different finishes', async () => {
    testDb = await freshCollectionDb()
    let capturedCount = 0

    function AddDifferentFinishes() {
      const { addCard } = useCollection()

      async function handleClick() {
        await addCard(FIXTURE_CARD_SOL_RING, { finish: 'nonfoil', condition: 'NM' })
        await addCard(FIXTURE_CARD_SOL_RING, { finish: 'foil', condition: 'NM' })
        capturedCount = await testDb.collection.count()
      }

      return (
        <button onClick={handleClick} data-testid="add-btn">
          Add
        </button>
      )
    }

    renderWithProvider(<AddDifferentFinishes />, testDb)

    await act(async () => {
      screen.getByTestId('add-btn').click()
    })

    await waitFor(() => {
      expect(capturedCount).toBe(2)
    })
  })

  it('upserts the card into the cards table', async () => {
    testDb = await freshCollectionDb()
    let capturedCardCount = 0

    function AddAndCheckCards() {
      const { addCard } = useCollection()

      async function handleClick() {
        await addCard(FIXTURE_CARD_SOL_RING)
        capturedCardCount = await testDb.cards.count()
      }

      return (
        <button onClick={handleClick} data-testid="add-btn">
          Add
        </button>
      )
    }

    renderWithProvider(<AddAndCheckCards />, testDb)

    await act(async () => {
      screen.getByTestId('add-btn').click()
    })

    await waitFor(() => {
      expect(capturedCardCount).toBe(1)
    })
  })
})

// ---------------------------------------------------------------------------
// removeEntry
// ---------------------------------------------------------------------------

describe('CollectionProvider — removeEntry', () => {
  it('removes an entry by id', async () => {
    testDb = await freshCollectionDb()
    let capturedCount = 0

    function AddAndRemove() {
      const { addCard, removeEntry } = useCollection()

      async function handleClick() {
        await addCard(FIXTURE_CARD_SOL_RING, { finish: 'nonfoil', condition: 'NM' })
        const entry = await testDb.collection.toArray()
        if (entry[0]?.id !== undefined) {
          await removeEntry(entry[0].id)
        }
        capturedCount = await testDb.collection.count()
      }

      return (
        <button onClick={handleClick} data-testid="btn">
          Go
        </button>
      )
    }

    renderWithProvider(<AddAndRemove />, testDb)

    await act(async () => {
      screen.getByTestId('btn').click()
    })

    await waitFor(() => {
      expect(capturedCount).toBe(0)
    })
  })
})

// ---------------------------------------------------------------------------
// Deck management
// ---------------------------------------------------------------------------

describe('CollectionProvider — deck mutations', () => {
  it('createDeck returns a numeric id and persists the deck', async () => {
    testDb = await freshCollectionDb()
    let capturedId: number | null = null
    let capturedCount = 0

    function CreateDeck() {
      const { createDeck } = useCollection()

      async function handleClick() {
        capturedId = await createDeck('Test Deck', 'commander-uuid')
        capturedCount = await testDb.decks.count()
      }

      return (
        <button onClick={handleClick} data-testid="btn">
          Create
        </button>
      )
    }

    renderWithProvider(<CreateDeck />, testDb)

    await act(async () => {
      screen.getByTestId('btn').click()
    })

    await waitFor(() => {
      expect(capturedId).toBeGreaterThan(0)
      expect(capturedCount).toBe(1)
    })
  })

  it('deleteDeck removes the deck and all its DeckCards', async () => {
    testDb = await freshCollectionDb()
    let capturedDeckCount = 0
    let capturedDeckCardCount = 0

    function CreateAndDelete() {
      const { createDeck, addCardToDeck, deleteDeck } = useCollection()

      async function handleClick() {
        const deckId = await createDeck('Test Deck', FIXTURE_CARD_COMMANDER.id)
        // Add a card to the deck first
        await addCardToDeck(deckId, FIXTURE_CARD_COUNTERSPELL, { category: 'mainboard' })
        // Delete the deck
        await deleteDeck(deckId)
        capturedDeckCount = await testDb.decks.count()
        capturedDeckCardCount = await testDb.deckCards.count()
      }

      return (
        <button onClick={handleClick} data-testid="btn">
          Go
        </button>
      )
    }

    renderWithProvider(<CreateAndDelete />, testDb)

    await act(async () => {
      screen.getByTestId('btn').click()
    })

    await waitFor(() => {
      expect(capturedDeckCount).toBe(0)
      expect(capturedDeckCardCount).toBe(0)
    })
  })
})

// ---------------------------------------------------------------------------
// addCardToDeck — singleton rule
// ---------------------------------------------------------------------------

describe('CollectionProvider — addCardToDeck singleton rule', () => {
  it('allows adding a card once to a commander deck', async () => {
    testDb = await freshCollectionDb()
    let capturedCount = 0

    function AddOnce() {
      const { createDeck, addCardToDeck } = useCollection()

      async function handleClick() {
        const deckId = await createDeck('Control Deck', FIXTURE_CARD_COMMANDER.id)
        await addCardToDeck(deckId, FIXTURE_CARD_COUNTERSPELL, { category: 'mainboard' })
        capturedCount = await testDb.deckCards.count()
      }

      return (
        <button onClick={handleClick} data-testid="btn">
          Add
        </button>
      )
    }

    renderWithProvider(<AddOnce />, testDb)

    await act(async () => {
      screen.getByTestId('btn').click()
    })

    await waitFor(() => {
      expect(capturedCount).toBe(1)
    })
  })

  it('throws SingletonViolationError when adding a second non-basic card to commander deck', async () => {
    testDb = await freshCollectionDb()
    let capturedError: Error | null = null

    function AddTwice() {
      const { createDeck, addCardToDeck } = useCollection()

      async function handleClick() {
        const deckId = await createDeck('Control Deck', FIXTURE_CARD_COMMANDER.id)
        await addCardToDeck(deckId, FIXTURE_CARD_COUNTERSPELL, { category: 'mainboard' })
        try {
          await addCardToDeck(deckId, FIXTURE_CARD_COUNTERSPELL, { category: 'mainboard' })
        } catch (err) {
          capturedError = err as Error
        }
      }

      return (
        <button onClick={handleClick} data-testid="btn">
          Add Twice
        </button>
      )
    }

    renderWithProvider(<AddTwice />, testDb)

    await act(async () => {
      screen.getByTestId('btn').click()
    })

    await waitFor(() => {
      expect(capturedError).toBeInstanceOf(SingletonViolationError)
    })
  })

  it('allows multiple copies of basic lands in commander deck', async () => {
    testDb = await freshCollectionDb()
    let capturedCount = 0
    let capturedError: Error | null = null

    function AddForests() {
      const { createDeck, addCardToDeck } = useCollection()

      async function handleClick() {
        const deckId = await createDeck('Green Deck', FIXTURE_CARD_COMMANDER.id)
        try {
          // Add Forest twice — should be allowed (basic land exemption)
          await addCardToDeck(deckId, FIXTURE_CARD_FOREST, { category: 'mainboard' })
          await addCardToDeck(deckId, FIXTURE_CARD_FOREST, { category: 'mainboard' })
        } catch (err) {
          capturedError = err as Error
        }
        capturedCount = await testDb.deckCards.count()
      }

      return (
        <button onClick={handleClick} data-testid="btn">
          Add Forests
        </button>
      )
    }

    renderWithProvider(<AddForests />, testDb)

    await act(async () => {
      screen.getByTestId('btn').click()
    })

    await waitFor(() => {
      expect(capturedError).toBeNull()
      // Forest added twice — existing entry incremented (still 1 DeckCard row)
      expect(capturedCount).toBe(1)
    })
  })
})

// ---------------------------------------------------------------------------
// toggleForTrade
// ---------------------------------------------------------------------------

describe('CollectionProvider — toggleForTrade', () => {
  it('toggles the forTrade flag', async () => {
    testDb = await freshCollectionDb()
    let capturedForTrade: boolean | null = null

    function ToggleTrade() {
      const { addCard, toggleForTrade } = useCollection()

      async function handleClick() {
        await addCard(FIXTURE_CARD_SOL_RING, { forTrade: false })
        const entry = await testDb.collection.toArray()
        const id = entry[0]?.id
        if (id === undefined) return
        await toggleForTrade(id)
        const updated = await testDb.collection.get(id)
        capturedForTrade = updated?.forTrade ?? null
      }

      return (
        <button onClick={handleClick} data-testid="btn">
          Toggle
        </button>
      )
    }

    renderWithProvider(<ToggleTrade />, testDb)

    await act(async () => {
      screen.getByTestId('btn').click()
    })

    await waitFor(() => {
      expect(capturedForTrade).toBe(true)
    })
  })
})
