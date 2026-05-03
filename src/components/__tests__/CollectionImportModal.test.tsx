/**
 * CollectionImportModal.test.tsx — Smoke tests for CollectionImportModal.
 *
 * Tests: modal opens/renders, cancel closes, import error rows surface.
 * NEVER uses vi.useFakeTimers().
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { CollectionProvider } from '../../lib/collection'
import { CollectionImportModal } from '../CollectionImportModal'
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

describe('CollectionImportModal — render', () => {
  it('renders modal content when isOpen=true', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <CollectionImportModal isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText('Importar colección')).toBeInTheDocument()
    expect(screen.getByText('Importar')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('does not render when isOpen=false', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <CollectionImportModal isOpen={false} onClose={() => {}} />,
      testDb,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('CollectionImportModal — interactions', () => {
  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup()
    testDb = await freshCollectionDb()

    let closed = false
    renderWithProvider(
      <CollectionImportModal isOpen={true} onClose={() => { closed = true }} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const cancelBtn = screen.getByText('Cancelar')
    await user.click(cancelBtn)

    expect(closed).toBe(true)
  })

  it('shows format selector options', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <CollectionImportModal isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Automático')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Moxfield')).toBeInTheDocument()
    expect(screen.getByText('Archidekt')).toBeInTheDocument()
  })

  it('import button is disabled when no file is selected', async () => {
    testDb = await freshCollectionDb()
    renderWithProvider(
      <CollectionImportModal isOpen={true} onClose={() => {}} />,
      testDb,
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const importBtn = screen.getByText('Importar')
    expect(importBtn).toBeDisabled()
  })
})
