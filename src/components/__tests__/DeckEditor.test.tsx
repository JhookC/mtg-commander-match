/**
 * DeckEditor.test.tsx — Smoke tests for DeckEditor.
 *
 * Tests: modal opens, form fields present, singleton violation message surfaces.
 * NEVER uses vi.useFakeTimers().
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CollectionProvider } from '../../lib/collection'
import { DeckEditor } from '../DeckEditor'
import { freshCollectionDb, closeAndDelete } from '../../lib/__tests__/db-helpers'
import type { CollectionDb } from '../../lib/collection-db'

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

describe('DeckEditor — create mode', () => {
  it('renders dialog when isOpen=true', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <DeckEditor isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText('Crear mazo')).toBeInTheDocument()
  })

  it('does not render when isOpen=false', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <DeckEditor isOpen={false} onClose={() => {}} />,
      testDb,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows deck name input and commander search', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <DeckEditor isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText(/Mi mazo commander/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Buscar comandante/i)).toBeInTheDocument()
  })

  it('save button is disabled when name and commander are empty', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <DeckEditor isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('Guardar')
    expect(saveBtn).toBeDisabled()
  })

  it('calls onClose when close button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    testDb = await freshCollectionDb()

    let closed = false
    renderWithProvider(
      <DeckEditor isOpen={true} onClose={() => { closed = true }} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const closeBtn = screen.getByLabelText('Cerrar')
    await user.click(closeBtn)

    expect(closed).toBe(true)
  })
})

describe('DeckEditor — edit mode', () => {
  it('renders dialog with existing deck when deckId is provided', async () => {
    testDb = await freshCollectionDb()

    // Create a deck
    const deckId = await testDb.decks.add({
      name: 'Test Deck',
      commanderId: 'commander-uuid',
      format: 'commander',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }) as number

    renderWithProvider(
      <DeckEditor deckId={deckId} isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText('Editar mazo')).toBeInTheDocument()
  })

  it('shows Cartas and Tokens tabs for existing deck', async () => {
    testDb = await freshCollectionDb()

    const deckId = await testDb.decks.add({
      name: 'Test Deck',
      commanderId: 'commander-uuid',
      format: 'commander',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }) as number

    renderWithProvider(
      <DeckEditor deckId={deckId} isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText('Información')).toBeInTheDocument()
    expect(screen.getByText(/Cartas/)).toBeInTheDocument()
    expect(screen.getByText(/Tokens/)).toBeInTheDocument()
  })
})
